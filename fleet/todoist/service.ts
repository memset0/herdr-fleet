import { randomBytes, randomUUID } from "node:crypto";
import { asJsonNumber, asJsonObject, asJsonString } from "../../web/src/lib/json.ts";
import { attachRelation, detachRelation, sameTerminal, type TerminalRef } from "../bindings/identity.ts";
import { completionBlockers, parseTask, taskDescriptionParts, taskMessage, todoId, withTaskLinks, type TodoProject, type TodoTask, type TodoScope } from "./model.ts";
import { providerJson, TodoistError, TodoistProvider, type ProviderFetch } from "./provider.ts";
import type { TodoistState, TodoistStore, TodoLink } from "./store.ts";

const CALLBACK_PATH = "/fleet/todoist/callback";
export const TODOIST_API = "/fleet/api/todoist";

export interface TodoistOptions {
  readonly store: TodoistStore;
  readonly origin: string;
  readonly fetcher?: ProviderFetch;
  readonly now?: () => number;
}

const connected = (state: TodoistState, generation: number) => {
  if (generation !== state.generation) throw new TodoistError("selection_changed", 409);
  if (!state.grant) throw new TodoistError("not_connected", 409);
  return { accountId: state.grant.accountId };
};
const accountLinks = (state: TodoistState) => state.links.filter((link) => link.accountId === state.grant?.accountId);
const projectList = async (api: TodoistProvider): Promise<TodoProject[]> => {
  const projects = await api.pages("projects", {});
  return projects.map((value) => {
    const object = asJsonObject(value), id = todoId(object?.id), name = asJsonString(object?.name);
    if (!id || name === undefined) throw new TodoistError("provider_invalid_response", 502);
    return { id, name };
  });
};

const hierarchy = async (api: TodoistProvider, projectId: string) => {
  const active = await api.tasks(projectId);
  const all = new Map(active.map((task) => [task.id, task]));
  // Ancestors absent from the active inventory may be completed; verify them in the same project.
  for (const task of active) {
    let parentId = task.parentId;
    const seen = new Set([task.id]);
    while (parentId !== null) {
      if (seen.has(parentId) || seen.size > 100) throw new TodoistError("hierarchy_unavailable", 409);
      seen.add(parentId);
      let parent = all.get(parentId);
      if (!parent) { parent = await api.task(parentId, projectId); all.set(parentId, parent); }
      parentId = parent.parentId;
    }
  }
  return [...all.values()];
};

const linksForTask = (state: TodoistState, taskId: string) => accountLinks(state).filter((link) => link.taskId === taskId);

const displayScope = async (scope: TodoScope, api: TodoistProvider, projects: readonly TodoProject[]) => {
  if (scope.kind === "all") return { scope, query: null };
  const entries = scope.kind === "project" ? projects : await api.filters();
  const entry = entries.find((item) => item.id === scope.id);
  if (!entry) throw new TodoistError("scope_unavailable", 409);
  return { scope: { kind: scope.kind, id: entry.id, name: entry.name }, query: "query" in entry ? String(entry.query) : null };
};

export function createTodoistService(options: TodoistOptions) {
  const { store, origin } = options;
  const now = options.now ?? Date.now;
  const pending = new Map<string, { session: string; expiresAt: number }>();
  const scopedTask = async (api: TodoistProvider, id: string) => {
    const projects = await projectList(api);
    const task = await api.task(id);
    if (!projects.some((project) => project.id === task.projectId)) throw new TodoistError("project_unavailable", 403);
    return task;
  };


  const callback = new URL(CALLBACK_PATH, origin).href;

  const token = async (state: TodoistState, fields: Record<string, string>) => {
    if (!state.app) throw new TodoistError("app_not_configured", 409);
    const body = new URLSearchParams({ client_id: state.app.clientId, client_secret: state.app.clientSecret, ...fields });
    const doc = asJsonObject(await providerJson("https://api.todoist.com/oauth/access_token", {
      method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" },
    }, options.fetcher));
    const accessToken = asJsonString(doc?.access_token), expiresIn = asJsonNumber(doc?.expires_in);
    const refreshToken = asJsonString(doc?.refresh_token) ?? null;
    const scope = asJsonString(doc?.scope);
    if (!accessToken || accessToken.length > 4096 || (scope && !scope.split(/[ ,]+/).includes("data:read_write"))) throw new TodoistError("oauth_invalid_grant", 502);
    return { accessToken, refreshToken, expiresAt: now() + (expiresIn ?? 3600) * 1000 };
  };

  const client = async (state: TodoistState, save: () => Promise<void>) => {
    if (!state.grant) throw new TodoistError("not_connected", 409);
    if (state.grant.expiresAt <= now() + 60_000) {
      if (!state.grant.refreshToken) throw new TodoistError("reconnect_required", 401);
      const refreshed = await token(state, { grant_type: "refresh_token", refresh_token: state.grant.refreshToken });
      state.grant = { ...refreshed, refreshToken: refreshed.refreshToken ?? state.grant.refreshToken, accountId: state.grant.accountId };
      await save();
    }
    return new TodoistProvider(state.grant.accessToken, options.fetcher);
  };

  const status = (state: TodoistState) => ({ configured: state.app !== null, connected: state.grant !== null, accountId: state.grant?.accountId ?? null, clientId: state.app?.clientId ?? null, generation: state.generation, scope: state.scope, callback, links: accountLinks(state) });

  const updateFooter = async (state: TodoistState, api: TodoistProvider, task: TodoTask, links: readonly TodoLink[]) => {
    const latest = await api.task(task.id, task.projectId);
    if (latest.updatedAt !== task.updatedAt || latest.description !== task.description) throw new TodoistError("task_changed", 409);
    const description = withTaskLinks(latest.description, links.map((link) => ({ id: link.id, url: new URL(`/fleet/bindings/${link.id}`, origin).href })));
    if (description !== latest.description) await api.request(`tasks/${encodeURIComponent(task.id)}`, {}, { description }, randomUUID());
    for (const link of links) {
      const index = state.links.findIndex((entry) => entry.id === link.id);
      if (index !== -1) state.links[index] = { ...link, state: "linked" };
    }
  };

  return {
    callbackPath: CALLBACK_PATH,
    status: () => store.run(async (state) => status(state)),
    configure: (clientId: string, clientSecret: string) => store.run(async (state, save) => {
      if (!clientId.trim() || !clientSecret.trim() || clientId.length > 4096 || clientSecret.length > 4096) throw new TodoistError("invalid_configuration", 400);
      state.app = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
      state.grant = null; state.project = null; state.scope = { kind: "all" }; state.generation++; pending.clear();
      await save(); return status(state);
    }),
    begin: (session: string) => store.run(async (state) => {
      if (!state.app) throw new TodoistError("app_not_configured", 409);
      for (const [id, entry] of pending) if (entry.expiresAt <= now()) pending.delete(id);
      if (pending.size >= 128) throw new TodoistError("oauth_busy", 429);
      const nonce = randomBytes(32).toString("base64url");
      pending.set(nonce, { session, expiresAt: now() + 10 * 60_000 });
      const url = new URL("https://app.todoist.com/oauth/authorize");
      url.search = new URLSearchParams({ client_id: state.app.clientId, scope: "data:read_write", state: nonce, response_type: "code", redirect_uri: callback }).toString();
      return { url: url.href };
    }),
    exchange: (session: string, nonce: string, code: string) => store.run(async (state, save) => {
      const entry = pending.get(nonce);
      if (!entry || entry.session !== session || entry.expiresAt <= now() || !code || code.length > 4096) throw new TodoistError("oauth_state_invalid", 403);
      pending.delete(nonce);
      const grant = await token(state, { code, redirect_uri: callback });
      const api = new TodoistProvider(grant.accessToken, options.fetcher);
      const user = asJsonObject(await api.request("user"));
      const accountId = todoId(user?.id) ?? (asJsonNumber(user?.id) === undefined ? null : String(asJsonNumber(user?.id)));
      if (!accountId) throw new TodoistError("oauth_invalid_grant", 502);
      if (state.grant?.accountId !== accountId) { state.project = null; state.scope = { kind: "all" }; }
      state.grant = { ...grant, accountId }; state.generation++;
      await save(); return status(state);
    }),
    disconnect: () => store.run(async (state, save) => {
      state.grant = null; state.project = null; state.scope = { kind: "all" }; state.generation++; pending.clear();
      await save(); return status(state);
    }),
    projects: () => store.run(async (state, save) => projectList(await client(state, save))),
    choices: () => store.run(async (state, save) => {
      const api = await client(state, save);
      return { projects: await projectList(api), filters: await api.filters() };
    }),
    selectScope: (generation: number, scope: TodoScope) => store.run(async (state, save) => {
      connected(state, generation);
      if (scope.kind !== "all") {
        const api = await client(state, save), resolved = await displayScope(scope, api, await projectList(api));
        if (resolved.query) await api.filteredTasks(resolved.query);
        state.scope = resolved.scope;
      } else state.scope = { kind: "all" };
      state.generation++; await save(); return status(state);
    }),
    tasks: (generation: number) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save), projects = await projectList(api);
      const projectIds = new Set(projects.map((project) => project.id));
      const display = await displayScope(state.scope, api, projects);
      const tasks = display.query ? await api.filteredTasks(display.query)
        : await api.tasks(state.scope.kind === "project" ? state.scope.id : undefined);
      if (tasks.some((task) => !projectIds.has(task.projectId))) throw new TodoistError("project_unavailable", 403);
      const known = new Map(tasks.map((task) => [task.id, task]));
      for (const task of tasks) {
        let parentId = task.parentId;
        const seen = new Set([task.id]);
        while (parentId !== null) {
          if (seen.has(parentId) || seen.size > 100) throw new TodoistError("hierarchy_unavailable", 409);
          seen.add(parentId);
          const parent = known.get(parentId) ?? await api.task(parentId, task.projectId);
          if (parent.projectId !== task.projectId) throw new TodoistError("project_mismatch", 403);
          known.set(parent.id, parent); parentId = parent.parentId;
        }
      }
      const sections = (await api.pages("sections", {})).map((value) => {
        const object = asJsonObject(value), id = todoId(object?.id), name = asJsonString(object?.name), projectId = todoId(object?.project_id);
        if (!id || name === undefined || !projectId || !projectIds.has(projectId)) throw new TodoistError("project_mismatch", 403);
        return { id, name, projectId, order: asJsonNumber(object?.section_order) ?? 0 };
      });
      const boundTasks: TodoTask[] = [];
      for (const id of new Set(accountLinks(state).map((link) => link.taskId))) {
        const task = known.get(id) ?? await api.task(id).catch(() => null);
        if (task && projectIds.has(task.projectId)) boundTasks.push(task);
      }
      return { ...status(state), scope: display.scope, projects, tasks, contextTasks: [...known.values()].filter((entry) => !tasks.some((match) => match.id === entry.id)), sections, boundTasks };
    }),
    history: (generation: number, before: number) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save), projects = await projectList(api);
      if (!Number.isFinite(before) || before > now() + 60_000 || before < 0) throw new TodoistError("invalid_history_range", 400);
      const since = Math.max(0, before - 30 * 24 * 60 * 60_000);
      const display = await displayScope(state.scope, api, projects);
      const params: Record<string, string> = {};
      if (state.scope.kind === "project") params.project_id = state.scope.id;
      if (display.query) params.filter_query = display.query;
      const rows = await api.pages("tasks/completed/by_completion_date", { ...params, since: new Date(since).toISOString(), until: new Date(before).toISOString() }, "items");
      const tasks = api.taskRows(rows);
      if (tasks.some((task) => !projects.some((project) => project.id === task.projectId))) throw new TodoistError("project_unavailable", 403);
      return { generation, since, until: before, tasks };
    }),
    create: (generation: number, title: string, description: string, parentId: string | null, projectId: string) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save);
      if (!title.trim() || title.length > 500 || description.length > 16_000) throw new TodoistError("invalid_task", 400);
      if (!(await projectList(api)).some((project) => project.id === projectId)) throw new TodoistError("project_unavailable", 403);
      if (parentId) {
        const parent = await api.task(parentId, projectId);
        const blockers = [...await api.ancestors(parent), parent].filter((entry) => entry.completed);
        if (blockers.length) throw new TodoistError("parent_completed", 409, blockers);
      }
      const body = { project_id: projectId, content: title, description, parent_id: parentId };
      const created = parseTask(await api.request("tasks", {}, body, randomUUID()));
      if (!created || created.projectId !== projectId) throw new TodoistError("project_mismatch", 403);
      return created;
    }),
    edit: (generation: number, taskId: string, title: string, description: string, expected: string, original?: { title: string; description: string }) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save);
      const task = await scopedTask(api, taskId);
      if (task.updatedAt !== expected || (!task.updatedAt && !original) || (original && (task.title !== original.title || task.description !== original.description))) throw new TodoistError("task_changed", 409);
      if (!title.trim() || title.length > 500 || description.length > 16_000) throw new TodoistError("invalid_task", 400);
      // Preserve the managed suffix already on the provider; editing the user body cannot remove links.
      const { footer } = taskDescriptionParts(task.description);
      const suffix = footer === null ? "" : "\n\n" + footer;
      await api.request(`tasks/${encodeURIComponent(taskId)}`, {}, { content: title, description: description + suffix }, randomUUID());
      return { ok: true };
    }),
    complete: (generation: number, taskId: string, reopen: boolean) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save);
      const task = await scopedTask(api, taskId);
      if (reopen && !task.completed && task.recurring) throw new TodoistError("recurring_occurrence", 409);
      if (reopen === !task.completed) return { ok: true };
      if (reopen) {
        const blockers = (await api.ancestors(task)).filter((entry) => entry.completed);
        if (blockers.length) throw new TodoistError("ancestors_completed", 409, blockers);
      } else {
        const tasks = await hierarchy(api, task.projectId);
        const blockers = completionBlockers(task, [...tasks.filter((entry) => entry.id !== taskId), task]);
        if (blockers === null) throw new TodoistError("hierarchy_unavailable", 409);
        if (blockers.length) throw new TodoistError("descendants_incomplete", 409, blockers);
      }
      await api.request(`tasks/${encodeURIComponent(taskId)}/${reopen ? "reopen" : "close"}`, {}, {}, randomUUID());
      return { ok: true };
    }),
    message: (generation: number, taskId: string) => store.run(async (state, save) => {
      connected(state, generation);
      const api = await client(state, save);
      const task = await scopedTask(api, taskId);
      return { text: taskMessage(task, await api.ancestors(task)) };
    }),
    bind: (generation: number, taskId: string, terminal: TerminalRef, remove = false) => store.run(async (state, save) => {
      const { accountId } = connected(state, generation), api = await client(state, save);
      const task = await scopedTask(api, taskId);
      const projectId = task.projectId;
      let link = linksForTask(state, taskId).find((entry) => sameTerminal(entry.terminal, terminal));
      if (remove) {
        if (!link) return { ok: true };
        await updateFooter(state, api, task, linksForTask(state, taskId).filter((entry) => entry.id !== link?.id));
        state.links = [...detachRelation(state.links, link)];
      } else {
        if (!link) {
          if (state.links.length >= 20_000) throw new TodoistError("binding_limit", 422);
          link = { id: randomUUID(), terminal, kind: "todoist", resource: JSON.stringify([accountId, projectId, taskId]), accountId, projectId, taskId, state: "pending" };
          state.links = [...attachRelation(state.links, link)];
          await save(); // Preserve retryable relation intent before the external write.
        }
        await updateFooter(state, api, task, linksForTask(state, taskId));
      }
      await save(); return { ok: true };
    }),
    binding: (id: string) => store.run(async (state) => state.links.find((link) => link.id === id)?.terminal ?? null),
  };
}

export type TodoistService = ReturnType<typeof createTodoistService>;
