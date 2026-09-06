/**
 * The terminal server's wire framing, as the Gateway's own client speaks it.
 *
 * Every constant here was read out of the terminal server's own shipped frontend rather than from
 * documentation, because the frontend is what the server is known to interoperate with. Both
 * directions share one enum in that source, which is why `OUTPUT` and `INPUT` are both `"0"`: the
 * byte's meaning depends on which way the frame is travelling, not on the byte alone.
 *
 * Frames are binary, and the first byte is a command *character* — the ASCII digit, not the number.
 * Everything after it is that command's payload: raw terminal bytes for the two data commands, and
 * UTF-8 JSON for the rest.
 *
 * The Gateway is the only client of this protocol. A browser never speaks it — it speaks the
 * Gateway's own, narrower grammar (see `browser.ts`), and the Gateway translates. That is what keeps
 * a browser from naming a terminal, and it is why this module has no notion of authentication beyond
 * the token field the first frame carries.
 */

/** Server → client. */
export const SERVER = {
  output: 0x30, // "0"
  title: 0x31, // "1"
  preferences: 0x32, // "2"
} as const;

/** Client → server. `input` shares its byte with the server's `output`; direction disambiguates. */
export const CLIENT = {
  input: 0x30, // "0"
  resize: 0x31, // "1"
  pause: 0x32, // "2"
  resume: 0x33, // "3"
} as const;

/** Terminal geometry, in cells. */
export interface Geometry {
  readonly columns: number;
  readonly rows: number;
}

export type ServerFrame =
  | { readonly kind: "output"; readonly data: Uint8Array }
  | { readonly kind: "title"; readonly title: string }
  | { readonly kind: "preferences"; readonly raw: string }
  /** A command byte this protocol does not define. Kept rather than thrown: an unknown frame from a
   *  newer server is not a reason to drop a live terminal, and the caller decides. */
  | { readonly kind: "unknown"; readonly command: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function framed(command: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.length + 1);
  out[0] = command;
  out.set(payload, 1);
  return out;
}

/**
 * The first frame, which authenticates and states the initial geometry in one message.
 *
 * The geometry belongs here rather than in a resize that follows, because the server sizes the
 * terminal when it spawns its command: a first frame without it starts the terminal at the server's
 * default and repaints once, which the operator sees.
 */
export function authFrame(token: string, geometry: Geometry): Uint8Array {
  return encoder.encode(
    JSON.stringify({ AuthToken: token, columns: geometry.columns, rows: geometry.rows }),
  );
}

/** Terminal input, verbatim. Not text: a paste, a key sequence and a UTF-8 fragment are all bytes. */
export function inputFrame(data: Uint8Array): Uint8Array {
  return framed(CLIENT.input, data);
}

export function resizeFrame(geometry: Geometry): Uint8Array {
  return framed(
    CLIENT.resize,
    encoder.encode(JSON.stringify({ columns: geometry.columns, rows: geometry.rows })),
  );
}

/**
 * Read one server frame.
 *
 * An empty frame is `unknown` with command `-1` rather than an error, for the same reason an
 * undefined command byte is: this runs on a live connection, and the honest failure is to report the
 * frame and keep the terminal.
 */
export function decodeServerFrame(frame: Uint8Array): ServerFrame {
  if (frame.length === 0) return { kind: "unknown", command: -1 };
  const command = frame[0]!;
  const payload = frame.subarray(1);
  switch (command) {
    case SERVER.output:
      return { kind: "output", data: payload };
    case SERVER.title:
      return { kind: "title", title: decoder.decode(payload) };
    case SERVER.preferences:
      return { kind: "preferences", raw: decoder.decode(payload) };
    default:
      return { kind: "unknown", command };
  }
}
