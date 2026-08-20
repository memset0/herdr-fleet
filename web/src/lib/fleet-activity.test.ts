import {
  createFleetActivityController,
  FLEET_ACTIVITY_MESSAGE_TYPE,
  FLEET_ACTIVITY_MESSAGE_VERSION,
  isFleetActivityMessage,
  type FleetActivityEnvironment,
} from "./fleet-activity";

class FakeActivityEnvironment implements FleetActivityEnvironment {
  readonly framed: boolean;
  readonly parent = {} as MessageEventSource;
  readonly sibling = {} as MessageEventSource;
  hidden = false;
  messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
  visibilityListeners = new Set<() => void>();

  constructor(framed: boolean) {
    this.framed = framed;
  }

  documentHidden = () => this.hidden;
  addMessageListener = (listener: (event: MessageEvent<unknown>) => void) => {
    this.messageListeners.add(listener);
  };
  removeMessageListener = (listener: (event: MessageEvent<unknown>) => void) => {
    this.messageListeners.delete(listener);
  };
  addVisibilityListener = (listener: () => void) => {
    this.visibilityListeners.add(listener);
  };
  removeVisibilityListener = (listener: () => void) => {
    this.visibilityListeners.delete(listener);
  };

  message(source: MessageEventSource | null, data: unknown) {
    for (const listener of this.messageListeners) {
      listener({ source, data } as MessageEvent<unknown>);
    }
  }

  visibility(hidden: boolean) {
    this.hidden = hidden;
    for (const listener of this.visibilityListeners) listener();
  }
}

const activity = (active: boolean) => ({
  type: FLEET_ACTIVITY_MESSAGE_TYPE,
  version: FLEET_ACTIVITY_MESSAGE_VERSION,
  active,
});

describe("Fleet frame activity", () => {
  it("keeps a visible standalone Collie active without a Fleet message", () => {
    const environment = new FakeActivityEnvironment(false);
    const controller = createFleetActivityController(environment);
    controller.start();

    expect(controller.active()).toBe(true);
    environment.visibility(true);
    expect(controller.active()).toBe(false);
    environment.visibility(false);
    expect(controller.active()).toBe(true);
  });

  it("makes a framed Collie fail closed until its exact parent activates it", () => {
    const environment = new FakeActivityEnvironment(true);
    const controller = createFleetActivityController(environment);
    const activated = vi.fn();
    controller.subscribeActivation(activated);
    controller.start();

    expect(controller.active()).toBe(false);
    environment.message(environment.parent, activity(true));
    expect(controller.active()).toBe(true);
    expect(activated).toHaveBeenCalledTimes(1);

    environment.message(environment.parent, activity(true));
    expect(activated).toHaveBeenCalledTimes(1);
    environment.message(environment.parent, activity(false));
    environment.message(environment.parent, activity(true));
    expect(activated).toHaveBeenCalledTimes(2);
  });

  it("ignores sibling, malformed, unsupported, and over-shaped messages", () => {
    const environment = new FakeActivityEnvironment(true);
    const controller = createFleetActivityController(environment);
    controller.start();

    environment.message(environment.sibling, activity(true));
    environment.message(environment.parent, null);
    environment.message(environment.parent, { ...activity(true), version: 2 });
    environment.message(environment.parent, { ...activity(true), paneId: "w1:p1" });
    expect(controller.active()).toBe(false);
  });

  it("combines accepted parent state with child document visibility", () => {
    const environment = new FakeActivityEnvironment(true);
    const controller = createFleetActivityController(environment);
    const activated = vi.fn();
    controller.subscribeActivation(activated);
    controller.start();

    environment.message(environment.parent, activity(true));
    environment.visibility(true);
    expect(controller.active()).toBe(false);
    environment.message(environment.parent, activity(true));
    expect(controller.active()).toBe(false);
    environment.visibility(false);
    expect(controller.active()).toBe(true);
    expect(activated).toHaveBeenCalledTimes(2);
  });

  it("removes browser listeners when its owner unmounts", () => {
    const environment = new FakeActivityEnvironment(true);
    const controller = createFleetActivityController(environment);
    const stop = controller.start();
    expect(environment.messageListeners.size).toBe(1);
    expect(environment.visibilityListeners.size).toBe(1);
    stop();
    expect(environment.messageListeners.size).toBe(0);
    expect(environment.visibilityListeners.size).toBe(0);
  });

  it("accepts only the bounded versioned activity schema", () => {
    expect(isFleetActivityMessage(activity(true))).toBe(true);
    expect(isFleetActivityMessage({ ...activity(false), route: "/pane/w1:p1" })).toBe(false);
    expect(isFleetActivityMessage({ ...activity(true), active: 1 })).toBe(false);
  });
});
