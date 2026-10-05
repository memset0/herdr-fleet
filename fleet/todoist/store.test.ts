import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTodoistStore, parseTodoistState } from "./store.ts";

test("runtime credentials use private atomic storage and corrupt state is never replaced", async () => {
  const root = await mkdtemp(join(tmpdir(), "fleet-todoist-state-"));
  try {
    const path = join(root, "todoist.json"), store = createTodoistStore(path);
    await store.run(async (state, save) => { state.app = { clientId: "example-client", clientSecret: "example-secret" }; await save(); });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await createTodoistStore(path).read()).app?.clientId).toBe("example-client");
    await writeFile(path, "unfinished edit", { mode: 0o600 });
    await expect(store.run(async (_state, save) => save())).rejects.toThrow("Invalid Todoist state");
    expect(await readFile(path, "utf8")).toBe("unfinished edit");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a pre-selection state defaults to All without reviving the retired project restriction", () => {
  const legacy = { schemaVersion: 1, app: null, grant: null, project: { id: "project", name: "Example" }, generation: 2, links: [] };
  expect(parseTodoistState(legacy)?.scope).toEqual({ kind: "all" });
  expect(parseTodoistState({ ...legacy, scope: { kind: "filter" } })).toBeNull();
});
