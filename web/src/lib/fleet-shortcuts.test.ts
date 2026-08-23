import {
  createFleetShortcutController,
  FLEET_SHORTCUT_COMMAND_TYPE,
  FLEET_SHORTCUT_CONFIG_TYPE,
  FLEET_SHORTCUT_INTENT_TYPE,
  FLEET_SHORTCUT_RESULT_TYPE,
  FLEET_SHORTCUT_VERSION,
  parseFleetShortcutCommand,
  parseFleetShortcutConfig,
  type FleetShortcutEnvironment,
  type FleetShortcutIntent,
  type FleetShortcutResult,
} from "./fleet-shortcuts";

class FakeShortcutEnvironment implements FleetShortcutEnvironment {
  readonly framed: boolean;
  readonly parent = {} as MessageEventSource;
  readonly sibling = {} as MessageEventSource;
  readonly messages = new Set<(event: MessageEvent<unknown>) => void>();
  readonly keys = new Set<(event: KeyboardEvent) => void>();
  readonly posted: Array<FleetShortcutIntent | FleetShortcutResult> = [];
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
  postParent = (message: FleetShortcutIntent | FleetShortcutResult) => this.posted.push(message);
  randomId = () => `intent_${String(++this.ids).padStart(8, "0")}`;

  message(source: MessageEventSource | null, data: unknown) {
    for (const listener of this.messages) listener({ source, data } as MessageEvent<unknown>);
  }

  key(init: KeyboardEventInit) {
    const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
    for (const listener of this.keys) listener(event);
    return event;
  }
}

const binding = {
  id: "resize-current-pane",
  code: "KeyS",
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

const config = {
  type: FLEET_SHORTCUT_CONFIG_TYPE,
  version: FLEET_SHORTCUT_VERSION,
  generation: 1,
  active: true,
  bindings: [binding],
};

const command = {
  type: FLEET_SHORTCUT_COMMAND_TYPE,
  version: FLEET_SHORTCUT_VERSION,
  requestId: "request_12345678",
  action: "resize-current-pane" as const,
};

describe("Fleet framed shortcut bridge", () => {
  it("parses only strict versioned configuration and allowlisted commands", () => {
    expect(parseFleetShortcutConfig(config)).toEqual(config);
    expect(parseFleetShortcutConfig({ ...config, version: 2 })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, url: "/pane/private" })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, bindings: [{ ...binding, code: "Key1" }] })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, bindings: [binding, { ...binding }] })).toBeNull();
    expect(parseFleetShortcutConfig({ ...config, bindings: [binding, { ...binding, id: "other" }] })).toBeNull();
    expect(parseFleetShortcutCommand(command)).toEqual(command);
    expect(parseFleetShortcutCommand({ ...command, action: "terminal-input" })).toBeNull();
    expect(parseFleetShortcutCommand({ ...command, cols: 120 })).toBeNull();
    expect(parseFleetShortcutCommand({ ...command, requestId: "short" })).toBeNull();
  });

  it("forwards only a selected exact chord id without raw key data", () => {
    const environment = new FakeShortcutEnvironment();
    const handler = vi.fn();
    const stop = createFleetShortcutController(environment, new Map([["resize-current-pane", handler]]))();
    environment.message(environment.sibling, config);
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);
    environment.message(environment.parent, config);

    expect(environment.key({ code: "KeyS", altKey: true, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(environment.key({ code: "KeyS", altKey: true, repeat: true }).defaultPrevented).toBe(false);
    const accepted = environment.key({ code: "KeyS", altKey: true });
    expect(accepted.defaultPrevented).toBe(true);
    expect(environment.posted).toEqual([{
      type: FLEET_SHORTCUT_INTENT_TYPE,
      version: FLEET_SHORTCUT_VERSION,
      intentId: "intent_00000001",
      shortcutId: "resize-current-pane",
    }]);
    expect(JSON.stringify(environment.posted)).not.toContain("KeyS");
    expect(JSON.stringify(environment.posted)).not.toContain("altKey");

    environment.hidden = true;
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);
    environment.hidden = false;
    environment.message(environment.parent, { ...config, generation: 2, active: false });
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);
    environment.message(environment.parent, { ...config, generation: 1, active: true });
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);

    stop();
    expect(environment.messages.size).toBe(0);
    expect(environment.keys.size).toBe(0);
  });

  it("does not install bridge behavior in standalone Collie", () => {
    const environment = new FakeShortcutEnvironment(false);
    createFleetShortcutController(environment, new Map())();
    expect(environment.messages.size).toBe(0);
    expect(environment.keys.size).toBe(0);
    environment.message(environment.parent, config);
    expect(environment.key({ code: "KeyS", altKey: true }).defaultPrevented).toBe(false);
  });

  it("runs an allowlisted handler once and deduplicates request ids", async () => {
    const environment = new FakeShortcutEnvironment();
    const handler = vi.fn(async () => {});
    createFleetShortcutController(environment, new Map([["resize-current-pane", handler]]))();
    environment.message(environment.parent, config);
    environment.message(environment.parent, command);
    environment.message(environment.parent, command);
    await vi.waitFor(() => expect(environment.posted).toHaveLength(2));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(environment.posted[0]).toEqual({
      type: FLEET_SHORTCUT_RESULT_TYPE,
      version: FLEET_SHORTCUT_VERSION,
      requestId: command.requestId,
      action: command.action,
      ok: true,
    });
    expect(environment.posted[1]).toEqual(environment.posted[0]);
  });

  it("fails closed for inactive, missing, throwing, and timed-out handlers", async () => {
    const missing = new FakeShortcutEnvironment();
    createFleetShortcutController(missing, new Map())();
    missing.message(missing.parent, config);
    missing.message(missing.parent, command);
    await vi.waitFor(() => expect(missing.posted).toHaveLength(1));
    expect(missing.posted[0]).toMatchObject({ ok: false, error: "Shortcut action is unavailable" });

    const throwing = new FakeShortcutEnvironment();
    createFleetShortcutController(throwing, new Map([["resize-current-pane", async () => { throw new Error(`bad\n${"x".repeat(400)}`); }]]))();
    throwing.message(throwing.parent, config);
    throwing.message(throwing.parent, command);
    await vi.waitFor(() => expect(throwing.posted).toHaveLength(1));
    expect((throwing.posted[0] as Extract<FleetShortcutResult, { ok: false }>).error.length).toBeLessThanOrEqual(240);
    expect((throwing.posted[0] as Extract<FleetShortcutResult, { ok: false }>).error).not.toContain("\n");

    const timeout = new FakeShortcutEnvironment();
    const stop = createFleetShortcutController(timeout, new Map([["resize-current-pane", () => new Promise(() => {})]]), 5)();
    timeout.message(timeout.parent, config);
    timeout.message(timeout.parent, command);
    await vi.waitFor(() => expect(timeout.posted).toHaveLength(1));
    expect(timeout.posted[0]).toMatchObject({ ok: false, error: "Shortcut action timed out" });
    stop();
    expect(timeout.messages.size).toBe(0);
    expect(timeout.keys.size).toBe(0);
  });
});
