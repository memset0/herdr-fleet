/**
 * The terminal surface's own input box: what it sends, and whether it is shown.
 *
 * Deliberately NOT Collie's send. Collie's checked Send Protocol writes the text, waits a profile's
 * settle time and then reads the screen back to decide whether the send landed; this surface writes
 * and does nothing else, because the operator is looking at the real terminal and is the check.
 *
 * What it does instead is what a terminal paste does — `terminal.paste()` in the emulator: line
 * breaks become carriage returns and the text is wrapped in bracketed-paste markers only when the
 * program asked for them. It is reproduced here rather than called because `paste()` emits the
 * whole text as ONE data event, which is one input frame of unbounded size, and the Gateway queues
 * at most a few kilobytes of input while a session is still being established. Splitting is safe at
 * any byte: the frames are written in order onto one socket and the terminal receives one stream.
 */

export const PASTE_START = "\u001b[200~";
export const PASTE_END = "\u001b[201~";

/** The most one input frame carries. Well under every bound between here and the terminal. */
export const TERMINAL_INPUT_CHUNK_BYTES = 4 * 1024;

/** Enter's pacing: a floor, a little more per KiB of text, and a ceiling. Pacing, never a check. */
export const ENTER_DELAY = { baseMs: 80, perKibMs: 10, maxMs: 1_000 } as const;

const encoder = new TextEncoder();

/**
 * The bytes a paste of `text` puts on the wire. Paste markers inside the text are removed, so a
 * draft cannot end the bracketed paste early and have the rest of itself read as keystrokes.
 */
export function pastePayload(text: string, bracketed: boolean): Uint8Array {
  const body = text.replaceAll(PASTE_START, "").replaceAll(PASTE_END, "").replace(/\r?\n/gu, "\r");
  return encoder.encode(bracketed ? `${PASTE_START}${body}${PASTE_END}` : body);
}

export function chunkBytes(bytes: Uint8Array, size = TERMINAL_INPUT_CHUNK_BYTES): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) chunks.push(bytes.subarray(offset, offset + size));
  return chunks;
}

/** How long Enter waits behind a paste of `bytes` bytes: base + perKib × ⌈KiB⌉, capped. */
export function enterDelayMs(bytes: number): number {
  const kib = Math.ceil(bytes / 1024);
  return Math.min(ENTER_DELAY.maxMs, ENTER_DELAY.baseMs + ENTER_DELAY.perKibMs * kib);
}

export interface TerminalSendDeps {
  /** Write one input frame's payload; false when the connection refused it (it is closed). */
  readonly write: (data: Uint8Array) => boolean;
  /** Whether the program asked for bracketed paste, read at the moment of sending. */
  readonly bracketed: boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Write `text` and then Enter. True only when every frame and the Enter were accepted — the one
 * condition under which the box may forget the draft.
 */
export async function sendToTerminal(text: string, deps: TerminalSendDeps): Promise<boolean> {
  const payload = pastePayload(text, deps.bracketed);
  for (const chunk of chunkBytes(payload)) if (!deps.write(chunk)) return false;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  await sleep(enterDelayMs(payload.length));
  return deps.write(encoder.encode("\r"));
}

export const TERMINAL_COMPOSER_STORAGE_KEY = "herdr-fleet:terminal-composer:v1";

export interface ComposerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Whether this browser shows the box. Anything but the literal stored "1" is hidden. */
export class TerminalComposerPreference {
  private value: boolean;
  private readonly listeners = new Set<() => void>();
  private readonly storage: ComposerStorage | null;

  constructor(storage: ComposerStorage | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(TERMINAL_COMPOSER_STORAGE_KEY) ?? null;
    } catch {
      // A browser that refuses storage still works; it starts with the box hidden.
    }
    this.value = raw === "1";
  }

  snapshot = (): boolean => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set = (shown: boolean): void => {
    if (this.value === shown) return;
    this.value = shown;
    try {
      this.storage?.setItem(TERMINAL_COMPOSER_STORAGE_KEY, shown ? "1" : "0");
    } catch {
      // Not remembering is a smaller failure than not showing what was asked for now.
    }
    for (const listener of Array.from(this.listeners)) listener();
  };
}

function browserStorage(): ComposerStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The app's own preference, read once at module load like the surface switch. */
export const terminalComposerPreference = new TerminalComposerPreference(browserStorage());
