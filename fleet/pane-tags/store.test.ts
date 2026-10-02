import { afterAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { changeTags, emptyTags, MAX_NAME, MAX_TAGS, parseTagCommand, parseTagDocument, TAG_COLORS, tagsForPane } from "./document.ts";
import { createTagStore } from "./store.ts";

const roots: string[] = [];
afterAll(async () => { for (const path of roots) await rm(path, { recursive: true, force: true }); });
const pane = { row: "lead\u0000work\u0000pane-1", space: "Project" };
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "fleet-tags-")); roots.push(root);
  const path = join(root, "tags.json"), store = createTagStore(path);
  return { path, store };
}

test("same normalized name reuses one randomly colored definition across panes and restart", async () => {
  const { path, store } = await setup();
  const command = parseTagCommand({ kind: "attach", pane, name: "  Cafe\u0301  " });
  expect(command).not.toBeNull();
  expect((await store.mutate("", command!)).ok).toBe(true);
  const first = await store.read();
  expect(first.document.tags[0]!.name).toBe("Café");
  expect(TAG_COLORS.some((color) => color === first.document.tags[0]!.color)).toBe(true);
  const other = { ...pane, row: "peer\u0000work\u0000pane-1" };
  await store.mutate(first.version, { kind: "attach", pane: other, name: "Café" });
  const restarted = await createTagStore(path).read();
  expect(restarted.document.tags).toEqual(first.document.tags);
  expect(tagsForPane(restarted.document, other)).toEqual(first.document.tags);
  expect(tagsForPane(restarted.document, { ...pane, space: "Other" })).toEqual([]);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
});

test("rename and recolor keep associations; detach affects one pane only", async () => {
  const { store } = await setup();
  const other = { ...pane, row: "lead\u0000work\u0000pane-2" };
  await store.mutate("", { kind: "attach", pane, name: "Review" });
  let state = await store.read();
  await store.mutate(state.version, { kind: "attach", pane: other, name: "Review" });
  state = await store.read();
  const id = state.document.tags[0]!.id;
  await store.mutate(state.version, { kind: "edit", id, name: "Ready", color: "#123456" });
  state = await store.read();
  expect(tagsForPane(state.document, pane)).toEqual([{ id, name: "Ready", color: "#123456" }]);
  expect(tagsForPane(state.document, other)).toEqual(tagsForPane(state.document, pane));
  await store.mutate(state.version, { kind: "detach", pane, id });
  state = await store.read();
  expect(tagsForPane(state.document, pane)).toEqual([]);
  expect(tagsForPane(state.document, other)).toHaveLength(1);
  expect(state.document.tags).toHaveLength(1);
});

test("concurrent writes cannot both replace the same version", async () => {
  const { store } = await setup();
  const results = await Promise.all([
    store.mutate("", { kind: "attach", pane, name: "One" }),
    store.mutate("", { kind: "attach", pane, name: "Two" }),
  ]);
  expect(results.map((result) => result.ok)).toEqual([true, false]);
  expect(results[1]).toMatchObject({ error: "conflict" });
  expect((await store.read()).document.tags.map((tag) => tag.name)).toEqual(["One"]);
});

test("duplicate rename refuses atomically", async () => {
  const { store, path } = await setup();
  await store.mutate("", { kind: "attach", pane, name: "One" });
  let state = await store.read();
  await store.mutate(state.version, { kind: "attach", pane, name: "Two" });
  state = await store.read();
  const before = await readFile(path, "utf8");
  expect(await store.mutate(state.version, { kind: "edit", id: state.document.tags[0]!.id, name: "Two", color: "#123456" })).toEqual({ ok: false, error: "duplicate" });
  expect(await readFile(path, "utf8")).toBe(before);
});

test("a malformed existing file is never treated as empty or overwritten", async () => {
  const { store, path } = await setup();
  await writeFile(path, "broken");
  await expect(store.read()).rejects.toThrow();
  await expect(store.mutate("", { kind: "attach", pane, name: "One" })).rejects.toThrow();
  expect(await readFile(path, "utf8")).toBe("broken");
});

test("a failed write does not change durable state or poison later mutations", async () => {
  let content: string | null = null, fail = true;
  const store = createTagStore("unused", {
    read: async () => content,
    write: async (_path, text) => { if (fail) throw new Error("disk full"); content = text; },
  });
  await expect(store.mutate("", { kind: "attach", pane, name: "One" })).rejects.toThrow("disk full");
  expect((await store.read()).document).toEqual(emptyTags());
  fail = false;
  expect((await store.mutate("", { kind: "attach", pane, name: "One" })).ok).toBe(true);
});

test("untrusted commands and documents are bounded and reject dangling or duplicate definitions", () => {
  expect(parseTagCommand({ kind: "attach", pane, name: "x".repeat(MAX_NAME + 1) })).toBeNull();
  expect(parseTagCommand({ kind: "attach", pane, name: " \n " })).toBeNull();
  expect(parseTagCommand({ kind: "edit", id: "a", name: "Name", color: "red;display:none" })).toBeNull();
  expect(parseTagDocument({ schemaVersion: 1, tags: [], panes: [{ ...pane, tags: ["missing"] }] })).toBeNull();
  expect(parseTagDocument({ schemaVersion: 1, tags: [{ id: "a", name: "One", color: "#123456" }, { id: "b", name: "One", color: "#654321" }], panes: [] })).toBeNull();
  const full = { ...emptyTags(), tags: Array.from({ length: MAX_TAGS }, (_, i) => ({ id: `tag-${i}`, name: `Tag ${i}`, color: "#123456" })) };
  expect(changeTags(full, { kind: "attach", pane, name: "Extra" }, () => ({ id: "extra", color: "#123456" }))).toEqual({ ok: false, error: "limit" });
});
