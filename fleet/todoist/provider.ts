import { asJsonObject, asJsonString, parseJson, type JsonValue } from "../../web/src/lib/json.ts";
import { parseTask, type TodoTask } from "./model.ts";

export class TodoistError extends Error {
  constructor(readonly code: string, readonly status = 422, readonly blockers: readonly TodoTask[] = []) {
    super(code);
  }
}

export type ProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function providerJson(
  url: string | URL, init: RequestInit, fetcher: ProviderFetch = fetch,
): Promise<JsonValue | undefined> {
  let response: Response;
  try { response = await fetcher(url, { ...init, redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }); }
  catch { throw new TodoistError("provider_unavailable", 503); }
  if (!response.ok) {
    const code = response.status === 401 ? "reconnect_required" : response.status === 429 ? "rate_limited" : response.status === 404 ? "task_unavailable" : "provider_rejected";
    throw new TodoistError(code, response.status === 429 ? 429 : 502);
  }
  const text = await response.text();
  if (!text) return null;
  if (text.length > 8 * 1024 * 1024) throw new TodoistError("provider_response_too_large", 502);
  const json = parseJson(text);
  if (json === undefined) throw new TodoistError("provider_invalid_response", 502);
  return json;
}

export class TodoistProvider {
  private readonly deadline = Date.now() + 45_000;
  constructor(private readonly accessToken: string, private readonly fetcher: ProviderFetch = fetch) {}

  request(path: string, params: Record<string, string> = {}, body?: Record<string, JsonValue>, requestId?: string) {
    if (Date.now() >= this.deadline) throw new TodoistError("provider_unavailable", 503);
    const url = new URL(`https://api.todoist.com/api/v1/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const headers = new Headers({ authorization: `Bearer ${this.accessToken}` });
    if (body !== undefined) headers.set("content-type", "application/json");
    if (requestId) headers.set("x-request-id", requestId);
    return providerJson(url, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, this.deadline - Date.now())) }, this.fetcher);
  }

  async pages(path: string, params: Record<string, string>, field = "results"): Promise<JsonValue[]> {
    const all: JsonValue[] = [], cursors = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 1000; page++) {
      const query = { ...params, limit: "200" };
      const doc = asJsonObject(await this.request(path, cursor ? { ...query, cursor } : query));
      const rows = doc?.[field];
      if (!Array.isArray(rows)) throw new TodoistError("provider_invalid_response", 502);
      all.push(...rows);
      if (all.length > 100_000) throw new TodoistError("project_too_large", 422);
      const nextCursor = doc?.next_cursor;
      if ((field === "results" && nextCursor === undefined) || (nextCursor !== undefined && nextCursor !== null && asJsonString(nextCursor) === undefined)) throw new TodoistError("provider_invalid_response", 502);
      cursor = asJsonString(nextCursor) ?? null;
      if (!cursor) return all;
      if (cursors.has(cursor)) throw new TodoistError("provider_invalid_response", 502);
      cursors.add(cursor);
    }
    throw new TodoistError("pagination_incomplete", 502);
  }

  async tasks(projectId?: string): Promise<TodoTask[]> {
    return this.taskRows(await this.pages("tasks", projectId ? { project_id: projectId } : {}), projectId);
  }

  taskRows(rows: readonly JsonValue[], projectId?: string): TodoTask[] {
    return rows.map((row) => {
      const task = parseTask(row);
      if (!task || (projectId !== undefined && task.projectId !== projectId)) throw new TodoistError("project_mismatch", 403);
      return task;
    });
  }

  async task(id: string, projectId?: string): Promise<TodoTask> {
    const task = parseTask(await this.request(`tasks/${encodeURIComponent(id)}`));
    if (!task || (projectId !== undefined && task.projectId !== projectId)) throw new TodoistError("project_mismatch", 403);
    return task;
  }

  async ancestors(task: TodoTask): Promise<TodoTask[]> {
    const result: TodoTask[] = [], seen = new Set([task.id]);
    let id = task.parentId;
    while (id !== null) {
      if (seen.has(id) || seen.size > 100) throw new TodoistError("hierarchy_unavailable", 409);
      seen.add(id);
      const parent = await this.task(id, task.projectId);
      result.unshift(parent); id = parent.parentId;
    }
    return result;
  }
}
