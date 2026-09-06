/**
 * One browser attached to one terminal, from the upgrade to the close.
 *
 * This is where the four pieces below it meet: the admission decision has already named a Pane, the
 * resolver turns that Pane into a terminal, the session set hands back a held or freshly established
 * session, and the browser grammar says what may cross in either direction. Nothing here re-decides
 * any of that — a connection that reaches this file is one the Gateway already admitted.
 *
 * Two rules shape the state machine.
 *
 * The first frame is the viewport, always. A terminal is started at a size, and the only party that
 * knows the size is the browser: starting at a guess and correcting a moment later would repaint the
 * screen in front of the operator and, worse, would have already resized the Pane on their real
 * machine to a number nobody chose.
 *
 * A frame outside the grammar ends the connection. This grammar has two commands and a browser that
 * sends a third is not this product's browser; forwarding what is left of its intent would be
 * guessing on a surface where a guess is typed into a terminal.
 */

import type { TerminalTarget } from "./admit.ts";
import { noticeFrame, outputFrame, readBrowserMessage, VIEWPORT_BOUNDS } from "./browser.ts";
import { inputFrame, resizeFrame, type Geometry } from "./protocol.ts";
import type { Resolution } from "./resolve.ts";
import type { AttachedClient, Session, TerminalSessions } from "./session.ts";

/**
 * What the browser is told when a connection ends or cannot start. A small closed vocabulary, not a
 * message: the surface renders it in the operator's own language, and no variant of it carries a
 * terminal id, a path, or anything the terminal printed.
 */
export const NOTICE = {
  /** No terminal for this Pane, or it could not be started. */
  unavailable: "unavailable",
  /** Another browser holds this terminal, and it was neither displaced nor exposed. */
  busy: "busy",
  /** The terminal went away, or the operator's session did. */
  ended: "ended",
  /** This browser sent something the grammar does not define. */
  protocol: "protocol",
} as const;

export type Notice = (typeof NOTICE)[keyof typeof NOTICE];

/**
 * Just enough of the authenticated session to recognise it again later.
 *
 * Structurally the Gateway's own claims, restated here rather than imported so this layer keeps no
 * opinion about authentication beyond "the thing that admitted this connection can stop being
 * current". The three fields are what identifies one issuance rather than a reused id.
 */
export interface ConnectionSession {
  readonly sessionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/** The upgraded socket, as little of it as this file needs. */
export interface BrowserSocket {
  send(frame: Uint8Array): void;
  close(): void;
}

export interface ConnectionDeps {
  readonly sessions: TerminalSessions;
  readonly resolve: (target: TerminalTarget) => Promise<Resolution>;
  /** Reports lifecycle only — never a frame, a byte of output, or a session identifier. */
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
  /**
   * How much input may accumulate between the viewport arriving and the session attaching.
   *
   * Establishment was measured in the low hundreds of milliseconds, so in ordinary use this queue
   * holds a keystroke or two and usually nothing. The bound is here because "usually" is not a
   * memory bound, and because a browser that produced eight kilobytes in that window is not typing.
   */
  readonly maxPendingInputBytes?: number | undefined;
}

const DEFAULT_PENDING_INPUT_BYTES = 8 * 1024;

type State = "awaiting-viewport" | "establishing" | "attached" | "closed";

export class TerminalConnection {
  private state: State = "awaiting-viewport";
  /** The terminal session this connection is attached to, once it has one. */
  private held: Session | null = null;
  private geometry: Geometry | null = null;
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private readonly client: AttachedClient;

  constructor(
    private readonly target: TerminalTarget,
    /** Which authenticated session opened this connection, so revoking that one closes this. */
    readonly session: ConnectionSession,
    private readonly socket: BrowserSocket,
    private readonly deps: ConnectionDeps,
  ) {
    this.client = {
      write: (data) => this.socket.send(outputFrame(data)),
      // The session ended under us — the terminal exited, the grace period expired, or another
      // session was evicted to make room. The browser is told, once, and the socket closes.
      close: () => this.end(NOTICE.ended),
    };
  }

  /** A frame arrived from the browser. Never throws: a bad frame is an outcome, not an exception. */
  message(frame: Uint8Array): void {
    if (this.state === "closed") return;
    const read = readBrowserMessage(frame);
    if (read.kind === "rejected") {
      this.deps.log?.("terminal.frame-rejected", { why: read.why });
      this.end(NOTICE.protocol);
      return;
    }
    if (read.kind === "viewport") {
      const geometry: Geometry = { columns: read.viewport.columns, rows: read.viewport.rows };
      this.geometry = geometry;
      if (this.state === "awaiting-viewport") {
        void this.establish(geometry);
        return;
      }
      // A later viewport is a resize of a terminal that already exists. While one is still being
      // established the newest geometry is simply what it will be started with.
      if (this.state === "attached") this.held?.send(resizeFrame(geometry));
      return;
    }
    if (this.state === "attached") {
      this.held?.send(inputFrame(read.data));
      return;
    }
    // Input before the first viewport is out of order, not merely early: nothing has been started,
    // so there is nowhere for it to go and no size it would have been typed at.
    if (this.state === "awaiting-viewport") {
      this.end(NOTICE.protocol);
      return;
    }
    this.queue(read.data);
  }

  private queue(data: Uint8Array): void {
    const bound = this.deps.maxPendingInputBytes ?? DEFAULT_PENDING_INPUT_BYTES;
    if (this.pendingBytes + data.length > bound) {
      // Delivering part of what someone typed is worse than delivering none of it: the terminal
      // would receive a truncated sequence and act on it.
      this.deps.log?.("terminal.pending-input-overflow", { bytes: this.pendingBytes });
      this.end(NOTICE.unavailable);
      return;
    }
    this.pending.push(data);
    this.pendingBytes += data.length;
  }

  /**
   * Read through a method rather than the field, because establishment awaits twice and the browser
   * can close in either gap. Narrowing the field at the assignment would let the compiler decide
   * those checks are unreachable, which is the one thing they are not.
   */
  private isClosed(): boolean {
    return this.state === "closed";
  }

  private async establish(geometry: Geometry): Promise<void> {
    this.state = "establishing";
    let resolution: Resolution;
    try {
      resolution = await this.deps.resolve(this.target);
    } catch {
      this.end(NOTICE.unavailable);
      return;
    }
    if (this.isClosed()) return;
    if (!resolution.ok) {
      this.deps.log?.("terminal.unresolved", { reason: resolution.reason });
      this.end(NOTICE.unavailable);
      return;
    }
    let session: Session;
    try {
      session = await this.deps.sessions.acquire(resolution.terminalId, geometry);
    } catch {
      this.end(NOTICE.unavailable);
      return;
    }
    if (this.isClosed()) return;
    const attached = session.attach(this.client);
    if (!attached.ok) {
      this.end(NOTICE.busy);
      return;
    }
    this.held = session;
    this.state = "attached";
    // The geometry the terminal was started with may already be stale: the browser can have been
    // resized while the server was starting, and the operator's own machine is what carries the
    // result of getting that wrong.
    const current = this.geometry ?? geometry;
    if (current.columns !== geometry.columns || current.rows !== geometry.rows) {
      session.send(resizeFrame(current));
    }
    const queued = this.pending;
    this.pending = [];
    this.pendingBytes = 0;
    for (const data of queued) session.send(inputFrame(data));
  }

  /** The browser went away — navigation, reload, or a dropped network. */
  closed(): void {
    if (this.state === "closed") return;
    this.state = "closed";
    this.pending = [];
    this.pendingBytes = 0;
    // Detach, never close: the session is held for its grace period so a return within it costs no
    // new attachment, and the terminal keeps the size it is running at until that period expires.
    this.held?.detach(this.client);
    this.held = null;
  }

  /** End this connection from this side, telling the browser why. Idempotent. */
  end(notice: Notice): void {
    if (this.state === "closed") return;
    const session = this.held;
    this.state = "closed";
    this.pending = [];
    this.pendingBytes = 0;
    this.held = null;
    try {
      this.socket.send(noticeFrame(notice));
    } catch {
      // The socket is already gone; the close below is what matters.
    }
    session?.detach(this.client);
    try {
      this.socket.close();
    } catch {
      // Same.
    }
  }

  get sessionId(): string {
    return this.session.sessionId;
  }

  /** For tests and diagnostics: what this connection is doing, never what it is carrying. */
  status(): State {
    return this.state;
  }
}

/**
 * Every connection this Gateway holds open.
 *
 * It exists for one reason the connections cannot answer themselves: an authenticated session that
 * is revoked or expires has to take its terminals with it. A cookie stops working the moment it is
 * revoked, and a socket opened with it must not outlive that by the length of a terminal session.
 */
export class TerminalConnections {
  /** Snapshotted before every sweep below: closing a connection removes it from this set. */
  private readonly open = new Set<TerminalConnection>();

  add(connection: TerminalConnection): void {
    this.open.add(connection);
  }

  remove(connection: TerminalConnection): void {
    this.open.delete(connection);
  }

  size(): number {
    return this.open.size;
  }

  /** Close every connection opened with one authenticated session — logout, or an explicit revoke. */
  closeForSession(sessionId: string): number {
    let closed = 0;
    for (const connection of Array.from(this.open)) {
      if (connection.sessionId !== sessionId) continue;
      connection.end(NOTICE.ended);
      this.open.delete(connection);
      closed += 1;
    }
    return closed;
  }

  /**
   * Close every connection whose session is no longer current.
   *
   * Expiry has no event to hook: a session simply stops being active at a moment nobody is told
   * about, so the only honest answer is to ask, periodically, on the connection's own behalf.
   */
  async sweep(isActive: (session: ConnectionSession) => Promise<boolean>, now = Date.now()): Promise<number> {
    let closed = 0;
    for (const connection of Array.from(this.open)) {
      let active: boolean;
      // An expiry that has already passed needs no store to confirm it, and asking would touch the
      // session file once per connection per sweep for an answer arithmetic already has.
      if (connection.session.expiresAt <= now) active = false;
      else
        try {
          active = await isActive(connection.session);
        } catch {
          // An unreadable session store is not evidence that the session ended. Leave it for the
          // next sweep rather than closing a working terminal on a transient read error.
          continue;
        }
      if (active) continue;
      connection.end(NOTICE.ended);
      this.open.delete(connection);
      closed += 1;
    }
    return closed;
  }

  closeAll(): void {
    for (const connection of Array.from(this.open)) connection.end(NOTICE.ended);
    this.open.clear();
  }
}

export { VIEWPORT_BOUNDS };
