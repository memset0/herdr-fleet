/**
 * Everything the lead needs to serve terminals, composed once.
 *
 * The pieces below this are deliberately unaware of each other: admission decides, resolution names a
 * terminal, the session set holds one, the connection speaks to a browser, and the spawn layer starts
 * a process. This is the only file that knows all five exist, which is what keeps each of them
 * testable without a socket, a process or a clock.
 *
 * It also answers, in one place, the question every one of them defers: what the numbers are.
 */

import { TerminalConnection, TerminalConnections, type BrowserSocket, type ConnectionSession } from "./connection.ts";
import type { TerminalTarget } from "./admit.ts";
import type { Resolution } from "./resolve.ts";
import { TerminalSessions, type SessionLimits } from "./session.ts";
import { findTerminalTools, makeConnectUpstream, makeSocketDirectory, makeStartServer, type TerminalTools } from "./spawn.ts";

/**
 * The lead's terminal numbers, stated once.
 *
 * **The grace period is twenty seconds.** It is not a cache — attaching was measured at a tenth to a
 * quarter of a second — so its length is not chosen to save that. It is chosen against the cost of
 * holding it: a held session is holding the Pane's geometry, and the Pane belongs to whoever is at
 * that machine's keyboard. Twenty seconds covers switching Panes and coming back; a minute would
 * leave somebody else's terminal at a phone's size while they worked in it.
 *
 * **Four sessions.** Only one is attached at a time and the rest are inside their grace period, so
 * this is a bound on how many terminal servers a burst of Pane-switching can leave running, not a
 * working set anybody reaches.
 *
 * **Two hundred and fifty-six kilobytes retained.** The largest geometry this surface admits is 500
 * by 200 cells, and one full repaint of it with attributes is comfortably inside this. That is the
 * size the window has to be: it exists to redraw a screen for a returning browser, once. It is not
 * scrollback and a larger number would start to make it one.
 */
export const FLEET_TERMINAL_LIMITS: SessionLimits = {
  graceMs: 20_000,
  maxSessions: 4,
  retainBytes: 256 * 1024,
};

/** The bounds those numbers are validated against, so a tuned value cannot become a broken one. */
export const FLEET_TERMINAL_LIMIT_BOUNDS = {
  graceMs: { minimum: 1_000, maximum: 600_000 },
  maxSessions: { minimum: 1, maximum: 32 },
  retainBytes: { minimum: 4_096, maximum: 4 * 1024 * 1024 },
} as const;

export function validateLimits(limits: SessionLimits): SessionLimits {
  for (const field of ["graceMs", "maxSessions", "retainBytes"] as const) {
    const { minimum, maximum } = FLEET_TERMINAL_LIMIT_BOUNDS[field];
    const value = limits[field];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(`terminal ${field} must be an integer between ${minimum} and ${maximum}`);
    }
  }
  return limits;
}

/** How often a connection's session is re-checked against the store it was admitted by. */
export const SESSION_SWEEP_MS = 60_000;

export interface TerminalServiceDeps {
  readonly tools: TerminalTools;
  readonly socketDir: { readonly path: string; readonly remove: () => Promise<void> };
  readonly resolve: (target: TerminalTarget) => Promise<Resolution>;
  /** Whether the session that admitted a connection is still current. */
  readonly isActive: (session: ConnectionSession) => Promise<boolean>;
  readonly limits?: SessionLimits | undefined;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
  readonly sweepMs?: number | undefined;
  readonly setInterval?: (fn: () => void, ms: number) => { stop: () => void };
}

/** What a connection is opened for: the Pane it named, and the session that admitted it. */
export interface TerminalOpening {
  readonly target: TerminalTarget;
  readonly session: ConnectionSession;
}

export class TerminalService {
  readonly sessions: TerminalSessions;
  readonly connections = new TerminalConnections();
  private readonly sweeper: { stop: () => void } | null;

  constructor(private readonly deps: TerminalServiceDeps) {
    const limits = validateLimits(deps.limits ?? FLEET_TERMINAL_LIMITS);
    this.sessions = new TerminalSessions({
      limits,
      startServer: makeStartServer({ tools: deps.tools, socketDir: deps.socketDir.path, log: deps.log }),
      connect: makeConnectUpstream(),
      log: deps.log,
    });
    const every = deps.sweepMs ?? SESSION_SWEEP_MS;
    const schedule =
      deps.setInterval ??
      ((fn: () => void, ms: number) => {
        const handle = setInterval(fn, ms);
        // The Gateway's own lifetime decides when terminals end, not a timer keeping it alive.
        handle.unref?.();
        return { stop: () => clearInterval(handle) };
      });
    this.sweeper = every > 0 ? schedule(() => void this.sweep(), every) : null;
  }

  /** Open a connection for an upgrade the Gateway has already admitted. */
  open(opening: TerminalOpening, socket: BrowserSocket): TerminalConnection {
    const connection = new TerminalConnection(opening.target, opening.session, socket, {
      sessions: this.sessions,
      resolve: this.deps.resolve,
      log: this.deps.log,
    });
    this.connections.add(connection);
    return connection;
  }

  /** The browser went away. The session it was attached to is held, not closed. */
  closed(connection: TerminalConnection): void {
    connection.closed();
    this.connections.remove(connection);
  }

  /** An authenticated session ended deliberately — a logout, or an explicit revocation. */
  revoked(sessionId: string): number {
    return this.connections.closeForSession(sessionId);
  }

  /** Re-check every open connection against the session store. Called on a timer, and by tests. */
  async sweep(now = Date.now()): Promise<number> {
    return this.connections.sweep(this.deps.isActive, now);
  }

  /** Close everything and leave no socket, process or directory behind. */
  async stop(): Promise<void> {
    this.sweeper?.stop();
    this.connections.closeAll();
    this.sessions.closeAll();
    await this.deps.socketDir.remove();
  }
}

export interface TerminalServiceOptions {
  readonly resolve: (target: TerminalTarget) => Promise<Resolution>;
  readonly isActive: (session: ConnectionSession) => Promise<boolean>;
  readonly limits?: SessionLimits | undefined;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
  readonly which?: ((name: string) => string | null) | undefined;
}

/**
 * The service, or nothing.
 *
 * Nothing when the executables this needs are not installed: a deployment without them offers no
 * terminals, the route already answers that, and the alternative — admitting an upgrade and failing
 * at the spawn — tells a browser it has a terminal before finding out it does not.
 */
export async function createTerminalService(
  options: TerminalServiceOptions,
): Promise<TerminalService | null> {
  const which = options.which ?? ((name: string) => Bun.which(name));
  const tools = findTerminalTools(which);
  if (tools === null) return null;
  const socketDir = await makeSocketDirectory();
  return new TerminalService({
    tools,
    socketDir,
    resolve: options.resolve,
    isActive: options.isActive,
    limits: options.limits,
    log: options.log,
  });
}
