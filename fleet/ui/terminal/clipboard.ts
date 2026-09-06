/**
 * The escape sequence by which a program running in the terminal asks for the clipboard.
 *
 * Two rules, and they are not symmetrical.
 *
 * **A write is honoured, within a stated bound.** A program that copies something for the operator is
 * doing what the operator asked it to; the bound is here because the sequence arrives on the same
 * stream as the output and nothing else limits it, and a clipboard is not a place to put a megabyte
 * because a program said so.
 *
 * **A read is refused, and nothing goes back.** The request form is a single `?`, and answering it
 * would put whatever the operator last copied — a password, a token, another window's text — onto a
 * stream that a program on a remote machine is reading. The refusal is silent on the wire: writing
 * anything back, including an empty payload, is still an answer.
 */

/** The most base64 an OSC 52 payload may carry — about seventy-five kilobytes of text. */
export const OSC_52_MAX_PAYLOAD = 100_000;

export type Osc52Request =
  /** Text the program asked to be placed on the clipboard. */
  | { readonly kind: "write"; readonly text: string }
  /** The program asked to READ the clipboard. Nothing is sent back. */
  | { readonly kind: "read-refused" }
  | { readonly kind: "rejected"; readonly why: "too-long" | "not-base64" | "malformed" };

/**
 * Read one OSC 52 payload — everything after `52;`, as the terminal's own parser hands it over.
 *
 * The selection field is read and discarded: this surface has one clipboard, and a program naming
 * the cut buffer or the secondary selection is asking for something the browser does not have.
 */
export function readOsc52(data: string): Osc52Request {
  const separator = data.indexOf(";");
  if (separator < 0) return { kind: "rejected", why: "malformed" };
  const payload = data.slice(separator + 1);
  if (payload === "?") return { kind: "read-refused" };
  if (payload.length > OSC_52_MAX_PAYLOAD) return { kind: "rejected", why: "too-long" };
  if (payload.length === 0) return { kind: "write", text: "" };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return { kind: "rejected", why: "not-base64" };
  try {
    return { kind: "write", text: new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))) };
  } catch {
    return { kind: "rejected", why: "not-base64" };
  }
}

/** What a copy attempt did, so the surface can say it rather than failing silently. */
export type CopyOutcome = "copied" | "refused" | "unavailable" | "empty";

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/**
 * Put text on the clipboard and report what happened.
 *
 * A refusal and an absent clipboard are different facts and are reported as different words: one is
 * a permission the operator can grant, the other is a browser that will never do this. Neither
 * touches the selection, which stays exactly where it was so it can be copied another way.
 */
export async function copyToClipboard(
  text: string,
  clipboard: ClipboardLike | undefined,
): Promise<CopyOutcome> {
  if (text.length === 0) return "empty";
  if (clipboard === undefined) return "unavailable";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "refused";
  }
}
