import { describe, expect, test } from "bun:test";

import { InstancePool } from "./pool.ts";

function pool(max: number) {
  const disposed: string[] = [];
  return { disposed, instance: new InstancePool<string>({ max, dispose: (value) => void disposed.push(value) }) };
}

describe("keeping a few terminals", () => {
  test("a return within the bound gets the same instance back", () => {
    const p = pool(2);
    p.instance.put("a", "terminal-a");
    p.instance.put("b", "terminal-b");
    expect(p.instance.get("a")).toBe("terminal-a");
    expect(p.disposed).toEqual([]);
  });

  test("beyond the bound the least recently used one is disposed", () => {
    const p = pool(2);
    p.instance.put("a", "terminal-a");
    p.instance.put("b", "terminal-b");
    // Touching "a" makes "b" the oldest.
    p.instance.get("a");
    p.instance.put("c", "terminal-c");
    expect(p.disposed).toEqual(["terminal-b"]);
    expect(p.instance.keys()).toEqual(["a", "c"]);
  });

  test("replacing a key disposes what was there, and replacing it with itself does not", () => {
    const p = pool(2);
    p.instance.put("a", "first");
    p.instance.put("a", "second");
    expect(p.disposed).toEqual(["first"]);
    p.instance.put("a", "second");
    expect(p.disposed).toEqual(["first"]);
  });

  test("releasing hands ownership over without disposing", () => {
    const p = pool(2);
    p.instance.put("a", "terminal-a");
    expect(p.instance.release("a")).toBe("terminal-a");
    expect(p.instance.size()).toBe(0);
    expect(p.disposed).toEqual([]);
  });

  test("dropping and clearing dispose exactly once each", () => {
    const p = pool(3);
    p.instance.put("a", "terminal-a");
    p.instance.put("b", "terminal-b");
    p.instance.drop("a");
    p.instance.drop("a");
    expect(p.disposed).toEqual(["terminal-a"]);
    p.instance.clear();
    expect(p.disposed).toEqual(["terminal-a", "terminal-b"]);
    expect(p.instance.size()).toBe(0);
  });

  test("a pool of none is not a pool", () => {
    expect(() => new InstancePool<string>({ max: 0, dispose: () => undefined })).toThrow();
  });
});
