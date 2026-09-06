/**
 * The grammar between a browser and the Gateway. Deliberately not the terminal server's.
 *
 * The server's own protocol has four client commands, two of which — pause and resume — are flow
 * control the Gateway owns and a browser has no business asserting. Reusing it would mean accepting
 * a wire that says more than this surface allows and then refusing half of it by hand. This grammar
 * says exactly what the specification says: terminal input, and the viewport. A third message kind
 * cannot be expressed, so rejecting one is not a rule anybody has to remember.
 *
 * One byte of command, then the payload. Binary throughout: terminal input is bytes, and a browser
 * that encoded it as text would mangle every paste that is not valid UTF-8 on a frame boundary.
 */

/** Browser → Gateway. */
export const FROM_BROWSER = {
  input: 0x69, // "i"
  viewport: 0x76, // "v"
} as const;

/** Gateway → browser. */
export const TO_BROWSER = {
  output: 0x6f, // "o"
  /** The terminal's own title, when the far end sets one. */
  title: 0x74, // "t"
  /** A lifecycle notice in the operator's language — never terminal content. */
  notice: 0x6e, // "n"
} as const;

/** A viewport, in cells. Bounds are the surface's, not the terminal's. */
export interface Viewport {
  readonly columns: number;
  readonly rows: number;
}

/**
 * What a viewport may be.
 *
 * A lower bound because a terminal below it cannot render anything an operator could act on, and an
 * upper one because these numbers become a real terminal's dimensions on a real machine — a browser
 * reporting a million columns would be resizing someone's work, not its own window.
 */
export const VIEWPORT_BOUNDS = { minColumns: 20, maxColumns: 500, minRows: 5, maxRows: 200 } as const;

export type BrowserMessage =
  | { readonly kind: "input"; readonly data: Uint8Array }
  | { readonly kind: "viewport"; readonly viewport: Viewport }
  /** Anything this grammar does not define, including a viewport outside its bounds. */
  | { readonly kind: "rejected"; readonly why: RejectionReason };

export type RejectionReason =
  | "empty"
  | "unknown-command"
  | "malformed-viewport"
  | "viewport-out-of-range";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function framed(command: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.length + 1);
  out[0] = command;
  out.set(payload, 1);
  return out;
}

export function outputFrame(data: Uint8Array): Uint8Array {
  return framed(TO_BROWSER.output, data);
}

export function titleFrame(title: string): Uint8Array {
  return framed(TO_BROWSER.title, encoder.encode(title));
}

/** A short, non-secret sentence about the connection's own lifecycle. Never terminal bytes. */
export function noticeFrame(notice: string): Uint8Array {
  return framed(TO_BROWSER.notice, encoder.encode(notice));
}

function readViewport(payload: Uint8Array): BrowserMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(payload));
  } catch {
    return { kind: "rejected", why: "malformed-viewport" };
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    return { kind: "rejected", why: "malformed-viewport" };
  }
  // SAFETY: the guard above establishes that `parsed` is a non-null, non-array object, and this
  // shape claims nothing about it beyond that its two fields are `unknown` — which is what reading a
  // property off an object gives regardless. The values are validated on the next line.
  const { columns, rows } = parsed as { columns?: unknown; rows?: unknown };
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows)) {
    return { kind: "rejected", why: "malformed-viewport" };
  }
  // `Number()` rather than an assertion: `isSafeInteger` has already refused everything that is not
  // a number — a numeric *string* included, which is why this cannot be a plain conversion done
  // first — so this call is the identity on a value already proven to be one.
  const c = Number(columns);
  const r = Number(rows);
  const { minColumns, maxColumns, minRows, maxRows } = VIEWPORT_BOUNDS;
  // Refused rather than clamped: a clamp would silently resize the operator's real terminal to a
  // number they never asked for, and leave the surface drawing at a size the terminal is not.
  if (c < minColumns || c > maxColumns || r < minRows || r > maxRows) {
    return { kind: "rejected", why: "viewport-out-of-range" };
  }
  return { kind: "viewport", viewport: { columns: c, rows: r } };
}

/**
 * Read one message from a browser.
 *
 * Never throws. A connection that sends nonsense is refused message by message rather than dropped:
 * the operator is mid-terminal, and closing on one bad frame would cost them a session over
 * something the surface can simply decline to forward.
 */
export function readBrowserMessage(frame: Uint8Array): BrowserMessage {
  if (frame.length === 0) return { kind: "rejected", why: "empty" };
  const payload = frame.subarray(1);
  switch (frame[0]) {
    case FROM_BROWSER.input:
      return { kind: "input", data: payload };
    case FROM_BROWSER.viewport:
      return readViewport(payload);
    default:
      return { kind: "rejected", why: "unknown-command" };
  }
}

/** The browser-side encoders, exported so the surface and its tests never hand-roll a frame. */
export function inputMessage(data: Uint8Array): Uint8Array {
  return framed(FROM_BROWSER.input, data);
}

export function viewportMessage(viewport: Viewport): Uint8Array {
  return framed(
    FROM_BROWSER.viewport,
    encoder.encode(JSON.stringify({ columns: viewport.columns, rows: viewport.rows })),
  );
}
