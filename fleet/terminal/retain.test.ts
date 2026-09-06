import { describe, expect, test } from "bun:test";

import { retainedWindow } from "./retain.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const run = (from: number, count: number) =>
  new Uint8Array(Array.from({ length: count }, (_, i) => (from + i) % 256));

describe("what it keeps", () => {
  test("nothing, until something is pushed", () => {
    const window = retainedWindow(16);
    expect(window.size()).toBe(0);
    expect([...window.replay()]).toEqual([]);
  });

  test("everything, while it fits", () => {
    const window = retainedWindow(16);
    window.push(bytes(1, 2, 3));
    window.push(bytes(4, 5));
    expect(window.size()).toBe(5);
    expect([...window.replay()]).toEqual([1, 2, 3, 4, 5]);
  });

  test("an empty chunk changes nothing", () => {
    const window = retainedWindow(16);
    window.push(bytes(1, 2));
    window.push(new Uint8Array());
    expect([...window.replay()]).toEqual([1, 2]);
  });
});

describe("the bound", () => {
  test("is on bytes, and is exact rather than rounded to a frame", () => {
    const window = retainedWindow(4);
    window.push(bytes(1, 2, 3));
    window.push(bytes(4, 5, 6));
    expect(window.size()).toBe(4);
    expect([...window.replay()]).toEqual([3, 4, 5, 6]);
  });

  test("discards oldest first", () => {
    const window = retainedWindow(5);
    window.push(bytes(1, 2));
    window.push(bytes(3, 4));
    window.push(bytes(5, 6));
    expect([...window.replay()]).toEqual([2, 3, 4, 5, 6]);
  });

  test("a chunk larger than the whole window keeps its tail, not its head", () => {
    const window = retainedWindow(4);
    window.push(run(0, 100));
    expect(window.size()).toBe(4);
    expect([...window.replay()]).toEqual([96, 97, 98, 99]);
  });

  test("holds the bound over a long run of writes", () => {
    const window = retainedWindow(64);
    for (let i = 0; i < 500; i += 1) window.push(run(i, 7));
    expect(window.size()).toBe(64);
    expect(window.replay().length).toBe(64);
  });

  test("refuses a bound that is not a positive integer", () => {
    expect(() => retainedWindow(0)).toThrow();
    expect(() => retainedWindow(-1)).toThrow();
    expect(() => retainedWindow(1.5)).toThrow();
  });
});

describe("ending a session", () => {
  test("clearing means a later session cannot inherit the screen", () => {
    const window = retainedWindow(16);
    window.push(bytes(1, 2, 3));
    window.clear();
    expect(window.size()).toBe(0);
    expect([...window.replay()]).toEqual([]);
  });
});

describe("bytes, not text", () => {
  test("a UTF-8 sequence split across two chunks rejoins exactly", () => {
    const window = retainedWindow(16);
    const encoded = new TextEncoder().encode("é");
    window.push(encoded.subarray(0, 1));
    window.push(encoded.subarray(1));
    expect(new TextDecoder().decode(window.replay())).toBe("é");
  });
});
