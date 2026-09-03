import {
  createFleetShortcutRecognizer,
  fleetChordSignature,
  isFleetCommandId,
  parseFleetKeyChord,
  type FleetEffectiveBinding,
  type FleetKeyChord,
  type FleetShortcutConfiguration,
  type FleetShortcutRecognizer,
} from "../../../../shared/fleet/index.ts";

export const FLEET_SHORTCUT_CONFIG_TYPE = "herdr-web-remote:shortcut-config";
export const FLEET_SHORTCUT_INTENT_TYPE = "herdr-web-remote:shortcut-intent";
export const FLEET_SHORTCUT_COMMAND_TYPE = "herdr-web-remote:shortcut-command";
export const FLEET_SHORTCUT_RESULT_TYPE = "herdr-web-remote:shortcut-result";
export const FLEET_SHORTCUT_READY_TYPE = "herdr-web-remote:shortcut-ready";
export const FLEET_SHORTCUT_VERSION = 2;

export type FleetShortcutChildAction =
  | "fit-pane-width"
  | "toggle-type-mode"
  | "send-escape"
  | "send-enter"
  | "send-up-arrow"
  | "send-down-arrow"
  | "send-left-arrow"
  | "send-right-arrow"
  | "send-space"
  | "send-ctrl-c";

export interface FleetShortcutWireChord {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  label: string;
}

export interface FleetShortcutBinding extends FleetShortcutWireChord {
  commandId: string;
  kind: "direct" | "prefix";
}

export interface FleetShortcutConfig {
  type: typeof FLEET_SHORTCUT_CONFIG_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  generation: number;
  active: boolean;
  prefix: FleetShortcutWireChord;
  bindings: FleetShortcutBinding[];
}

export interface FleetShortcutIntent {
  type: typeof FLEET_SHORTCUT_INTENT_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  generation: number;
  intentId: string;
  commandId: string;
  bindingLabel: string;
}

export interface FleetShortcutReady {
  type: typeof FLEET_SHORTCUT_READY_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  generation: number;
  commands: string[];
  actions: FleetShortcutChildAction[];
}

export interface FleetShortcutCommand {
  type: typeof FLEET_SHORTCUT_COMMAND_TYPE;
  version: typeof FLEET_SHORTCUT_VERSION;
  generation: number;
  requestId: string;
  action: FleetShortcutChildAction;
}

export type FleetShortcutResult =
  | {
      type: typeof FLEET_SHORTCUT_RESULT_TYPE;
      version: typeof FLEET_SHORTCUT_VERSION;
      generation: number;
      requestId: string;
      action: FleetShortcutChildAction;
      ok: true;
    }
  | {
      type: typeof FLEET_SHORTCUT_RESULT_TYPE;
      version: typeof FLEET_SHORTCUT_VERSION;
      generation: number;
      requestId: string;
      action: FleetShortcutChildAction;
      ok: false;
      error: string;
    };

type MessageListener = (event: MessageEvent<unknown>) => void;
type KeyListener = (event: KeyboardEvent) => void;
type CancelListener = () => void;

export interface FleetShortcutEnvironment {
  framed: boolean;
  parent: MessageEventSource | null;
  documentHidden(): boolean;
  addMessageListener(listener: MessageListener): void;
  removeMessageListener(listener: MessageListener): void;
  addKeyListener(listener: KeyListener): void;
  removeKeyListener(listener: KeyListener): void;
  addCancelListener(listener: CancelListener): void;
  removeCancelListener(listener: CancelListener): void;
  postParent(
    message: FleetShortcutIntent | FleetShortcutReady | FleetShortcutResult,
  ): void;
  randomId(): string;
  now(): number;
}

export type FleetShortcutHandler = () => void | Promise<void>;

const CORRELATION_ID = /^[A-Za-z0-9_-]{8,128}$/;
const CODE =
  /^(?:Key[A-Z]|Digit[0-9]|Tab|Minus|Slash|Escape|Enter|Space|Arrow(?:Up|Down|Left|Right))$/;
const MAX_BINDINGS = 256;
const MAX_RESULTS = 64;
const COMMAND_TIMEOUT_MS = 15_000;
const CONFIG_KEYS = new Set([
  "type",
  "version",
  "generation",
  "active",
  "prefix",
  "bindings",
]);
const CHORD_KEYS = new Set([
  "code",
  "altKey",
  "ctrlKey",
  "metaKey",
  "shiftKey",
  "label",
]);
const BINDING_KEYS = new Set([...CHORD_KEYS, "commandId", "kind"]);
const COMMAND_KEYS = new Set([
  "type",
  "version",
  "generation",
  "requestId",
  "action",
]);
const CHILD_ACTIONS = new Set<FleetShortcutChildAction>([
  "fit-pane-width",
  "toggle-type-mode",
  "send-escape",
  "send-enter",
  "send-up-arrow",
  "send-down-arrow",
  "send-left-arrow",
  "send-right-arrow",
  "send-space",
  "send-ctrl-c",
]);

function exactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseWireChord(value: unknown): FleetShortcutWireChord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, CHORD_KEYS) || !CODE.test(String(record.code)))
    return null;
  if (
    [record.altKey, record.ctrlKey, record.metaKey, record.shiftKey].some(
      (part) => typeof part !== "boolean",
    )
  )
    return null;
  if (
    typeof record.label !== "string" ||
    !record.label ||
    record.label.length > 64
  )
    return null;
  try {
    const parsed = parseFleetKeyChord(record.label);
    if (
      fleetChordSignature(parsed) !==
      fleetChordSignature(record as unknown as FleetShortcutWireChord)
    )
      return null;
  } catch {
    return null;
  }
  return record as unknown as FleetShortcutWireChord;
}

function parseBinding(value: unknown): FleetShortcutBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, BINDING_KEYS) || !isFleetCommandId(record.commandId))
    return null;
  if (record.kind !== "direct" && record.kind !== "prefix") return null;
  const chord = Object.fromEntries(
    Object.entries(record).filter(([key]) => CHORD_KEYS.has(key)),
  );
  return parseWireChord(chord)
    ? (record as unknown as FleetShortcutBinding)
    : null;
}

export function parseFleetShortcutConfig(
  value: unknown,
): FleetShortcutConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, CONFIG_KEYS) ||
    record.type !== FLEET_SHORTCUT_CONFIG_TYPE ||
    record.version !== FLEET_SHORTCUT_VERSION ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 0 ||
    typeof record.active !== "boolean" ||
    !Array.isArray(record.bindings) ||
    record.bindings.length > MAX_BINDINGS
  )
    return null;
  const prefix = parseWireChord(record.prefix);
  const bindings = record.bindings.map(parseBinding);
  if (!prefix || bindings.some((binding) => !binding)) return null;
  const valid = bindings as FleetShortcutBinding[];
  const signatures = valid.map(
    (binding) => `${binding.kind}|${fleetChordSignature(binding)}`,
  );
  if (new Set(signatures).size !== signatures.length) return null;
  if (
    valid.some(
      (binding) =>
        binding.kind === "direct" &&
        fleetChordSignature(binding) === fleetChordSignature(prefix),
    )
  )
    return null;
  return { ...record, prefix, bindings: valid } as FleetShortcutConfig;
}

export function parseFleetShortcutCommand(
  value: unknown,
): FleetShortcutCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return exactKeys(record, COMMAND_KEYS) &&
    record.type === FLEET_SHORTCUT_COMMAND_TYPE &&
    record.version === FLEET_SHORTCUT_VERSION &&
    Number.isSafeInteger(record.generation) &&
    Number(record.generation) >= 0 &&
    typeof record.requestId === "string" &&
    CORRELATION_ID.test(record.requestId) &&
    typeof record.action === "string" &&
    CHILD_ACTIONS.has(record.action as FleetShortcutChildAction)
    ? (record as unknown as FleetShortcutCommand)
    : null;
}

function recognizerConfiguration(
  config: FleetShortcutConfig,
): FleetShortcutConfiguration {
  const prefix: FleetKeyChord = { ...config.prefix };
  const bindings: FleetEffectiveBinding[] = config.bindings.map((binding) => ({
    commandId: binding.commandId,
    kind: binding.kind,
    chord: {
      code: binding.code,
      altKey: binding.altKey,
      ctrlKey: binding.ctrlKey,
      metaKey: binding.metaKey,
      shiftKey: binding.shiftKey,
      label: binding.label,
    },
    label:
      binding.kind === "prefix" ? `Prefix ${binding.label}` : binding.label,
  }));
  const bindingsByCommand: Record<string, FleetEffectiveBinding[]> = {};
  for (const binding of bindings)
    (bindingsByCommand[binding.commandId] ??= []).push(binding);
  return { schemaVersion: 1, prefix, bindings, bindingsByCommand };
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Shortcut unavailable"
  ).slice(0, 240);
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
  let recognizer: FleetShortcutRecognizer | null = null;
  const results = new Map<string, Promise<FleetShortcutResult>>();
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  const contextActive = (expectedGeneration: number): boolean =>
    started &&
    active &&
    generation === expectedGeneration &&
    !environment.documentHidden();

  const waitForHandler = async (
    action: FleetShortcutChildAction,
    expectedGeneration: number,
  ): Promise<FleetShortcutHandler | undefined> => {
    const deadline =
      environment.now() + Math.max(0, Math.min(handlerWaitMs, 5_000));
    let handler = contextActive(expectedGeneration)
      ? handlers.get(action)
      : undefined;
    while (
      !handler &&
      contextActive(expectedGeneration) &&
      environment.now() < deadline
    ) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(
          () => {
            pendingTimers.delete(timeout);
            resolve();
          },
          Math.min(25, Math.max(1, deadline - environment.now())),
        );
        pendingTimers.add(timeout);
      });
      if (!contextActive(expectedGeneration)) return undefined;
      handler = handlers.get(action);
    }
    return contextActive(expectedGeneration) ? handler : undefined;
  };

  const runCommand = async (
    command: FleetShortcutCommand,
  ): Promise<FleetShortcutResult> => {
    const handler = await waitForHandler(command.action, command.generation);
    if (!handler || !contextActive(command.generation)) {
      return {
        type: FLEET_SHORTCUT_RESULT_TYPE,
        version: FLEET_SHORTCUT_VERSION,
        generation: command.generation,
        requestId: command.requestId,
        action: command.action,
        ok: false,
        error: "Shortcut action is unavailable",
      };
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
      const timeout = setTimeout(
        () =>
          finish({
            type: FLEET_SHORTCUT_RESULT_TYPE,
            version: FLEET_SHORTCUT_VERSION,
            generation: command.generation,
            requestId: command.requestId,
            action: command.action,
            ok: false,
            error: "Shortcut action timed out",
          }),
        Math.max(1, Math.min(commandTimeoutMs, COMMAND_TIMEOUT_MS)),
      );
      pendingTimers.add(timeout);
      void Promise.resolve()
        .then(() => {
          if (!contextActive(command.generation))
            throw new Error("Shortcut action is unavailable");
          return handler();
        })
        .then(
          () =>
            finish({
              type: FLEET_SHORTCUT_RESULT_TYPE,
              version: FLEET_SHORTCUT_VERSION,
              generation: command.generation,
              requestId: command.requestId,
              action: command.action,
              ok: true,
            }),
          (error) =>
            finish({
              type: FLEET_SHORTCUT_RESULT_TYPE,
              version: FLEET_SHORTCUT_VERSION,
              generation: command.generation,
              requestId: command.requestId,
              action: command.action,
              ok: false,
              error: publicError(error),
            }),
        );
    });
  };

  const onMessage: MessageListener = (event) => {
    if (!started || !environment.framed || event.source !== environment.parent)
      return;
    const config = parseFleetShortcutConfig(event.data);
    if (config) {
      if (config.generation < generation) return;
      recognizer?.cancel();
      generation = config.generation;
      active = config.active;
      recognizer = config.active
        ? createFleetShortcutRecognizer(
            recognizerConfiguration(config),
            environment.now,
          )
        : null;
      environment.postParent({
        type: FLEET_SHORTCUT_READY_TYPE,
        version: FLEET_SHORTCUT_VERSION,
        generation,
        commands: [
          ...new Set(config.bindings.map((binding) => binding.commandId)),
        ],
        actions: [...CHILD_ACTIONS],
      });
      return;
    }
    const command = parseFleetShortcutCommand(event.data);
    if (!command || command.generation !== generation) return;
    let result = results.get(command.requestId);
    if (!result) {
      result = runCommand(command);
      results.set(command.requestId, result);
      if (results.size > MAX_RESULTS)
        results.delete(results.keys().next().value as string);
    }
    void result.then((message) => {
      if (started) environment.postParent(message);
    });
  };

  const onKey: KeyListener = (event) => {
    if (!started || !active || !recognizer || environment.documentHidden())
      return;
    const result = recognizer.handle(event);
    if (result.kind === "prefix") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (result.kind !== "command") return;
    event.preventDefault();
    event.stopPropagation();
    environment.postParent({
      type: FLEET_SHORTCUT_INTENT_TYPE,
      version: FLEET_SHORTCUT_VERSION,
      generation,
      intentId: environment.randomId(),
      commandId: result.commandId,
      bindingLabel: result.bindingLabel,
    });
  };

  const onCancel = () => recognizer?.cancel();

  const stop = () => {
    if (!started) return;
    started = false;
    active = false;
    recognizer?.cancel();
    recognizer = null;
    for (const timeout of pendingTimers) clearTimeout(timeout);
    pendingTimers.clear();
    results.clear();
    environment.removeMessageListener(onMessage);
    environment.removeKeyListener(onKey);
    environment.removeCancelListener(onCancel);
  };

  return () => {
    if (!started && environment.framed) {
      started = true;
      environment.addMessageListener(onMessage);
      environment.addKeyListener(onKey);
      environment.addCancelListener(onCancel);
    }
    return stop;
  };
}

const browserHandlers = new Map<
  FleetShortcutChildAction,
  FleetShortcutHandler
>();
const addBrowserCancelListener = (listener: CancelListener) => {
  window.addEventListener("blur", listener);
  document.addEventListener("visibilitychange", listener);
};
const removeBrowserCancelListener = (listener: CancelListener) => {
  window.removeEventListener("blur", listener);
  document.removeEventListener("visibilitychange", listener);
};
const startBrowserFleetShortcuts = createFleetShortcutController(
  {
    framed: window.parent !== window,
    parent: window.parent,
    documentHidden: () => document.hidden,
    addMessageListener: (listener) =>
      window.addEventListener("message", listener),
    removeMessageListener: (listener) =>
      window.removeEventListener("message", listener),
    addKeyListener: (listener) =>
      window.addEventListener("keydown", listener, { capture: true }),
    removeKeyListener: (listener) =>
      window.removeEventListener("keydown", listener, true),
    addCancelListener: addBrowserCancelListener,
    removeCancelListener: removeBrowserCancelListener,
    // Gateway frame-ancestors and Fleet's exact WindowProxy/Origin checks complete this boundary.
    postParent: (message) => window.parent.postMessage(message, "*"),
    randomId: () =>
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`,
    now: Date.now,
  },
  browserHandlers,
);

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
