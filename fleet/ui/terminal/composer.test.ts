import { describe, expect, test } from "bun:test";

import {
  PASTE_END,
  PASTE_START,
  TERMINAL_COMPOSER_STORAGE_KEY,
  TERMINAL_INPUT_CHUNK_BYTES,
  TerminalComposerPreference,
  chunkBytes,
  enterDelayMs,
  pastePayload,
  sendToTerminal,
} from "./composer.ts";

const decoder = new TextDecoder();

describe("the paste it writes", () => {
  test("is bracketed only when the program asked for it, with line breaks as carriage returns", () => {
    expect(decoder.decode(pastePayload("a\nb\r\nc", true))).toBe(`${PASTE_START}a\rb\rc${PASTE_END}`);
    expect(decoder.decode(pastePayload("a\nb", false))).toBe("a\rb");
  });

  test("cannot end its own bracket early", () => {
    expect(decoder.decode(pastePayload(`x${PASTE_END}rm -rf /${PASTE_START}`, true))).toBe(`${PASTE_START}xrm -rf /${PASTE_END}`);
  });
});

describe("chunking", () => {
  test("splits into bounded frames that reassemble to the same bytes", () => {
    const bytes = new Uint8Array(TERMINAL_INPUT_CHUNK_BYTES * 2 + 7).map((_, index) => index % 251);
    const chunks = chunkBytes(bytes);
    expect(chunks.map((chunk) => chunk.length)).toEqual([TERMINAL_INPUT_CHUNK_BYTES, TERMINAL_INPUT_CHUNK_BYTES, 7]);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes));
  });
});

describe("Enter's pacing", () => {
  test("grows with the paste and is capped", () => {
    expect(enterDelayMs(10)).toBe(90);
    expect(enterDelayMs(10 * 1024)).toBe(180);
    expect(enterDelayMs(10 * 1024 * 1024)).toBe(1_000);
  });
});

describe("a send", () => {
  test("writes every frame, waits the pacing delay, then Enter", async () => {
    const written: string[] = [];
    const waited: number[] = [];
    const text = "x".repeat(TERMINAL_INPUT_CHUNK_BYTES + 1);
    const ok = await sendToTerminal(text, {
      bracketed: false,
      write: (data) => written.push(decoder.decode(data)) > 0,
      sleep: async (ms) => {
        waited.push(ms);
      },
    });
    expect(ok).toBe(true);
    expect(written.map((frame) => frame.length)).toEqual([TERMINAL_INPUT_CHUNK_BYTES, 1, 1]);
    expect(written.at(-1)).toBe("\r");
    expect(waited).toEqual([enterDelayMs(TERMINAL_INPUT_CHUNK_BYTES + 1)]);
  });

  test("stops and reports failure when the connection refuses a frame", async () => {
    let calls = 0;
    const ok = await sendToTerminal("hello", { bracketed: true, write: () => (calls += 1) < 0, sleep: async () => undefined });
    expect(ok).toBe(false);
    expect(calls).toBe(1);
  });
});

describe("whether the box is shown", () => {
  test("defaults to hidden, persists a choice, and survives a storage that throws", () => {
    const box: Record<string, string> = {};
    const storage = { getItem: (key: string) => box[key] ?? null, setItem: (key: string, value: string) => void (box[key] = value) };
    const first = new TerminalComposerPreference(storage);
    expect(first.snapshot()).toBe(false);
    first.set(true);
    expect(box[TERMINAL_COMPOSER_STORAGE_KEY]).toBe("1");
    expect(new TerminalComposerPreference(storage).snapshot()).toBe(true);

    const hostile = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const refused = new TerminalComposerPreference(hostile);
    expect(refused.snapshot()).toBe(false);
    refused.set(true);
    expect(refused.snapshot()).toBe(true);
  });
});
