export const FLEET_ACTIVITY_MESSAGE_TYPE = "herdr-web-remote:activity";
export const FLEET_ACTIVITY_MESSAGE_VERSION = 1;

export interface FleetActivityMessage {
  type: typeof FLEET_ACTIVITY_MESSAGE_TYPE;
  version: typeof FLEET_ACTIVITY_MESSAGE_VERSION;
  active: boolean;
}

type ActivityMessageListener = (event: MessageEvent<unknown>) => void;
type ActivityVisibilityListener = () => void;

export interface FleetActivityEnvironment {
  framed: boolean;
  parent: MessageEventSource | null;
  documentHidden(): boolean;
  addMessageListener(listener: ActivityMessageListener): void;
  removeMessageListener(listener: ActivityMessageListener): void;
  addVisibilityListener(listener: ActivityVisibilityListener): void;
  removeVisibilityListener(listener: ActivityVisibilityListener): void;
}

export interface FleetActivityController {
  active(): boolean;
  start(): () => void;
  subscribeActivation(listener: () => void): () => void;
}

const ACTIVITY_KEYS = new Set(["type", "version", "active"]);

export function isFleetActivityMessage(value: unknown): value is FleetActivityMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ACTIVITY_KEYS.has(key))) return false;
  return (
    record.type === FLEET_ACTIVITY_MESSAGE_TYPE
    && record.version === FLEET_ACTIVITY_MESSAGE_VERSION
    && typeof record.active === "boolean"
  );
}

/**
 * Owns whether read-only Pane requests represent a real operator observation.
 *
 * A top-level Collie page keeps the historical document-visibility behavior. A framed page starts
 * inactive and accepts activity only from its exact parent WindowProxy. The parent origin is
 * deliberately unavailable under Fleet's no-referrer policy, so Gateway frame-ancestors CSP is the
 * other half of this source check.
 */
export function createFleetActivityController(
  environment: FleetActivityEnvironment,
): FleetActivityController {
  let parentActive = !environment.framed;
  let effectiveActive = parentActive && !environment.documentHidden();
  let started = false;
  const activationListeners = new Set<() => void>();

  const refresh = () => {
    const next = parentActive && !environment.documentHidden();
    if (next === effectiveActive) return;
    const activated = !effectiveActive && next;
    effectiveActive = next;
    // Standalone visibility wakeups already belong to the ordinary poller. The extra immediate
    // signal exists only to close Fleet's hidden-frame race.
    if (activated && environment.framed) {
      for (const listener of activationListeners) listener();
    }
  };

  const onMessage: ActivityMessageListener = (event) => {
    if (
      !environment.framed
      || event.source !== environment.parent
      || !isFleetActivityMessage(event.data)
    ) {
      return;
    }
    parentActive = event.data.active;
    refresh();
  };
  const onVisibility = () => refresh();

  const stop = () => {
    if (!started) return;
    started = false;
    environment.removeMessageListener(onMessage);
    environment.removeVisibilityListener(onVisibility);
  };

  return {
    active: () => effectiveActive,
    start: () => {
      if (!started) {
        started = true;
        environment.addMessageListener(onMessage);
        environment.addVisibilityListener(onVisibility);
        refresh();
      }
      return stop;
    },
    subscribeActivation: (listener) => {
      activationListeners.add(listener);
      return () => activationListeners.delete(listener);
    },
  };
}

const browserActivity = createFleetActivityController({
  framed: window.parent !== window,
  parent: window.parent,
  documentHidden: () => document.hidden,
  addMessageListener: (listener) => window.addEventListener("message", listener),
  removeMessageListener: (listener) => window.removeEventListener("message", listener),
  addVisibilityListener: (listener) => document.addEventListener("visibilitychange", listener),
  removeVisibilityListener: (listener) => document.removeEventListener("visibilitychange", listener),
});

export function paneObservationActive(): boolean {
  return browserActivity.active();
}

export function startFleetActivity(): () => void {
  return browserActivity.start();
}

export function subscribeFleetActivation(listener: () => void): () => void {
  return browserActivity.subscribeActivation(listener);
}
