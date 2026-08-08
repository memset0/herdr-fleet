import { normalizeSession, SESSION_PARAM } from "./session";

export const FLEET_ROUTE_MESSAGE_TYPE = "herdr-web-remote:route";
export const FLEET_ROUTE_MESSAGE_VERSION = 1;

export type FleetRouteMessage =
  | {
      type: typeof FLEET_ROUTE_MESSAGE_TYPE;
      version: typeof FLEET_ROUTE_MESSAGE_VERSION;
      view: "home";
      session?: string;
    }
  | {
      type: typeof FLEET_ROUTE_MESSAGE_TYPE;
      version: typeof FLEET_ROUTE_MESSAGE_VERSION;
      view: "pane";
      paneId: string;
      session?: string;
    };

interface MessageTarget {
  postMessage(message: FleetRouteMessage, targetOrigin: string): void;
}

const PANE_ROUTE = /^\/pane\/([^/]+)(?:\/history)?\/?$/;
const PANE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function paneIdFrom(pathname: string): string | undefined {
  const encoded = PANE_ROUTE.exec(pathname)?.[1];
  if (!encoded) return undefined;
  try {
    const paneId = decodeURIComponent(encoded);
    return PANE_ID.test(paneId) ? paneId : undefined;
  } catch {
    return undefined;
  }
}

/** Collapse Collie's native routes into the two shareable Fleet states: homepage or Pane. */
export function fleetRouteMessage(pathname: string, search: string): FleetRouteMessage {
  const session = normalizeSession(new URLSearchParams(search).get(SESSION_PARAM));
  const paneId = paneIdFrom(pathname);
  if (paneId) {
    return {
      type: FLEET_ROUTE_MESSAGE_TYPE,
      version: FLEET_ROUTE_MESSAGE_VERSION,
      view: "pane",
      paneId,
      ...(session ? { session } : {}),
    };
  }
  return {
    type: FLEET_ROUTE_MESSAGE_TYPE,
    version: FLEET_ROUTE_MESSAGE_VERSION,
    view: "home",
    ...(session ? { session } : {}),
  };
}

/**
 * Send route metadata only while framed. The child cannot know Fleet's origin under the deliberate
 * no-referrer policy, so CSP limits who may frame it and Fleet validates both event source and exact
 * node origin before accepting the message.
 */
export function postFleetRoute(
  message: FleetRouteMessage,
  target: MessageTarget,
  framed: boolean,
): boolean {
  if (!framed) return false;
  target.postMessage(message, "*");
  return true;
}
