import { describe, expect, test } from "bun:test";

import { EARLY_EXIT_WINDOW_MS, EARLY_TAIL_BYTES, EARLY_TAIL_CHARS, EarlyTail, sanitizeTail } from "./early-exit.ts";

const encoder = new TextEncoder();
const clean = (text: string, limit?: number): string => sanitizeTail(encoder.encode(text), limit);

describe("the printable tail of terminal output", () => {
  test("colour and cursor sequences are removed, and a movement still separates words", () => {
    expect(clean("\x1b[1;31mkind:\x1b[0m InvalidData")).toBe("kind: InvalidData");
    expect(clean("left\x1b[2Cright")).toBe("left right");
    expect(clean("\x1b[?1049h\x1b[H\x1b[2Jready")).toBe("ready");
  });

  test("string sequences go whole, whichever way they are terminated", () => {
    expect(clean("\x1b]0;a window title\x07after")).toBe("after");
    expect(clean("\x1b]8;;https://example.com\x1b\\link\x1b]8;;\x1b\\")).toBe("link");
    expect(clean("\x1bPq#0;2;0;0;0\x1b\\done")).toBe("done");
  });

  test("a sequence the output ends inside is not text", () => {
    expect(clean("error: gone\x1b[38;5")).toBe("error: gone");
    expect(clean("error: gone\x1b]0;unterminated title")).toBe("error: gone");
    expect(clean("error: gone\x1b")).toBe("error: gone");
  });

  test("controls are dropped, line breaks and tabs read as spaces, and runs collapse", () => {
    expect(clean("a\r\n\tb\x00\x07\x08c\x7f  \n d")).toBe("a bc d");
    expect(clean("x\u0085\u009by")).toBe("xy");
    expect(clean("\x1b(Bplain\x1b=")).toBe("plain");
  });

  test("text that is not UTF-8 leaves no replacement characters behind", () => {
    expect(sanitizeTail(new Uint8Array([0xff, 0x61, 0xc3]))).toBe("a");
    expect(clean("终端错误")).toBe("终端错误");
  });

  test("only the last characters are kept, marked as cut", () => {
    const long = "x".repeat(EARLY_TAIL_CHARS) + "END";
    const tail = clean(long);
    expect(Array.from(tail)).toHaveLength(EARLY_TAIL_CHARS);
    expect(tail.startsWith("…")).toBe(true);
    expect(tail.endsWith("END")).toBe(true);
    expect(clean("abcdef", 4)).toBe("…def");
    expect(clean("abcd", 4)).toBe("abcd");
  });
});

describe("the capture a session keeps", () => {
  test("inside the window it yields the tail of what was printed", () => {
    const capture = new EarlyTail(1_000);
    capture.push(encoder.encode("kind: InvalidData, "), 1_000);
    capture.push(encoder.encode("error: zero-sized grid\r\n"), 1_001);
    expect(capture.lifetime(1_001)).toBe(1);
    expect(capture.take(1_001)).toBe("kind: InvalidData, error: zero-sized grid");
    // Taken once: the buffer is gone afterwards.
    expect(capture.take(1_001)).toBeNull();
  });

  test("nothing printed is still an early exit, with an empty tail", () => {
    expect(new EarlyTail(0).take(EARLY_EXIT_WINDOW_MS)).toBe("");
  });

  test("the first output after the window discards everything, for good", () => {
    const capture = new EarlyTail(0);
    capture.push(encoder.encode("opening repaint"), 10);
    expect(capture.size()).toBeGreaterThan(0);
    capture.push(encoder.encode("ordinary work"), EARLY_EXIT_WINDOW_MS + 1);
    expect(capture.size()).toBe(0);
    capture.push(encoder.encode("more"), EARLY_EXIT_WINDOW_MS + 2);
    expect(capture.size()).toBe(0);
    expect(capture.take(EARLY_EXIT_WINDOW_MS + 3)).toBeNull();
  });

  test("an end after the window yields nothing even without later output", () => {
    const capture = new EarlyTail(0);
    capture.push(encoder.encode("opening repaint"), 10);
    expect(capture.take(EARLY_EXIT_WINDOW_MS + 1)).toBeNull();
  });

  test("it never holds more than its byte bound, keeping the newest", () => {
    const capture = new EarlyTail(0);
    for (let index = 0; index < 20; index += 1) capture.push(encoder.encode(`${"a".repeat(500)}${index}`), 1);
    expect(capture.size()).toBe(EARLY_TAIL_BYTES);
    capture.push(new Uint8Array(EARLY_TAIL_BYTES * 2).fill(0x62), 2);
    expect(capture.size()).toBe(EARLY_TAIL_BYTES);
    capture.push(encoder.encode("tail"), 3);
    expect(capture.take(3)?.endsWith("btail")).toBe(true);
  });
});
