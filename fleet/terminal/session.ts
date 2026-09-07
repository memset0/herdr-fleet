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

import { placementKey, placementLabel, type Placement } from "./placement.ts";
import { authFrame, decodeServerFrame, inputFrame, resizeFrame, type Geometry } from "./protocol.ts";
import { retainedWindow, type RetainedWindow } from "./retain.ts";

/**
 * A terminal server the Gateway can talk to, whoever started it.
 *
 * For a local Pane the Gateway started it; for a member's Pane that member's own service did, and
 * `stop` reaches across the link to say so. Both answer with a URL the Gateway's own client dials
 * and nothing else knows, which is what lets everything above this line be one code path.
 */
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

export type StartServer = (placement: Placement, geometry: Geometry) => Promise<TerminalServer>;
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
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

export type AttachResult =
  | { readonly ok: true }
  /** Another browser holds this terminal. The established one is neither displaced nor exposed. */
  | { readonly ok: false; readonly reason: "busy" };

/** A caller's temporary claim while it decides whether to attach a browser. */
export interface SessionAcquisition {
  readonly session: Session;
  release(): void;
}

class Session {
  private client: AttachedClient | null = null;
  private graceHandle: TimerHandle | null = null;
  private closed = false;
  readonly retained: RetainedWindow;
  private readonly onDetached: () => void;
  lastUsed: number;

  constructor(
    readonly placement: Placement,
    readonly key: string,
    private readonly server: TerminalServer,
    private geometry: Geometry,
    private readonly deps: Required<Pick<SessionDeps, "limits">> & SessionDeps,
    private readonly onEnded: (session: Session) => void,
    onDetached: () => void,
  ) {
    this.onDetached = onDetached;
    this.retained = retainedWindow(deps.limits.retainBytes);
    this.lastUsed = (deps.now ?? Date.now)();
  }

  private upstream: Upstream | null = null;

  bindUpstream(upstream: Upstream): void {
    if (this.closed) {
      upstream.close();
      throw new Error("the terminal session ended while connecting");
    }
    this.upstream = upstream;
  }

  isClosed(): boolean {
    return this.closed;
  }

  hold(): void {
    this.cancelGrace();
  }

  idle(): void {
    if (!this.closed && this.client === null && this.graceHandle === null) this.startGrace();
  }

  receive(data: Uint8Array): void {
    if (this.closed) return;
    this.retained.push(data);
    this.client?.write(data);
  }

  attach(client: AttachedClient): AttachResult {
    if (this.closed) return { ok: false, reason: "busy" };
    if (this.client !== null) return { ok: false, reason: "busy" };
    this.cancelGrace();
    this.client = client;
    this.lastUsed = (this.deps.now ?? Date.now)();
    // Output can arrive while the shared connection is still being established. Replay whatever
    // has already arrived before handing this browser the live stream, including on first attach.
    const replay = this.retained.replay();
    if (replay.length > 0) client.write(replay);
    return { ok: true };
  }

  detach(client: AttachedClient): void {
    if (this.client !== client) return;
    this.client = null;
    this.lastUsed = (this.deps.now ?? Date.now)();
    this.onDetached();
  }

  hasClient(): boolean {
    return this.client !== null;
  }

  send(frame: Uint8Array): void {
    if (this.closed) return;
    this.upstream?.send(frame);
  }

  resize(geometry: Geometry): void {
    if (this.closed || (geometry.columns === this.geometry.columns && geometry.rows === this.geometry.rows)) return;
    this.geometry = geometry;
    this.send(resizeFrame(geometry));
  }

  private startGrace(): void {
    this.cancelGrace();
    const set = this.deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.graceHandle = set(() => {
      this.graceHandle = null;
      this.deps.log?.("terminal.grace-expired", { pane: placementLabel(this.placement) });
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

interface SessionEntry {
  readonly key: string;
  readonly placement: Placement;
  readonly ready: Promise<Session>;
  session: Session | null;
  users: number;
  reserved: boolean;
  established: boolean;
}

/**
 * The set of sessions one device holds.
 *
 * Bounded because a held session is a held process: the maximum is how many terminal servers this
 * device may run at once, and it is stated rather than discovered. Eviction is least-recently-used
 * and closes the evicted session completely — nothing is reused across a close.
 */
export class TerminalSessions {
  private readonly entries = new Map<string, SessionEntry>();
  private slots = 0;
  private closed = false;
  private stopping: Promise<void> | null = null;
  private changed = Promise.withResolvers<void>();

  constructor(private readonly deps: SessionDeps) {
    if (deps.limits.maxSessions < 1) throw new Error("a device must be allowed at least one session");
  }

  /** Held and establishing sessions both consume a process slot. */
  size(): number {
    return this.slots;
  }

  held(key: string): boolean {
    return this.entries.get(key)?.reserved === true;
  }

  async acquire(placement: Placement, geometry: Geometry): Promise<SessionAcquisition> {
    if (this.closed) throw new Error("the terminal session service has stopped");
    const key = placementKey(placement);
    let entry = this.entries.get(key);
    if (entry === undefined) {
      const ready = Promise.withResolvers<Session>();
      entry = { key, placement, ready: ready.promise, session: null, users: 1, reserved: false, established: false };
      // Publish before calling anything asynchronous, including capacity admission and startup.
      this.entries.set(key, entry);
      void this.establish(entry, geometry).then(ready.resolve, ready.reject);
    } else {
      entry.users += 1;
      entry.session?.hold();
    }
    try {
      const session = await entry.ready;
      if (this.closed || session.isClosed() || this.entries.get(key) !== entry) {
        throw new Error("the terminal session ended while acquiring");
      }
      session.lastUsed = (this.deps.now ?? Date.now)();
      let released = false;
      return {
        session,
        release: () => {
          if (released) return;
          released = true;
          this.release(entry);
        },
      };
    } catch (error) {
      this.release(entry);
      throw error;
    }
  }

  private release(entry: SessionEntry): void {
    entry.users -= 1;
    if (entry.users === 0) entry.session?.idle();
    this.notify();
  }

  private notify(): void {
    const changed = this.changed;
    this.changed = Promise.withResolvers<void>();
    changed.resolve();
  }

  private remove(entry: SessionEntry): void {
    if (this.entries.get(entry.key) !== entry) return;
    this.entries.delete(entry.key);
    if (entry.reserved) {
      entry.reserved = false;
      this.slots -= 1;
    }
    this.notify();
  }

  private async reserve(entry: SessionEntry): Promise<void> {
    while (!this.closed && this.slots >= this.deps.limits.maxSessions) {
      let oldest: Session | null = null;
      for (const candidate of this.entries.values()) {
        if (!candidate.established || candidate.users !== 0 || candidate.session === null) continue;
        if (oldest === null || candidate.session.lastUsed < oldest.lastUsed) oldest = candidate.session;
      }
      if (oldest !== null) {
        this.deps.log?.("terminal.session-evicted", { pane: placementLabel(oldest.placement) });
        oldest.close();
      } else {
        await this.changed.promise;
      }
    }
    if (this.closed) throw new Error("the terminal session service has stopped");
    entry.reserved = true;
    this.slots += 1;
  }

  private async establish(entry: SessionEntry, geometry: Geometry): Promise<Session> {
    try {
      await this.reserve(entry);
      if (this.closed) throw new Error("the terminal session service has stopped");
      const server = await this.deps.startServer(entry.placement, geometry);
      if (this.closed) {
        server.stop();
        throw new Error("the terminal session service has stopped");
      }
      const session = new Session(entry.placement, entry.key, server, geometry, this.deps, () => {
        // A close during connect keeps its slot until that connect's late result is cleaned up.
        if (entry.established) this.remove(entry);
      }, () => {
        if (entry.users === 0) entry.session?.idle();
      });
      entry.session = session;
      const upstream = await this.deps.connect(server, geometry, {
        onOutput: (data) => session.receive(data),
        onClosed: () => session.close(),
      });
      session.bindUpstream(upstream);
      entry.established = true;
      this.notify();
      this.deps.log?.("terminal.session-opened", { pane: placementLabel(entry.placement), held: this.slots });
      return session;
    } catch (error) {
      entry.session?.close();
      this.remove(entry);
      throw error;
    }
  }

  /** Shutdown invalidates first, then drains late starts before the socket directory is removed. */
  closeAll(): Promise<void> {
    if (this.stopping !== null) return this.stopping;
    this.closed = true;
    const entries = Array.from(this.entries.values());
    for (const entry of entries) entry.session?.close();
    this.notify();
    this.stopping = Promise.allSettled(entries.map((entry) => entry.ready)).then(() => undefined);
    return this.stopping;
  }
}

/** Frames the Gateway sends upstream, gathered so a caller never assembles one by hand. */
export const upstream = { authFrame, inputFrame, resizeFrame, decodeServerFrame };
