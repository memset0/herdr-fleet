/**
 * The browser's end of a terminal connection.
 *
 * A small state machine over a socket, with the socket injected: the point is that opening, the first
 * viewport, every keystroke and every notice can be driven in a test without a server, because what
 * this file gets wrong is not visible in a screenshot.
 *
 * The address it builds is the app's own — the Pane's id and the scope parameters Collie already puts
 * in a URL, and nothing else. That is not a convenience: the Gateway refuses a connection carrying
 * any other selector, so a fourth parameter added here would fail closed rather than quietly work.
 */

import {
  TO_BROWSER,
  VIEWPORT_BOUNDS,
  inputMessage,
  viewportMessage,
  type Viewport,
} from "../../terminal/browser.ts";
import { TERMINAL_PATH } from "../../terminal/admit.ts";

/** The scope a Pane is addressed in, exactly as the app's own URLs carry it. */
export interface TerminalScope {
  readonly host?: string | undefined;
  readonly session?: string | undefined;
}

/**
 * Where this browser connects, derived from where it already is.
 *
 * Same origin, upgraded to the matching WebSocket scheme, so the connection carries the app's own
 * cookie and is admitted by the same `connect-src 'self'` that admits everything else.
 */
export function terminalUrl(origin: string, paneId: string, scope: TerminalScope = {}): string {
  const url = new URL(TERMINAL_PATH, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("pane", paneId);
  if (scope.host !== undefined && scope.host !== "") url.searchParams.set("h", scope.host);
  if (scope.session !== undefined && scope.session !== "") url.searchParams.set("s", scope.session);
  return url.toString();
}

/**
 * A viewport this browser may report.
 *
 * Clamped here rather than refused, because refusing on this side means a window nobody can use: the
 * Gateway refuses an out-of-range geometry and ends the connection, so the surface's job is to never
 * produce one. The indicator shows what the terminal actually is, which is the honest half.
 */
function clamp(value: number, minimum: number, maximum: number): number {
  return !Number.isFinite(value) ? minimum : Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

export function boundedViewport(candidate: Viewport): Viewport {
  return {
    columns: clamp(candidate.columns, VIEWPORT_BOUNDS.minColumns, VIEWPORT_BOUNDS.maxColumns),
    rows: clamp(candidate.rows, VIEWPORT_BOUNDS.minRows, VIEWPORT_BOUNDS.maxRows),
  };
}

export function sameViewport(left: Viewport | null, right: Viewport): boolean {
  return left !== null && left.columns === right.columns && left.rows === right.rows;
}

/** As little of a WebSocket as this needs, so a test can be one object. */
export interface SocketLike {
  binaryType: string;
  /** Only ever a buffer this side owns whole — narrower than the platform's, on purpose. */
  send(data: ArrayBuffer): void;
  close(): void;
  addEventListener(type: "open" | "close" | "error", handler: () => void): void;
  addEventListener(type: "message", handler: (event: { data: unknown }) => void): void;
}

export interface TerminalLinkHandlers {
  onOpen?(): void;
  onOutput(data: Uint8Array): void;
  onTitle?(title: string): void;
  /** A lifecycle word from the Gateway — never terminal content, and never a sentence to print raw. */
  onNotice?(notice: string): void;
  onClose(): void;
}

const decoder = new TextDecoder();

/** A frame in a buffer the socket owns the whole of. */
function wire(frame: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(frame.byteLength);
  new Uint8Array(copy).set(frame);
  return copy;
}

export class TerminalLink {
  private open = false;
  private closed = false;
  private reported: Viewport | null = null;
  /** Held until the socket opens: the first frame must be the viewport, so it cannot go early. */
  private pendingViewport: Viewport | null = null;

  private readonly socket: SocketLike;

  constructor(socket: SocketLike, handlers: TerminalLinkHandlers) {
    this.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      this.open = true;
      const first = this.pendingViewport;
      this.pendingViewport = null;
      if (first !== null) this.report(first);
      handlers.onOpen?.();
    });
    socket.addEventListener("message", (event) => {
      const { data } = event;
      if (!(data instanceof ArrayBuffer)) return;
      const frame = new Uint8Array(data);
      if (frame.length === 0) return;
      const body = frame.subarray(1);
      if (frame[0] === TO_BROWSER.output) handlers.onOutput(body);
      else if (frame[0] === TO_BROWSER.title) handlers.onTitle?.(decoder.decode(body));
      else if (frame[0] === TO_BROWSER.notice) handlers.onNotice?.(decoder.decode(body));
    });
    socket.addEventListener("close", () => {
      this.closed = true;
      handlers.onClose();
    });
    socket.addEventListener("error", () => {
      this.closed = true;
      handlers.onClose();
    });
  }

  /**
   * State the viewport. Before the socket opens the newest one is held, because the first frame has
   * to be a viewport and a stale one would start the terminal at a size that has already changed.
   */
  report(candidate: Viewport): void {
    if (this.closed) return;
    const viewport = boundedViewport(candidate);
    if (!this.open) {
      this.pendingViewport = viewport;
      return;
    }
    if (sameViewport(this.reported, viewport)) return;
    this.reported = viewport;
    this.socket.send(wire(viewportMessage(viewport)));
  }

  /** What the operator typed. Dropped before the socket opens: there is no terminal to type into. */
  type(data: Uint8Array): void {
    if (this.closed || !this.open || data.length === 0) return;
    this.socket.send(wire(inputMessage(data)));
  }

  /** The geometry this link has actually stated, for the indicator that makes it legible. */
  geometry(): Viewport | null {
    return this.reported;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.close();
  }
}
