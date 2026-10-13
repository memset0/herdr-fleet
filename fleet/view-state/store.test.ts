import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TerminalRef } from "../bindings/identity.ts";
import { parseViewCommand, parseViewSnapshot } from "./document.ts";
import { createViewStateStore, type ViewStateIo } from "./store.ts";
import { viewStateResponse } from "./route.ts";

const a: TerminalRef = { version: 1, host: "member-a", session: "default", id: "herdr:term_a" };
const b: TerminalRef = { ...a, host: "member-b" };
const valid = async () => true;
function memory() {
  let text: string | null = null;
  const io: ViewStateIo = { read: async () => text, write: async (_path, next) => { text = next; } };
  return io;
}
const slot = (index: number, terminal: TerminalRef | null, expected: TerminalRef | null = null) => ({ type: "slot" as const, index, terminal, expected, rows: 3, columns: 4 });

test("serial selection writes use lead order and slots survive a new generation", async () => {
  const io = memory(), store = createViewStateStore("example.json", io);
  const [first, second] = await Promise.all([
    store.mutate({ type: "select", terminal: a }, valid), store.mutate({ type: "select", terminal: b }, valid),
  ]);
  expect(first.ok && first.snapshot.revision).toBe(1);
  expect(second.ok && second.snapshot.selection).toEqual(b);
  await store.mutate(slot(2, a), valid);
  const restarted = await createViewStateStore("example.json", io).read();
  expect(restarted.slots[2]).toEqual(a);
  expect(restarted.selection).toBeNull();
  expect(restarted.generation).not.toBe((await store.read()).generation);
  expect(parseViewSnapshot(JSON.parse(JSON.stringify(restarted)))).toEqual(restarted);
});

test("different slots compose, an occupied slot conflicts, and moving never duplicates", async () => {
  const store = createViewStateStore("example.json", memory());
  const results = await Promise.all([store.mutate(slot(0, a), valid), store.mutate(slot(1, b), valid)]);
  expect(results.every((result) => result.ok)).toBe(true);
  expect(await store.mutate(slot(0, b), valid)).toMatchObject({ ok: false, error: "conflict" });
  expect((await store.mutate(slot(0, b, a), valid)).ok).toBe(true);
  expect((await store.read()).slots.slice(0, 2)).toEqual([b, null]);
  expect((await store.mutate(slot(0, null, b), valid)).ok).toBe(true);
});

test("resize preserves references and refuses to discard occupied cells or stale layout", async () => {
  const store = createViewStateStore("example.json", memory());
  await store.mutate(slot(11, a), valid);
  const smaller = { type: "layout" as const, rows: 1, columns: 1, expectedRows: 3, expectedColumns: 4 };
  expect(await store.mutate(smaller, valid)).toMatchObject({ ok: false, error: "occupied" });
  await store.mutate(slot(11, null, a), valid);
  expect((await store.mutate(smaller, valid)).ok).toBe(true);
  expect(await store.mutate(slot(0, a), valid)).toMatchObject({ ok: false, error: "conflict" });
  expect((await store.read()).slots).toEqual([null]);
});

test("failed validation or persistence never changes the accepted state", async () => {
  const io = memory(), store = createViewStateStore("example.json", io);
  expect(await store.mutate({ type: "select", terminal: a }, async () => false)).toMatchObject({ ok: false, error: "unavailable" });
  expect((await store.read()).revision).toBe(0);
  io.write = async () => { throw new Error("example failure"); };
  await expect(store.mutate(slot(0, a), valid)).rejects.toThrow("example failure");
  expect((await store.read()).slots[0]).toBeNull();
});

test("disk writes are owner-only and readable by a fresh store", async () => {
  const root = await mkdtemp(join(tmpdir(), "fleet-panel-test-"));
  try {
    const file = join(root, "panel.json");
    await createViewStateStore(file).mutate(slot(0, a), valid);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, "utf8")).toContain("term_a");
    expect((await createViewStateStore(file).read()).slots[0]).toEqual(a);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the route rejects malformed, oversized and unavailable references", async () => {
  const store = createViewStateStore("example.json", memory());
  const post = (body: string) => new Request("https://fleet.example.test/fleet/api/view-state", { method: "POST", body });
  expect((await viewStateResponse(post("{}"), store, async () => [])).status).toBe(400);
  expect((await viewStateResponse(post("x".repeat(4097)), store, async () => [])).status).toBe(413);
  expect((await viewStateResponse(post(JSON.stringify({ type: "select", terminal: a })), store, async () => [])).status).toBe(422);
  expect(parseViewCommand({ type: "slot", index: -1, terminal: { ...a }, expected: null, rows: 3, columns: 4 })).toBeNull();
  expect(parseViewCommand({ type: "layout", rows: 9, columns: 1, expectedRows: 3, expectedColumns: 4 })).toBeNull();
});

test("only successful mutations notify and a broken subscriber cannot fail a committed write", async () => {
  const store = createViewStateStore("example.json", memory());
  const sequences: number[] = [];
  const stop = store.subscribe((snapshot) => sequences.push(snapshot.sequence!));
  store.subscribe(() => { throw new Error("Disconnected receiver"); });
  await store.mutate({ type: "select", terminal: a }, valid);
  await store.mutate(slot(0, a), valid);
  await store.mutate(slot(0, b), valid);
  expect(sequences).toEqual([1, 2]);
  stop(); await store.mutate({ type: "select", terminal: b }, valid);
  expect(sequences).toEqual([1, 2]);
});
