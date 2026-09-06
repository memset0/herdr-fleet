/**
 * A terminal session, and the bounded set of them a device holds.
 *
 * The shape follows from one measurement and one decision.
 *
 * The measurement: the terminal server spawns its command once per connection and kills it when that
 * connection ends. So the Gateway — not the browser — has to be the server's client, and that
 * connection has to outlive a browser leaving, or every Pane switch re-runs the attachment.
 *
 * The decision: what is held is a *cost*, never a correctness property. A session that was closed is
 * re-established transparently on the next connection, which is why nothing above this layer may ask
 * whether one survived. Attaching was measured in the low hundreds of milliseconds and arrives with
 * the whole screen painted, so the grace period is a timer before a close rather than a cache — and
 * the retained window exists only for the one case that timer creates.
 *
 * Every dependency that touches a process, a socket or a clock is injected. Not for purity: it is so
 * the eviction, the grace period and the single-writer refusal can be driven exactly in a test,
 * which is the only way to know a timer fires when it should and not when it should not.
 */

import { authFrame, decodeServerFrame, inputFrame, resizeFrame, type Geometry } from "./protocol.ts";
import { retainedWindow, type RetainedWindow } from "./retain.ts";

/** A terminal server the Gateway started, addressed by whatever its transport needs. */
export interface TerminalServer {
  /** Where the Gateway's own client connects. Never handed to a browser. */
  readonly endpoint: string;
  /** Stop the server and everything it spawned. Idempotent. */
  stop(): void;
}

/** The Gateway's connection to one terminal server. */
export interface Upstream {
  send(frame: Uint8Array): void;
  close(): void;
}

export interface UpstreamHandlers {
  /** Terminal output, already unwrapped from its frame. */
  onOutput(data: Uint8Array): void;
  /** The upstream went away — the attachment ended, the Pane closed, or the server exited. */
  onClosed(): void;
}

export type StartServer = (terminalId: string, geometry: Geometry) => Promise<TerminalServer>;
export type ConnectUpstream = (
  server: TerminalServer,
  geometry: Geometry,
  handlers: UpstreamHandlers,
) => Promise<Upstream>;

/** Whoever is currently reading the terminal. Exactly zero or one at a time. */
export interface AttachedClient {
  /** Deliver terminal output. */
  write(data: Uint8Array): void;
  /** End this client's connection. */
  close(): void;
}

export interface SessionLimits {
  /** How long a session is held after its browser leaves. */
  readonly graceMs: number;
  /** How many sessions one device holds at once. */
  readonly maxSessions: number;
  /** The retained window's bound, in bytes. */
  readonly retainBytes: number;
}

/**
 * Whatever the scheduler in use hands back for a pending timer. Named rather than left open so the
 * grace period's handle carries a type through the session instead of being re-asserted at each use:
 * the runtime's own `Timer`, or the number a test's scheduler prefers.
 */
export type TimerHandle = ReturnType<typeof setTimeout> | number;

export interface SessionDeps {
  readonly startServer: StartServer;
  readonly connect: ConnectUpstream;
  readonly limits: SessionLimits;
  readonly now?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => TimerHandle;
  readonly clearTimer?: (handle: TimerHandle) => void;
  /** Reports lifecycle only. Never terminal bytes — see the diagnostics boundary. */
  readonly log?: (event: string, detail: Record<string, string | number>) => void;
}

export type AttachResult =
  | { readonly ok: true }
  /** Another browser holds this terminal. The established one is neither displaced nor exposed. */
  | { readonly ok: false; readonly reason: "busy" };

class Session {
  private client: AttachedClient | null = null;
  private graceHandle: TimerHandle | null = null;
  private closed = false;
  readonly retained: RetainedWindow;
  /** Set once the multiplexer's own attach repaint has been seen, so a first attach needs no replay. */
  private everAttached = false;
  lastUsed: number;

  constructor(
    readonly terminalId: string,
    private readonly server: TerminalServer,
    private readonly deps: Required<Pick<SessionDeps, "limits">> & SessionDeps,
    private readonly onEnded: (session: Session) => void,
  ) {
    this.retained = retainedWindow(deps.limits.retainBytes);
    this.lastUsed = (deps.now ?? Date.now)();
  }

  private upstream: Upstream | null = null;

  bindUpstream(upstream: Upstream): void {
    this.upstream = upstream;
  }

  receive(data: Uint8Array): void {
    this.retained.push(data);
    this.client?.write(data);
  }

  attach(client: AttachedClient): AttachResult {
    if (this.closed) return { ok: false, reason: "busy" };
    if (this.client !== null) return { ok: false, reason: "busy" };
    this.cancelGrace();
    this.client = client;
    this.lastUsed = (this.deps.now ?? Date.now)();
    // Only a REUSED session replays. A newly established one is about to receive the multiplexer's
    // own attach repaint, and replaying an empty window before it would be a no-op that still had to
    // be reasoned about at every call site.
    if (this.everAttached) {
      const replay = this.retained.replay();
      if (replay.length > 0) client.write(replay);
    }
    this.everAttached = true;
    return { ok: true };
  }

  detach(client: AttachedClient): void {
    if (this.client !== client) return;
    this.client = null;
    this.lastUsed = (this.deps.now ?? Date.now)();
    this.startGrace();
  }

  hasClient(): boolean {
    return this.client !== null;
  }

  send(frame: Uint8Array): void {
    if (this.closed) return;
    this.upstream?.send(frame);
  }

  private startGrace(): void {
    this.cancelGrace();
    const set = this.deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.graceHandle = set(() => {
      this.graceHandle = null;
      this.deps.log?.("terminal.grace-expired", { terminal: this.terminalId });
      this.close();
    }, this.deps.limits.graceMs);
  }

  private cancelGrace(): void {
    if (this.graceHandle === null) return;
    const clear = this.deps.clearTimer ?? ((handle: TimerHandle) => clearTimeout(handle));
    clear(this.graceHandle);
    this.graceHandle = null;
  }

  /** Close the session, its server and its attachment. Idempotent, and safe from any of them. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cancelGrace();
    const client = this.client;
    this.client = null;
    this.retained.clear();
    try {
      this.upstream?.close();
    } catch {
      // A dead upstream is what we are already handling.
    }
    try {
      this.server.stop();
    } catch {
      // Same.
    }
    client?.close();
    this.onEnded(this);
  }
}

export type { Session };

/**
 * The set of sessions one device holds.
 *
 * Bounded because a held session is a held process: the maximum is how many terminal servers this
 * device may run at once, and it is stated rather than discovered. Eviction is least-recently-used
 * and closes the evicted session completely — nothing is reused across a close.
 */
export class TerminalSessions {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly deps: SessionDeps) {
    if (deps.limits.maxSessions < 1) throw new Error("a device must be allowed at least one session");
  }

  /** How many sessions are held right now. */
  size(): number {
    return this.sessions.size;
  }

  held(terminalId: string): boolean {
    return this.sessions.has(terminalId);
  }

  /**
   * The session for a terminal, establishing one if it is not held.
   *
   * A held session is returned as it stands, including its retained window — that is the whole point
   * of holding it. Establishing one may evict another, which happens before the new server starts so
   * the device is never briefly over its own maximum.
   */
  async acquire(terminalId: string, geometry: Geometry): Promise<Session> {
    const existing = this.sessions.get(terminalId);
    if (existing !== undefined) {
      existing.lastUsed = (this.deps.now ?? Date.now)();
      return existing;
    }
    this.evictWhileAtCapacity();
    const server = await this.deps.startServer(terminalId, geometry);
    const session = new Session(terminalId, server, this.deps, (ended) => {
      // Only remove the entry if it is still this session: a terminal that was closed and
      // re-established must not have its successor evicted by its predecessor's callback.
      if (this.sessions.get(ended.terminalId) === ended) this.sessions.delete(ended.terminalId);
    });
    this.sessions.set(terminalId, session);
    const upstream = await this.deps.connect(server, geometry, {
      onOutput: (data) => session.receive(data),
      onClosed: () => session.close(),
    });
    session.bindUpstream(upstream);
    this.deps.log?.("terminal.session-opened", { terminal: terminalId, held: this.sessions.size });
    return session;
  }

  private evictWhileAtCapacity(): void {
    while (this.sessions.size >= this.deps.limits.maxSessions) {
      let oldest: Session | null = null;
      for (const session of this.sessions.values()) {
        if (oldest === null || session.lastUsed < oldest.lastUsed) oldest = session;
      }
      if (oldest === null) return;
      this.deps.log?.("terminal.session-evicted", { terminal: oldest.terminalId });
      oldest.close();
    }
  }

  /** Close every session — used when the Gateway stops, so nothing is orphaned. */
  closeAll(): void {
    // Snapshotted first: `close()` removes the entry, and mutating a Map while iterating it is
    // exactly the shape that silently skips half a collection.
    const held = Array.from(this.sessions.values());
    for (const session of held) session.close();
  }
}

/** Frames the Gateway sends upstream, gathered so a caller never assembles one by hand. */
export const upstream = { authFrame, inputFrame, resizeFrame, decodeServerFrame };
