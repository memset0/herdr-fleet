/**
 * Reaching a member's terminal, from the lead.
 *
 * The lead does not start anything here and does not know what it is talking to. It names a Pane on
 * one loopback endpoint the link projects, and the member's own service turns that Pane into that
 * member's terminal, each time it is asked. Nothing in this file produces, holds or forwards a
 * terminal id, and there is no shape here that could carry one.
 *
 * The member's service speaks the terminal server's own wire, so once the socket is open the lead's
 * client is the same client it uses for a local terminal. That is the whole reason the projection
 * carries a stream rather than a control channel with a second protocol on it.
 */

import type { Placement, PlacementEndpoint } from "./placement.ts";
import type { StartServer, TerminalServer } from "./session.ts";

/** The three things a member's terminal service answers, and the only three. */
export const PEER_ATTACH_PATH = "/terminal/attach";
export const PEER_CLOSE_PATH = "/terminal/close";
export const PEER_STATE_PATH = "/terminal/state";

/** A loopback authority, bracketed where the address requires it. */
export function peerAuthority(endpoint: PlacementEndpoint): string {
  return endpoint.host.includes(":") ? `[${endpoint.host}]:${endpoint.port}` : `${endpoint.host}:${endpoint.port}`;
}

export function peerAttachUrl(endpoint: PlacementEndpoint, paneId: string): string {
  const url = new URL(PEER_ATTACH_PATH, `http://${peerAuthority(endpoint)}`);
  url.protocol = "ws:";
  url.searchParams.set("pane", paneId);
  return url.toString();
}

export function peerControlUrl(endpoint: PlacementEndpoint, path: string): string {
  return new URL(path, `http://${peerAuthority(endpoint)}`).toString();
}

export interface PeerStartDeps {
  /** Injected so the close request can be driven in a test without a listener. */
  readonly request?: ((url: string, init: RequestInit) => Promise<void>) | undefined;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

/**
 * A member's terminal, as a server the Gateway can hold.
 *
 * Starting one costs nothing here: the member starts its terminal server when the stream arrives, so
 * this returns the address and lets the connection do the asking. What `stop` does is real, though —
 * it tells that member to stop the terminal server it started, because a session ending on the lead
 * must not leave a process attached to a Pane on a machine nobody is looking at.
 */
export function makePeerStartServer(deps: PeerStartDeps = {}): StartServer {
  const request =
    deps.request ?? ((url: string, init: RequestInit) => fetch(url, init).then(() => undefined));
  return async (placement: Placement): Promise<TerminalServer> => {
    if (placement.kind !== "peer") throw new Error("this starter serves member terminals only");
    const { endpoint, paneId, host } = placement;
    let stopped = false;
    return {
      endpoint: peerAttachUrl(endpoint, paneId),
      stop: () => {
        if (stopped) return;
        stopped = true;
        void Promise.resolve(
          request(peerControlUrl(endpoint, PEER_CLOSE_PATH), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pane: paneId }),
          }),
        ).catch(() => {
          // The member may already have stood its service down, which is the state this asks for.
          deps.log?.("terminal.peer-close-unanswered", { member: host });
        });
      },
    };
  };
}
