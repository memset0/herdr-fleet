import { describe, expect, test } from "bun:test";

import { createSettingsStore, type SettingsStoreIo } from "./store.ts";

const PATH = "/cfg/settings.json";

function fakeIo() {
  const files = new Map<string, { text: string; mtime: number }>();
  let clock = 1000;
  const warnings: string[] = [];
  const io: SettingsStoreIo = {
    async mtime(path) {
      return files.get(path)?.mtime ?? null;
    },
    async read(path) {
      const file = files.get(path);
      if (file === undefined) throw new Error("missing");
      return file.text;
    },
    async write(path, text) {
      clock += 1;
      files.set(path, { text, mtime: clock });
    },
  };
  return {
    io,
    warnings,
    warn: (message: string) => warnings.push(message),
    put(text: string) {
      clock += 1;
      files.set(PATH, { text, mtime: clock });
    },
    raw: () => files.get(PATH)?.text,
  };
}

const VALID = JSON.stringify({ schemaVersion: 1, shortcuts: { bindings: { "next-tab": ["Prefix+M"] } } });

describe("reading the document", () => {
  test("no file is the shipped defaults and no warning", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    const snapshot = await store.read();
    expect(snapshot.version).toBe("");
    expect(snapshot.settings.bindings.size).toBe(0);
    expect(disk.warnings).toEqual([]);
  });

  test("an edit on disk is picked up without anything being restarted", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    expect((await store.read()).settings.bindings.size).toBe(0);
    disk.put(VALID);
    expect((await store.read()).settings.bindings.has("next-tab")).toBe(true);
  });

  test("a broken file keeps the last good settings and warns once per change", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    disk.put(VALID);
    await store.read();
    disk.put("{ half written");
    expect((await store.read()).settings.bindings.has("next-tab")).toBe(true);
    await store.read();
    await store.read();
    expect(disk.warnings).toHaveLength(1);
  });

  test("a file that fails validation is held the same way as one that fails to parse", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    disk.put(JSON.stringify({ shortcuts: { bindings: { nope: [] } } }));
    expect((await store.read()).version).toBe("");
    expect(disk.warnings[0]).toContain("nope");
  });
});

describe("writing the document", () => {
  test("a valid write replaces the file and answers with the new version", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    const before = await store.read();
    const result = await store.write(VALID, before.version);
    expect(result.ok).toBe(true);
    expect(result.ok && result.snapshot.version).not.toBe("");
    expect(disk.raw()).toBe(VALID);
  });

  test("an invalid write leaves the file byte-identical", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    disk.put(VALID);
    const before = await store.read();
    const result = await store.write('{"shortcuts":{"bindings":{"nope":[]}}}', before.version);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("invalid");
    expect(disk.raw()).toBe(VALID);
  });

  test("a stale write is refused and hands back what is actually there", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    const stale = await store.read();
    // Somebody else — the operator's own scope, on disk — writes between the read and the save.
    disk.put(VALID);
    const result = await store.write("{}", stale.version);
    expect(result.ok === false && result.reason).toBe("conflict");
    expect(result.ok === false && result.reason === "conflict" && result.snapshot.text).toBe(VALID);
    expect(disk.raw()).toBe(VALID);
  });

  test("writing twice in a row works, because the version moves with the file", async () => {
    const disk = fakeIo();
    const store = createSettingsStore(PATH, disk.io, disk.warn);
    const first = await store.write(VALID, (await store.read()).version);
    expect(first.ok).toBe(true);
    const second = await store.write("{}", first.ok ? first.snapshot.version : "");
    expect(second.ok).toBe(true);
    expect(disk.raw()).toBe("{}");
  });
});
