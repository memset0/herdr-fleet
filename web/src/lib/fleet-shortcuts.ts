export const FLEET_SHORTCUT_CONFIG_TYPE = "herdr-web-remote:shortcut-config";
export const FLEET_SHORTCUT_INTENT_TYPE = "herdr-web-remote:shortcut-intent";
export const FLEET_SHORTCUT_COMMAND_TYPE = "herdr-web-remote:shortcut-command";
export const FLEET_SHORTCUT_RESULT_TYPE = "herdr-web-remote:shortcut-result";
export const FLEET_SHORTCUT_VERSION = 1;

export type FleetShortcutChildAction = "resize-current-pane";

export interface FleetShortcutBinding {
  id: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface FleetShortcutConfig {
  type: typeof FLEET_SHORTCUT_CONFIG_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  generation: number;
  active: boolean;
  bindings: FleetShortcutBinding[];
}

export interface FleetShortcutIntent {
  type: typeof FLEET_SHORTCUT_INTENT_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  intentId: string;
  shortcutId: string;
}

export interface FleetShortcutCommand {
  type: typeof FLEET_SHORTCUT_COMMAND_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  requestId: string;
  action: FleetShortcutChildAction;
}

export type FleetShortcutResult = {
  type: typeof FLEET_SHORTCUT_RESULT_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  requestId: string;
  action: FleetShortcutChildAction;
  ok: true;
} | {
  type: typeof FLEET_SHORTCUT_RESULT_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  requestId: string;
  action: FleetShortcutChildAction;
  ok: false;
  error: string;
};

type MessageListener = (event: MessageEvent<unknown>) => void;
type KeyListener = (event: KeyboardEvent) => void;

export interface FleetShortcutEnvironment {
  framed: boolean;
  parent: MessageEventSource | null;
  documentHidden(): boolean;
  addMessageListener(listener: MessageListener): void;
  removeMessageListener(listener: MessageListener): void;
  addKeyListener(listener: KeyListener): void;
  removeKeyListener(listener: KeyListener): void;
  postParent(message: FleetShortcutIntent | FleetShortcutResult): void;
  randomId(): string;
}

export type FleetShortcutHandler = () => void | Promise<void>;

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CORRELATION_ID = /^[A-Za-z0-9_-]{8,128}$/;
const CODE = /^(?:Key[A-Z]|Digit[1-9])$/;
const MAX_BINDINGS = 32;
const MAX_RESULTS = 64;
const COMMAND_TIMEOUT_MS = 15_000;
const CONFIG_KEYS = new Set(["type", "version", "generation", "active", "bindings"]);
const BINDING_KEYS = new Set(["id", "code", "altKey", "ctrlKey", "metaKey", "shiftKey"]);
const COMMAND_KEYS = new Set(["type", "version", "requestId", "action"]);

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseBinding(value: unknown): FleetShortcutBinding | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, BINDING_KEYS) || !ID.test(String(record.id)) || !CODE.test(String(record.code))) return null;
  if ([record.altKey, record.ctrlKey, record.metaKey, record.shiftKey].some((part) => typeof part !== "boolean")) return null;
  return record as unknown as FleetShortcutBinding;
}

export function parseFleetShortcutConfig(value: unknown): FleetShortcutConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, CONFIG_KEYS)
    || record.type !== FLEET_SHORTCUT_CONFIG_TYPE
    || record.version !== FLEET_SHORTCUT_VERSION
    || !Number.isSafeInteger(record.generation)
    || Number(record.generation) < 0
    || typeof record.active !== "boolean"
    || !Array.isArray(record.bindings)
    || record.bindings.length > MAX_BINDINGS
  ) return null;
  const bindings = record.bindings.map(parseBinding);
  if (bindings.some((binding) => !binding)) return null;
  const valid = bindings as FleetShortcutBinding[];
  if (new Set(valid.map((binding) => binding.id)).size !== valid.length) return null;
  if (new Set(valid.map((binding) => [binding.code, binding.altKey, binding.ctrlKey, binding.metaKey, binding.shiftKey].join("|"))).size !== valid.length) return null;
  return { ...record, bindings: valid } as FleetShortcutConfig;
}

export function parseFleetShortcutCommand(value: unknown): FleetShortcutCommand | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return exactKeys(record, COMMAND_KEYS)
    && record.type === FLEET_SHORTCUT_COMMAND_TYPE
    && record.version === FLEET_SHORTCUT_VERSION
    && typeof record.requestId === "string"
    && CORRELATION_ID.test(record.requestId)
    && record.action === "resize-current-pane"
    ? record as unknown as FleetShortcutCommand
    : null;
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() || "Shortcut unavailable").slice(0, 240);
}

function matches(event: KeyboardEvent, binding: FleetShortcutBinding): boolean {
  return !event.repeat
    && event.code === binding.code
    && event.altKey === binding.altKey
    && event.ctrlKey === binding.ctrlKey
    && event.metaKey === binding.metaKey
    && event.shiftKey === binding.shiftKey;
}

export function createFleetShortcutController(
  environment: FleetShortcutEnvironment,
  handlers: ReadonlyMap<FleetShortcutChildAction, FleetShortcutHandler>,
  commandTimeoutMs = COMMAND_TIMEOUT_MS,
  handlerWaitMs = 2_000,
): () => () => void {
  let started = false;
  let generation = -1;
  let active = false;
  let bindings: FleetShortcutBinding[] = [];
  const results = new Map<string, Promise<FleetShortcutResult>>();
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  const waitForHandler = async (action: FleetShortcutChildAction): Promise<FleetShortcutHandler | undefined> => {
    const deadline = Date.now() + Math.max(0, Math.min(handlerWaitMs, 5_000));
    let handler = active && !environment.documentHidden() ? handlers.get(action) : undefined;
    while (!handler && started && active && !environment.documentHidden() && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          pendingTimers.delete(timeout);
          resolve();
        }, Math.min(25, Math.max(1, deadline - Date.now())));
        pendingTimers.add(timeout);
      });
      if (!started || !active || environment.documentHidden()) return undefined;
      handler = handlers.get(action);
    }
    return handler;
  };

  const runCommand = async (command: FleetShortcutCommand): Promise<FleetShortcutResult> => {
    const handler = await waitForHandler(command.action);
    if (!handler) {
      return Promise.resolve({
        type: FLEET_SHORTCUT_RESULT_TYPE,
        version: FLEET_SHORTCUT_VERSION,
        requestId: command.requestId,
        action: command.action,
        ok: false,
        error: "Shortcut action is unavailable",
      });
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: FleetShortcutResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        pendingTimers.delete(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish({
        type: FLEET_SHORTCUT_RESULT_TYPE,
        version: FLEET_SHORTCUT_VERSION,
        requestId: command.requestId,
        action: command.action,
        ok: false,
        error: "Shortcut action timed out",
      }), Math.max(1, Math.min(commandTimeoutMs, COMMAND_TIMEOUT_MS)));
      pendingTimers.add(timeout);
      void Promise.resolve().then(handler).then(
        () => finish({ type: FLEET_SHORTCUT_RESULT_TYPE, version: FLEET_SHORTCUT_VERSION, requestId: command.requestId, action: command.action, ok: true }),
        (error) => finish({ type: FLEET_SHORTCUT_RESULT_TYPE, version: FLEET_SHORTCUT_VERSION, requestId: command.requestId, action: command.action, ok: false, error: publicError(error) }),
      );
    });
  };

  const onMessage: MessageListener = (event) => {
    if (!started || !environment.framed || event.source !== environment.parent) return;
    const config = parseFleetShortcutConfig(event.data);
    if (config) {
      if (config.generation < generation) return;
      generation = config.generation;
      active = config.active;
      bindings = config.active ? config.bindings : [];
      return;
    }
    const command = parseFleetShortcutCommand(event.data);
    if (!command) return;
    let result = results.get(command.requestId);
    if (!result) {
      result = runCommand(command);
      results.set(command.requestId, result);
      if (results.size > MAX_RESULTS) results.delete(results.keys().next().value as string);
    }
    void result.then((message) => { if (started) environment.postParent(message); });
  };

  const onKey: KeyListener = (event) => {
    if (!started || !active || environment.documentHidden()) return;
    const binding = bindings.find((candidate) => matches(event, candidate));
    if (!binding) return;
    event.preventDefault();
    environment.postParent({
      type: FLEET_SHORTCUT_INTENT_TYPE,
      version: FLEET_SHORTCUT_VERSION,
      intentId: environment.randomId(),
      shortcutId: binding.id,
    });
  };

  const stop = () => {
    if (!started) return;
    started = false;
    active = false;
    bindings = [];
    for (const timeout of pendingTimers) clearTimeout(timeout);
    pendingTimers.clear();
    results.clear();
    environment.removeMessageListener(onMessage);
    environment.removeKeyListener(onKey);
  };

  return () => {
    if (!started && environment.framed) {
      started = true;
      environment.addMessageListener(onMessage);
      environment.addKeyListener(onKey);
    }
    return stop;
  };
}

const browserHandlers = new Map<FleetShortcutChildAction, FleetShortcutHandler>();
const startBrowserFleetShortcuts = createFleetShortcutController({
  framed: window.parent !== window,
  parent: window.parent,
  documentHidden: () => document.hidden,
  addMessageListener: (listener) => window.addEventListener("message", listener),
  removeMessageListener: (listener) => window.removeEventListener("message", listener),
  addKeyListener: (listener) => window.addEventListener("keydown", listener, { capture: true }),
  removeKeyListener: (listener) => window.removeEventListener("keydown", listener, true),
  // Gateway frame-ancestors and Fleet's exact WindowProxy/Origin checks complete this boundary.
  postParent: (message) => window.parent.postMessage(message, "*"),
  randomId: () => typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`,
}, browserHandlers);

export function startFleetShortcuts(): () => void {
  return startBrowserFleetShortcuts();
}

export function registerFleetShortcutHandler(
  action: FleetShortcutChildAction,
  handler: FleetShortcutHandler,
): () => void {
  browserHandlers.set(action, handler);
  return () => {
    if (browserHandlers.get(action) === handler) browserHandlers.delete(action);
  };
}
