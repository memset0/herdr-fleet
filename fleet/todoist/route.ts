import { asJsonNumber, asJsonObject, asJsonString, parseJson } from "../../web/src/lib/json.ts";
import { parseTerminalReference, resolveTerminalReference } from "../bindings/identity.ts";
import type { LocatedTerminal } from "../bindings/inventory.ts";
import { parseTodoScope, todoId } from "./model.ts";
import { TodoistError } from "./provider.ts";
import { TODOIST_API, type TodoistService } from "./service.ts";

async function boundedText(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 128 * 1024) { await reader.cancel(); throw new TodoistError("request_too_large", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

export function todoistFailure(error: TodoistError): Response {
  if (error instanceof TodoistError) return Response.json({ error: error.code, blockers: error.blockers.map((task) => ({ id: task.id, title: task.title })) }, { status: error.status });
  return Response.json({ error: "integration_unavailable" }, { status: 503 });
}

/** Invoked only below Fleet's authenticated-session and same-origin mutation gates. */
export async function todoistResponse(
  request: Request, service: TodoistService, sessionId: string,
  inventory: () => Promise<readonly LocatedTerminal[]>,
): Promise<Response> {
  try {
    const url = new URL(request.url), action = url.pathname.slice(TODOIST_API.length + 1);
    if (request.method === "GET") {
      if (action === "status") return Response.json(await service.status());
      if (action === "projects") return Response.json(await service.projects());
      if (action === "choices") return Response.json(await service.choices());
      const generation = Number(url.searchParams.get("generation"));
      if (!url.searchParams.has("generation") || !Number.isSafeInteger(generation)) throw new TodoistError("invalid_request", 400);
      if (action === "tasks") return Response.json(await service.tasks(generation));
      if (action === "history") return Response.json(await service.history(generation, Number(url.searchParams.get("before"))));
      throw new TodoistError("not_found", 404);
    }
    if (request.method !== "POST") throw new TodoistError("method", 405);
    const text = await boundedText(request);
    const body = asJsonObject(parseJson(text));
    if (!body) throw new TodoistError("invalid_request", 400);
    if (action === "callback") {
      await service.exchange(sessionId, asJsonString(body.state) ?? "", asJsonString(body.code) ?? "");
      return Response.json({ ok: true });
    }
    if (action === "configure") return Response.json(await service.configure(asJsonString(body.clientId) ?? "", asJsonString(body.clientSecret) ?? ""));
    if (action === "connect") return Response.json(await service.begin(sessionId));
    if (action === "disconnect") return Response.json(await service.disconnect());
    const generation = asJsonNumber(body.generation);
    if (generation === undefined || !Number.isSafeInteger(generation)) throw new TodoistError("invalid_request", 400);
    if (action === "scope") {
      const scope = parseTodoScope(body.scope);
      if (!scope) throw new TodoistError("invalid_request", 400);
      return Response.json(await service.selectScope(generation, scope));
    }
    const title = asJsonString(body.title) ?? "", description = asJsonString(body.description) ?? "";
    if (action === "create") {
      const parent = body.parentId === null ? null : todoId(body.parentId);
      if (body.parentId !== null && !parent) throw new TodoistError("invalid_request", 400);
      const projectId = todoId(body.projectId);
      if (!projectId) throw new TodoistError("invalid_request", 400);
      return Response.json(await service.create(generation, title, description, parent, projectId));
    }
    const taskId = todoId(body.taskId);
    if (!taskId) throw new TodoistError("invalid_request", 400);
    if (action === "edit") return Response.json(await service.edit(generation, taskId, title, description, asJsonString(body.expected) ?? "", { title: asJsonString(body.originalTitle) ?? "", description: asJsonString(body.originalDescription) ?? "" }));
    if (action === "complete" || action === "reopen") return Response.json(await service.complete(generation, taskId, action === "reopen"));
    if (action === "prepare") {
      const terminal = parseTerminalReference(body.terminal);
      if (!terminal) throw new TodoistError("terminal_unavailable", 409);
      const message = await service.message(generation, taskId);
      const resolved = resolveTerminalReference(terminal, (await inventory()).filter((pane) => pane.fresh), true);
      if (resolved.status !== "resolved") throw new TodoistError("terminal_unavailable", 409);
      return Response.json({ ...message, paneId: resolved.pane.paneId });
    }
    if (action === "message") return Response.json(await service.message(generation, taskId));
    if (action === "bind" || action === "unbind") {
      const terminal = parseTerminalReference(body.terminal);
      if (!terminal) throw new TodoistError("terminal_unavailable", 409);
      if (action === "bind") {
        const panes = (await inventory()).filter((pane) => pane.fresh);
        if (resolveTerminalReference(terminal, panes, true).status !== "resolved") throw new TodoistError("terminal_unavailable", 409);
      }
      return Response.json(await service.bind(generation, taskId, terminal, action === "unbind"));
    }
    throw new TodoistError("not_found", 404);
  } catch (error) { return todoistFailure(error instanceof TodoistError ? error : new TodoistError("integration_unavailable", 503)); }
}

export async function bindingRedirect(id: string, service: TodoistService, inventory: () => Promise<readonly LocatedTerminal[]>): Promise<Response> {
  try {
    const ref = await service.binding(id);
    if (!ref) throw new TodoistError("binding_unavailable", 404);
    const resolved = resolveTerminalReference(ref, (await inventory()).filter((pane) => pane.fresh), true);
    if (resolved.status !== "resolved") throw new TodoistError("terminal_unavailable", 409);
    const query = new URLSearchParams();
    if (ref.host) query.set("h", ref.host);
    if (ref.session) query.set("s", ref.session);
    return new Response(null, { status: 303, headers: { location: `/pane/${encodeURIComponent(resolved.pane.paneId)}?${query}` } });
  } catch (error) { return todoistFailure(error instanceof TodoistError ? error : new TodoistError("integration_unavailable", 503)); }
}
