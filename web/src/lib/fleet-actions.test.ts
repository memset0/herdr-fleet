import {
  createFleetActionController,
  FLEET_ACTION_PROBE_TYPE,
  FLEET_ACTION_READY_TYPE,
  FLEET_ACTION_REQUEST_TYPE,
  FLEET_ACTION_RESULT_TYPE,
  FLEET_ACTION_VERSION,
  isFleetActionProbe,
  parseFleetActionRequest,
  type FleetActionApi,
  type FleetActionEnvironment,
  type FleetActionReady,
  type FleetActionResult,
} from "./fleet-actions";

class FakeActionEnvironment implements FleetActionEnvironment {
  readonly framed: boolean;
  readonly parent = {} as MessageEventSource;
  readonly sibling = {} as MessageEventSource;
  readonly posted: Array<FleetActionReady | FleetActionResult> = [];
  readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(framed = true) {
    this.framed = framed;
  }

  addMessageListener = (listener: (event: MessageEvent<unknown>) => void) => this.listeners.add(listener);
  removeMessageListener = (listener: (event: MessageEvent<unknown>) => void) => this.listeners.delete(listener);
  postParent = (message: FleetActionReady | FleetActionResult) => this.posted.push(message);

  message(source: MessageEventSource | null, data: unknown) {
    for (const listener of this.listeners) listener({ source, data } as MessageEvent<unknown>);
  }
}

const requestId = "request_12345678";
const probe = {
  type: FLEET_ACTION_PROBE_TYPE,
  version: FLEET_ACTION_VERSION,
  requestId,
};
const createRequest = {
  type: FLEET_ACTION_REQUEST_TYPE,
  version: FLEET_ACTION_VERSION,
  requestId,
  action: "create-tab" as const,
  workspaceId: "w1",
  session: "demo",
};

function client(overrides: Partial<FleetActionApi> = {}): FleetActionApi {
  return {
    createWorkspace: vi.fn(async () => ({
      ok: true as const,
      pane: { paneId: "w2:p1", workspaceId: "w2", workspaceLabel: "Space 2", tabId: "w2:t1", cwd: "/tmp" },
    })),
    createTab: vi.fn(async () => ({
      ok: true as const,
      pane: { paneId: "w1:p2", workspaceId: "w1", workspaceLabel: "Demo", tabId: "w1:t2", cwd: "/tmp" },
    })),
    renameTab: vi.fn(async () => ({ ok: true as const })),
    renamePane: vi.fn(async () => ({ ok: true as const })),
    closeTab: vi.fn(async () => ({ ok: true as const })),
    closePane: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe("Fleet sidebar child actions", () => {
  it("accepts only strict, bounded probe and action shapes", () => {
    expect(isFleetActionProbe(probe)).toBe(true);
    expect(isFleetActionProbe({ ...probe, route: "/pane/w1:p1" })).toBe(false);
    expect(parseFleetActionRequest(createRequest)).toEqual(createRequest);
    expect(parseFleetActionRequest({ ...createRequest, url: "/api/tab" })).toBeNull();
    expect(parseFleetActionRequest({ ...createRequest, workspaceId: "../../private" })).toBeNull();
    expect(parseFleetActionRequest({ ...createRequest, session: " bad " })).toBeNull();
    expect(parseFleetActionRequest({ ...createRequest, action: "fetch" })).toBeNull();
    expect(parseFleetActionRequest({
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
      action: "rename-tab",
      tabId: "w1:t1",
      label: "   ",
    })).toBeNull();
    expect(parseFleetActionRequest({
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
      action: "rename-pane",
      paneId: "w1:p1",
      label: "",
    })).not.toBeNull();
    expect(parseFleetActionRequest({
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
      action: "close-tab",
      tabId: "w1:t1",
      session: "demo",
    })).not.toBeNull();
    expect(parseFleetActionRequest({
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
      action: "close-pane",
      paneId: "w1:p1",
      body: {},
    })).toBeNull();
  });

  it("answers probes and maps create to the existing session-scoped API", async () => {
    const environment = new FakeActionEnvironment();
    const api = client();
    const start = createFleetActionController(environment, api);
    const stop = start();

    environment.message(environment.parent, probe);
    expect(environment.posted).toEqual([{
      type: FLEET_ACTION_READY_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
    }]);

    environment.message(environment.parent, createRequest);
    await vi.waitFor(() => expect(environment.posted).toHaveLength(2));
    expect(api.createTab).toHaveBeenCalledWith("w1", {}, "demo");
    expect(environment.posted[1]).toEqual({
      type: FLEET_ACTION_RESULT_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId,
      action: "create-tab",
      ok: true,
      pane: { paneId: "w1:p2", workspaceId: "w1", tabId: "w1:t2" },
    });

    stop();
    expect(environment.listeners.size).toBe(0);
  });

  it("maps Host create to the existing primary-session workspace API", async () => {
    const environment = new FakeActionEnvironment();
    const api = client();
    createFleetActionController(environment, api)();
    environment.message(environment.parent, {
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "create_space_123",
      action: "create-workspace",
    });

    await vi.waitFor(() => expect(environment.posted).toHaveLength(1));
    expect(api.createWorkspace).toHaveBeenCalledWith({}, undefined);
    expect(environment.posted[0]).toEqual({
      type: FLEET_ACTION_RESULT_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "create_space_123",
      action: "create-workspace",
      ok: true,
      pane: { paneId: "w2:p1", workspaceId: "w2", tabId: "w2:t1" },
    });
  });

  it("ignores sibling, standalone, malformed, and unsupported requests", async () => {
    const environment = new FakeActionEnvironment();
    const api = client();
    createFleetActionController(environment, api)();
    environment.message(environment.sibling, createRequest);
    environment.message(environment.parent, { ...createRequest, version: 2 });
    environment.message(environment.parent, { ...createRequest, body: { arbitrary: true } });

    const standalone = new FakeActionEnvironment(false);
    createFleetActionController(standalone, api)();
    standalone.message(standalone.parent, createRequest);
    await Promise.resolve();

    expect(api.createTab).not.toHaveBeenCalled();
    expect(environment.posted).toEqual([]);
    expect(standalone.posted).toEqual([]);
  });

  it("deduplicates a repeated request id while returning the same result", async () => {
    let finish: ((value: { ok: true; pane: { paneId: string; workspaceId: string; workspaceLabel: string; tabId: string; cwd: string } }) => void) | undefined;
    const createTab = vi.fn(() => new Promise<{ ok: true; pane: { paneId: string; workspaceId: string; workspaceLabel: string; tabId: string; cwd: string } }>((resolve) => {
      finish = resolve;
    }));
    const environment = new FakeActionEnvironment();
    const api = client({ createTab });
    createFleetActionController(environment, api)();

    environment.message(environment.parent, createRequest);
    environment.message(environment.parent, createRequest);
    expect(createTab).toHaveBeenCalledTimes(1);
    finish?.({ pane: { paneId: "w1:p3", workspaceId: "w1", workspaceLabel: "Demo", tabId: "w1:t3", cwd: "/tmp" }, ok: true });
    await vi.waitFor(() => expect(environment.posted).toHaveLength(2));
    expect(environment.posted[0]).toEqual(environment.posted[1]);
  });

  it("maps rename variants and bounds thrown errors before posting them", async () => {
    const environment = new FakeActionEnvironment();
    const api = client({
      renameTab: vi.fn(async () => ({ ok: true as const })),
      renamePane: vi.fn(async () => { throw new Error(`offline\n${"x".repeat(400)}`); }),
    });
    createFleetActionController(environment, api)();
    environment.message(environment.parent, {
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "rename_tab_1234",
      action: "rename-tab",
      tabId: "w1:t1",
      label: " Main ",
    });
    environment.message(environment.parent, {
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "rename_pane_123",
      action: "rename-pane",
      paneId: "w1:p1",
      label: "",
    });
    await vi.waitFor(() => expect(environment.posted).toHaveLength(2));
    expect(api.renameTab).toHaveBeenCalledWith("w1:t1", "Main", undefined);
    expect(api.renamePane).toHaveBeenCalledWith("w1:p1", "", undefined);
    const failure = environment.posted.find((entry) => entry.requestId === "rename_pane_123") as FleetActionResult;
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.length).toBeLessThanOrEqual(240);
      expect(failure.error).not.toContain("\n");
    }
  });

  it("maps close variants to the exact native API and deduplicates destructive requests", async () => {
    let finish: ((value: { ok: true }) => void) | undefined;
    const closeTab = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
    const closePane = vi.fn(async () => ({ ok: true as const }));
    const environment = new FakeActionEnvironment();
    const api = client({ closeTab, closePane });
    createFleetActionController(environment, api)();
    const tabRequest = {
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "close_tab_12345",
      action: "close-tab" as const,
      tabId: "w1:t1",
      session: "demo",
    };
    environment.message(environment.parent, tabRequest);
    environment.message(environment.parent, tabRequest);
    expect(closeTab).toHaveBeenCalledTimes(1);
    expect(closeTab).toHaveBeenCalledWith("w1:t1", "demo");
    finish?.({ ok: true });
    await vi.waitFor(() => expect(environment.posted).toHaveLength(2));
    expect(environment.posted[0]).toEqual(environment.posted[1]);
    expect(environment.posted[0]).toEqual({
      type: FLEET_ACTION_RESULT_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "close_tab_12345",
      action: "close-tab",
      ok: true,
    });

    environment.message(environment.parent, {
      type: FLEET_ACTION_REQUEST_TYPE,
      version: FLEET_ACTION_VERSION,
      requestId: "close_pane_1234",
      action: "close-pane",
      paneId: "w1:p1",
    });
    await vi.waitFor(() => expect(environment.posted).toHaveLength(3));
    expect(closePane).toHaveBeenCalledWith("w1:p1", undefined);
  });
});
