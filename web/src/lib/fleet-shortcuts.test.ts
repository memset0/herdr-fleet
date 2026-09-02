import {
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
} from "../../../shared/fleet-commands";
import {
  createFleetShortcutController,
  FLEET_SHORTCUT_COMMAND_TYPE,
  FLEET_SHORTCUT_CONFIG_TYPE,
  FLEET_SHORTCUT_READY_TYPE,
  FLEET_SHORTCUT_RESULT_TYPE,
  FLEET_SHORTCUT_VERSION,
  parseFleetShortcutCommand,
  parseFleetShortcutConfig,
  type FleetShortcutChildAction,
  type FleetShortcutConfig,
  type FleetShortcutEnvironment,
  type FleetShortcutIntent,
  type FleetShortcutReady,
  type FleetShortcutResult,
} from "./fleet-shortcuts";

class FakeShortcutEnvironment implements FleetShortcutEnvironment {
  readonly framed: boolean;
  readonly parent = {} as MessageEventSource;
  readonly sibling = {} as MessageEventSource;
  readonly messages = new Set<(event: MessageEvent<unknown>) => void>();
  readonly keys = new Set<(event: KeyboardEvent) => void>();
  readonly cancels = new Set<() => void>();
  readonly posted: Array<FleetShortcutIntent | FleetShortcutReady | FleetShortcutResult> = [];
  hidden = false;
  ids = 0;

  constructor(framed = true) {
    this.framed = framed;
  }

  documentHidden = () => this.hidden;
  addMessageListener = (listener: (event: MessageEvent<unknown>) => void) => this.messages.add(listener);
  removeMessageListener = (listener: (event: MessageEvent<unknown>) => void) => this.messages.delete(listener);
  addKeyListener = (listener: (event: KeyboardEvent) => void) => this.keys.add(listener);
  removeKeyListener = (listener: (event: KeyboardEvent) => void) => this.keys.delete(listener);
  addCancelListener = (listener: () => void) => this.cancels.add(listener);
  removeCancelListener = (listener: () => void) => this.cancels.delete(listener);
  postParent = (message: FleetShortcutIntent | FleetShortcutReady | FleetShortcutResult) => this.posted.push(message);
  randomId = () => `intent_${String(++this.ids).padStart(8, "0")}`;
  now = () => Date.now();

  message(source: MessageEventSource | null, data: unknown) {
    for (const listener of this.messages) listener({ source, data } as MessageEvent<unknown>);
  }

  key(init: KeyboardEventInit) {
    const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
    for (const listener of this.keys) listener(event);
    return event;
  }

  cancel() {
    for (const listener of this.cancels) listener();
  }
}

function bridgeConfig(generation = 1, active = true): FleetShortcutConfig {
  const parsed = parseFleetShortcutDocument(publicFleetShortcutDocument());
  return {
    type: FLEET_SHORTCUT_CONFIG_TYPE,
    version: FLEET_SHORTCUT_VERSION,
    generation,
    active,
    prefix: { ...parsed.prefix },
    bindings: parsed.bindings.map((binding) => ({
      commandId: binding.commandId,
      kind: binding.kind,
      ...binding.chord,
    })),
  };
}

const config = bridgeConfig();
const command = {
  type: FLEET_SHORTCUT_COMMAND_TYPE,
  version: FLEET_SHORTCUT_VERSION,
  generation: 1,
  requestId: "request_12345678",
  action: "fit-pane-width" as const,
};

describe("Fleet framed shortcut bridge", () => {
  it("parses only strict v2 configuration and fixed allowlisted commands", () => {
    expect(parseFleetShortcutConfig(config)).toEqual(config);
    expect(parseFleetShortcutConfig({ ...config, version: 1 })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, url: "/pane/private" })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, prefix: { ...config.prefix, code: "F12", label: "F12" } })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, bindings: [config.bindings[0], config.bindings[0]] })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, bindings: [{ ...config.bindings[0], commandId: "unknown" }] })).toBeNull();
    expect(parseFleetShortcutCommand(command)).toEqual(command);
    expect(parseFleetShortcutCommand({ ...command, action: "terminal-input" })).toBeNull();
    expect(parseFleetShortcutCommand({ ...command, keys: ["Escape"] })).toBeNull();
    expect(parseFleetShortcutCommand({ ...command, requestId: "short" })).toBeNull();
    expect(parseFleetShortcutCommand({ ...command, generation: -1 })).toBeNull();
  });

  it("recognizes direct and sequential prefix chords including Shift and Tab variants", () => {
    const environment = new FakeShortcutEnvironment();
    const stop = createFleetShortcutController(environment, new Map())();
    environment.message(environment.sibling, config);
    expect(environment.key({ code: "KeyP", ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    environment.message(environment.parent, config);

    expect(environment.key({ code: "KeyP", ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "KeyB", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "ShiftLeft", shiftKey: true }).defaultPrevented).toBe(false);
    expect(environment.key({ code: "KeyP", shiftKey: true }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "KeyB", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "Tab" }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "KeyB", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(environment.key({ code: "Tab", shiftKey: true }).defaultPrevented).toBe(true);

    expect(environment.posted[0]).toMatchObject({
      type: FLEET_SHORTCUT_READY_TYPE,
      generation: 1,
      actions: expect.arrayContaining(["fit-pane-width", "toggle-type-mode", "send-escape", "send-ctrl-c"]),
    });
    expect(environment.posted.slice(1)).toEqual([
      expect.objectContaining({ commandId: "open-command-palette", bindingLabel: "Ctrl+Shift+P", generation: 1 }),
      expect.objectContaining({ commandId: "rename-pane", bindingLabel: "Ctrl+B Shift+P", generation: 1 }),
      expect.objectContaining({ commandId: "next-pane-in-tab", bindingLabel: "Ctrl+B Tab", generation: 1 }),
      expect.objectContaining({ commandId: "previous-pane-in-tab", bindingLabel: "Ctrl+B Shift+Tab", generation: 1 }),
    ]);
    expect(JSON.stringify(environment.posted.slice(1))).not.toContain('"code"');
    expect(JSON.stringify(environment.posted)).not.toContain('"keys"');

    stop();
    expect(environment.messages.size).toBe(0);
    expect(environment.keys.size).toBe(0);
    expect(environment.cancels.size).toBe(0);
  });

  it("cancels prefix on context loss, hidden state, unsupported input, and newer generations", () => {
    const environment = new FakeShortcutEnvironment();
    createFleetShortcutController(environment, new Map())();
    environment.message(environment.parent, config);
    environment.key({ code: "KeyB", ctrlKey: true });
    environment.cancel();
    expect(environment.key({ code: "KeyS" }).defaultPrevented).toBe(false);

    environment.key({ code: "KeyB", ctrlKey: true });
    expect(environment.key({ code: "KeyQ" }).defaultPrevented).toBe(false);
    expect(environment.key({ code: "KeyS" }).defaultPrevented).toBe(false);

    environment.hidden = true;
    expect(environment.key({ code: "KeyJ", altKey: true }).defaultPrevented).toBe(false);
    environment.hidden = false;
    environment.message(environment.parent, bridgeConfig(2, false));
    expect(environment.key({ code: "KeyJ", altKey: true }).defaultPrevented).toBe(false);
    environment.message(environment.parent, config);
    expect(environment.key({ code: "KeyJ", altKey: true }).defaultPrevented).toBe(false);
  });

  it("does not install bridge behavior in standalone Collie", () => {
    const environment = new FakeShortcutEnvironment(false);
    createFleetShortcutController(environment, new Map())();
    expect(environment.messages.size).toBe(0);
    expect(environment.keys.size).toBe(0);
    environment.message(environment.parent, config);
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);
  });

  it("runs a fixed handler once and deduplicates correlated request ids", async () => {
    const environment = new FakeShortcutEnvironment();
    const handler = vi.fn(async () => {});
    createFleetShortcutController(environment, new Map([["fit-pane-width", handler]]))();
    environment.message(environment.parent, config);
    environment.message(environment.parent, command);
    environment.message(environment.parent, command);
    await vi.waitFor(() => expect(environment.posted.filter((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE)).toHaveLength(2));
    expect(handler).toHaveBeenCalledTimes(1);
    const results = environment.posted.filter((message): message is FleetShortcutResult => message.type === FLEET_SHORTCUT_RESULT_TYPE);
    expect(results[0]).toEqual({
      type: FLEET_SHORTCUT_RESULT_TYPE,
      version: FLEET_SHORTCUT_VERSION,
      generation: 1,
      requestId: command.requestId,
      action: command.action,
      ok: true,
    });
    expect(results[1]).toEqual(results[0]);
  });

  it("waits only briefly for a mounted handler and abandons it on route generation change", async () => {
    const environment = new FakeShortcutEnvironment();
    const handlers = new Map<FleetShortcutChildAction, () => void | Promise<void>>();
    const handler = vi.fn();
    createFleetShortcutController(environment, handlers, 1_000, 100)();
    environment.message(environment.parent, config);
    environment.message(environment.parent, command);
    setTimeout(() => handlers.set("fit-pane-width", handler), 10);
    await vi.waitFor(() => expect(environment.posted.some((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE)).toBe(true));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(environment.posted.find((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE)).toMatchObject({ ok: true, generation: 1 });

    environment.posted.length = 0;
    handlers.delete("fit-pane-width");
    const nextCommand = { ...command, requestId: "request_next_123", generation: 2 };
    environment.message(environment.parent, bridgeConfig(2));
    environment.message(environment.parent, nextCommand);
    setTimeout(() => {
      environment.message(environment.parent, bridgeConfig(3));
      handlers.set("fit-pane-width", handler);
    }, 10);
    await vi.waitFor(() => expect(environment.posted.some((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE && message.generation === 2)).toBe(true));
    expect(environment.posted.find((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE && message.generation === 2)).toMatchObject({ ok: false, error: "Shortcut action is unavailable", generation: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects arbitrary key payloads and bounds throwing or timed-out handler errors", async () => {
    const environment = new FakeShortcutEnvironment();
    const handlers = new Map<FleetShortcutChildAction, () => void | Promise<void>>([
      ["send-escape", async () => { throw new Error(`offline\n${"x".repeat(400)}`); }],
      ["send-enter", () => new Promise(() => {})],
    ]);
    createFleetShortcutController(environment, handlers, 5, 0)();
    environment.message(environment.parent, config);
    environment.message(environment.parent, { ...command, requestId: "request_escape_1", action: "send-escape" });
    environment.message(environment.parent, { ...command, requestId: "request_enter_12", action: "send-enter" });
    environment.message(environment.parent, { ...command, requestId: "request_keys_123", action: "send-enter", keys: ["x"] });
    await vi.waitFor(() => expect(environment.posted.filter((message) => message.type === FLEET_SHORTCUT_RESULT_TYPE)).toHaveLength(2));
    const failures = environment.posted.filter((message): message is FleetShortcutResult => message.type === FLEET_SHORTCUT_RESULT_TYPE);
    expect(failures.every((result) => !result.ok)).toBe(true);
    for (const result of failures) {
      if (!result.ok) {
        expect(result.error.length).toBeLessThanOrEqual(240);
        expect(result.error).not.toContain("\n");
      }
    }
  });
});
