import { expect, test } from "bun:test";
import { asJsonObject, asJsonString, parseJson, type JsonValue } from "../../web/src/lib/json.ts";
import { createTodoistService } from "./service.ts";
import { createTodoistStore, emptyTodoistState } from "./store.ts";
import { TodoistProvider, type ProviderFetch } from "./provider.ts";

function task(id: string, parent: string | null = null, checked = false, project = "project", recurring = false) {
  return { id, content: id, description: `Requirements for ${id}`, checked, parent_id: parent, project_id: project, section_id: null, updated_at: "revision-one", child_order: 1, due: recurring ? { is_recurring: true } : null };
}

function fixture() {
  const state = emptyTodoistState();
  state.app = { clientId: "example-client", clientSecret: "example-secret" };
  state.grant = { accessToken: "example-access", refreshToken: "example-refresh", accountId: "account", expiresAt: 100_000_000 };
  state.project = { id: "project", name: "Example" };
  let text = JSON.stringify(state), clock = 1000, tokenCalls = 0, rejectUpdate = false, filtersRemoved = false;
  const tasks = new Map([task("root"), task("parent", "root"), task("child", "parent"), task("other", null, false, "other-project")].map((row) => [row.id, row]));
  const writes: string[] = [], reads: string[] = [], queries: string[] = [];
  const fetcher: ProviderFetch = async (input, init) => {
    const url = new URL(String(input)), path = url.pathname.replace("/api/v1/", "");
    if (init?.method === "GET") { reads.push(path); queries.push(url.search); }
    if (path === "sync") {
      expect(new URLSearchParams(String(init?.body)).get("resource_types")).toBe('["filters"]');
      return Response.json({ full_sync: true, filters: filtersRemoved ? [] : [{ id: "focus", name: "Focus", query: "search: child" }, { id: "parents", name: "Parents", query: "search: parent" }] });
    }
    if (path === "tasks/filter") return Response.json({ results: [...tasks.values()].filter((row) => !row.checked && row.id === url.searchParams.get("query")?.replace("search: ", "")), next_cursor: null });
    if (url.pathname === "/oauth/access_token") { tokenCalls++; return Response.json({ access_token: "example-refreshed", refresh_token: "example-rotated", expires_in: 3600, scope: "data:read_write" }); }
    if (path === "user") return Response.json({ id: "account" });
    if (path === "projects") return Response.json({ results: [{ id: "project", name: "Example" }, { id: "other-project", name: "Other" }], next_cursor: null });
    if (path === "sections") return Response.json({ results: [], next_cursor: null });
    if (path === "tasks" && init?.method === "POST") {
      const body = asJsonObject(parseJson(String(init.body)));
      const created = task("created", asJsonString(body?.parent_id) ?? null, false, asJsonString(body?.project_id) ?? "project");
      created.content = asJsonString(body?.content) ?? ""; created.description = asJsonString(body?.description) ?? "";
      tasks.set(created.id, created); writes.push("tasks"); return Response.json(created);
    }
    if (path === "tasks" && init?.method === "GET") return Response.json({ results: [...tasks.values()].filter((row) => !row.checked && (!url.searchParams.has("project_id") || row.project_id === url.searchParams.get("project_id"))), next_cursor: null });
    if (path === "tasks/completed/by_completion_date") return Response.json({ items: [...tasks.values()].filter((row) => row.checked && (!url.searchParams.has("project_id") || row.project_id === url.searchParams.get("project_id"))) });
    const [, id, verb] = path.split("/");
    const row = id ? tasks.get(id) : undefined;
    if (!row) return new Response(null, { status: 404 });
    if (init?.method === "POST") {
      if (rejectUpdate) { rejectUpdate = false; return new Response(null, { status: 503 }); }
      writes.push(path);
      if (verb === "close") row.checked = true;
      else if (verb === "reopen") row.checked = false;
      else {
        const body = asJsonObject(parseJson(String(init.body)));
        row.description = asJsonString(body?.description) ?? row.description;
        row.content = asJsonString(body?.content) ?? row.content;
      }
      row.updated_at += "-next";
    }
    return Response.json(row);
  };
  const store = createTodoistStore("unused", { read: async () => text, write: async (_path, value) => { text = value; } });
  const service = createTodoistService({ store, origin: "https://example.com", fetcher, now: () => clock });
  return { service, store, tasks, writes, reads, queries, removeFilters: () => { filtersRemoved = true; }, setClock: (value: number) => { clock = value; }, tokenCalls: () => tokenCalls, rejectUpdate: () => { rejectUpdate = true; } };
}

test("OAuth state belongs to one session, expires and cannot be replayed; status never exposes secrets", async () => {
  const f = fixture();
  const url = new URL((await f.service.begin("session-one")).url), nonce = url.searchParams.get("state")!;
  expect(url.searchParams.get("scope")).toBe("data:read_write");
  await expect(f.service.exchange("session-other", nonce, "example-code")).rejects.toMatchObject({ code: "oauth_state_invalid" });
  await f.service.exchange("session-one", nonce, "example-code");
  await expect(f.service.exchange("session-one", nonce, "example-code")).rejects.toMatchObject({ code: "oauth_state_invalid" });
  const status = JSON.stringify(await f.service.status());
  expect(status).not.toContain("example-secret"); expect(status).not.toContain("example-refreshed");
  const expired = new URL((await f.service.begin("session-one")).url).searchParams.get("state")!;
  f.setClock(700_000);
  await expect(f.service.exchange("session-one", expired, "example-code")).rejects.toMatchObject({ code: "oauth_state_invalid" });
});

test("token rotation persists once while concurrent callers serialize", async () => {
  const f = fixture(); f.setClock(100_000_000);
  await Promise.all([f.service.tasks(0), f.service.projects()]);
  expect(f.tokenCalls()).toBe(1);
  expect((await f.store.read()).grant?.refreshToken).toBe("example-rotated");
});

test("deep hierarchy guards refuse provider cascades and allow explicit outer-to-inner reopening", async () => {
  const f = fixture();
  await expect(f.service.complete(0, "root", false)).rejects.toMatchObject({ code: "descendants_incomplete", blockers: [{ id: "parent" }, { id: "child" }] });
  expect(f.writes).toEqual([]);
  await f.service.complete(0, "child", false);
  await f.service.complete(0, "parent", false);
  await f.service.complete(0, "root", false);
  await expect(f.service.complete(0, "child", true)).rejects.toMatchObject({ code: "ancestors_completed", blockers: [{ id: "root" }, { id: "parent" }] });
  await f.service.complete(0, "root", true);
  await f.service.complete(0, "parent", true);
  await f.service.complete(0, "child", true);
  expect(f.tasks.get("child")?.checked).toBe(false);
});

test("all projects are listed while parent membership and stale accounts guard mutations", async () => {
  const f = fixture();
  const snapshot = await f.service.tasks(0);
  expect(snapshot.projects.map((project) => project.id)).toEqual(["project", "other-project"]);
  expect(snapshot.tasks.map((entry) => entry.id)).toContain("other");
  await f.service.edit(0, "other", "Changed", "Changed", "revision-one");
  expect(f.tasks.get("other")?.description).toBe("Changed");
  await expect(f.service.create(0, "Mismatch", "", "parent", "other-project")).rejects.toMatchObject({ code: "project_mismatch" });
  await expect(f.service.create(0, "Missing", "", null, "absent-project")).rejects.toMatchObject({ code: "project_unavailable" });
  await f.service.create(0, "Other root", "", null, "other-project");
  expect(f.tasks.get("created")?.project_id).toBe("other-project");
  await f.service.disconnect();
  await expect(f.service.complete(0, "child", false)).rejects.toMatchObject({ code: "selection_changed" });
});

test("history and bindings include multiple projects and legacy selection does not narrow them", async () => {
  const f = fixture(), terminal = { version: 1 as const, host: "member-a", session: "default", id: "herdr:term_one" };
  await f.service.bind(0, "child", terminal);
  await f.service.bind(0, "other", terminal);
  expect((await f.service.status()).links).toHaveLength(2);
  await f.service.complete(0, "child", false);
  await f.service.complete(0, "other", false);
  expect((await f.service.history(0, 1000)).tasks.map((entry) => entry.id)).toEqual(["child", "other"]);
});

test("partial backlinks remain retryable, idempotent and many-to-many without touching user text", async () => {
  const f = fixture(), terminal = { version: 1 as const, host: "member-a", session: "default", id: "herdr:term_one" };
  f.rejectUpdate();
  await expect(f.service.bind(0, "child", terminal)).rejects.toMatchObject({ code: "provider_rejected" });
  expect((await f.store.read()).links).toHaveLength(1);
  expect((await f.store.read()).links[0]?.state).toBe("pending");
  await f.service.bind(0, "child", terminal);
  const once = f.tasks.get("child")!.description;
  await f.service.bind(0, "child", terminal);
  expect(f.tasks.get("child")!.description).toBe(once);
  const other = { ...terminal, id: "herdr:term_two" };
  await f.service.bind(0, "child", other);
  expect((await f.store.read()).links).toHaveLength(2);
  expect(f.tasks.get("child")!.description.match(/https:\/\/example.com\/fleet\/bindings\//g)).toHaveLength(2);
  await f.service.bind(0, "child", terminal, true);
  expect((await f.store.read()).links).toHaveLength(1);
  await f.service.bind(0, "child", other, true);
  expect(f.tasks.get("child")!.description).toBe("Requirements for child");
});

test("description-led messages include ancestor titles only and editing stale state refuses", async () => {
  const f = fixture();
  const message = await f.service.message(0, "child");
  expect(message.text).toContain("Parent tasks: root > parent");
  expect(message.text).toContain("Requirements for child");
  expect(message.text).not.toContain("Requirements for parent");
  await expect(f.service.edit(0, "child", "New", "New", "old-revision")).rejects.toMatchObject({ code: "task_changed" });
  expect(f.writes).toEqual([]);
});

test("pagination reads every page and refuses a repeating cursor", async () => {
  const pages: JsonValue[] = [{ results: [task("one")], next_cursor: "next" }, { results: [task("two")], next_cursor: null }];
  const seen: string[] = [];
  const api = new TodoistProvider("example-token", async (url) => { seen.push(String(url)); return Response.json(pages.shift()); });
  expect((await api.tasks("project")).map((row) => row.id)).toEqual(["one", "two"]);
  expect(seen[1]).toContain("cursor=next");
  const repeating = new TodoistProvider("example-token", async () => Response.json({ results: [], next_cursor: "same" }));
  await expect(repeating.tasks("project")).rejects.toMatchObject({ code: "provider_invalid_response" });
  const malformed = new TodoistProvider("example-token", async () => Response.json({ results: [], next_cursor: 42 }));
  await expect(malformed.tasks("project")).rejects.toMatchObject({ code: "provider_invalid_response" });
});

test("creation and edits preserve hierarchy and existing backlink text", async () => {
  const f = fixture();
  await f.service.create(0, "A subtask", "Its requirements", "parent", "project");
  expect(f.tasks.get("created")).toMatchObject({ parent_id: "parent", project_id: "project", description: "Its requirements" });
  const terminal = { version: 1 as const, host: "member-a", session: "default", id: "herdr:term_one" };
  await f.service.bind(0, "created", terminal);
  const current = f.tasks.get("created")!;
  await f.service.edit(0, "created", "Edited", "New requirements", current.updated_at);
  expect(current.content).toBe("Edited");
  expect(current.description).toStartWith("New requirements\n\n<!-- herdr-fleet:");
  expect(current.description).toContain("https://example.com/fleet/bindings/");
});

test("historical recurring occurrences cannot accidentally complete or reopen the active next occurrence", async () => {
  const f = fixture(); f.tasks.set("repeat", task("repeat", null, false, "project", true));
  await expect(f.service.complete(0, "repeat", true)).rejects.toMatchObject({ code: "recurring_occurrence" });
  expect(f.writes).toEqual([]);
});

test("Settings selection persists project/filter scope and stale views cannot mutate", async () => {
  const f = fixture();
  expect((await f.service.choices()).filters.map((entry) => entry.id)).toEqual(["focus", "parents"]);
  await f.service.selectScope(0, { kind: "project", id: "other-project", name: "Untrusted name" });
  expect((await f.service.status()).scope).toEqual({ kind: "project", id: "other-project", name: "Other" });
  expect((await f.service.tasks(1)).tasks.map((entry) => entry.id)).toEqual(["other"]);
  await expect(f.service.complete(0, "other", false)).rejects.toMatchObject({ code: "selection_changed" });
  await f.service.selectScope(1, { kind: "filter", id: "focus", name: "Ignored" });
  const result = await f.service.tasks(2);
  expect(result.tasks.map((entry) => entry.id)).toEqual(["child"]);
  expect(result.contextTasks.map((entry) => entry.id)).toEqual(["parent", "root"]);
  expect((await f.store.read()).scope).toMatchObject({ kind: "filter", name: "Focus" });
  await f.service.history(2, 1000);
  expect(f.queries.some((query) => new URLSearchParams(query).get("filter_query") === "search: child")).toBe(true);
  f.removeFilters();
  await expect(f.service.tasks(2)).rejects.toMatchObject({ code: "scope_unavailable" });
  await f.service.selectScope(2, { kind: "all" });
  expect((await f.service.tasks(3)).tasks).toHaveLength(4);
});

test("a filtered-out child still blocks completion of its matching parent", async () => {
  const f = fixture();
  await f.service.selectScope(0, { kind: "filter", id: "parents", name: "Parents" });
  const snapshot = await f.service.tasks(1);
  expect(snapshot.tasks.map((entry) => entry.id)).toEqual(["parent"]);
  expect(snapshot.treeTasks.map((entry) => entry.id)).toEqual(["parent", "child"]);
  await expect(f.service.complete(1, "parent", false)).rejects.toMatchObject({ code: "descendants_incomplete", blockers: [{ id: "child" }] });
  expect(f.writes).toEqual([]);
});

test("filtered trees recursively include grandchildren without pulling unrelated tasks into List", async () => {
  const f = fixture();
  f.tasks.set("grandchild", task("grandchild", "child"));
  await f.service.selectScope(0, { kind: "filter", id: "parents", name: "Parents" });
  const snapshot = await f.service.tasks(1);
  expect(snapshot.tasks.map((entry) => entry.id)).toEqual(["parent"]);
  expect(snapshot.treeTasks.map((entry) => entry.id)).toEqual(["parent", "child", "grandchild"]);
  expect(snapshot.contextTasks.map((entry) => entry.id)).toEqual(["root"]);
});
