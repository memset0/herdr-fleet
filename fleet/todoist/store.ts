import { readFile } from "node:fs/promises";
import { asJsonNumber, asJsonObject, asJsonString, parseJson, type JsonValue } from "../../web/src/lib/json.ts";
import { parseTerminalReference, type TerminalRelation } from "../bindings/identity.ts";
import { diskSettingsIo } from "../settings/store.ts";
import { parseTodoScope, todoId, type TodoScope } from "./model.ts";

export interface TodoLink extends TerminalRelation {
  readonly id: string;
  readonly accountId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly kind: "todoist";
  readonly state: "pending" | "linked";
}
export interface TodoistState {
  schemaVersion: 1;
  app: { clientId: string; clientSecret: string } | null;
  grant: { accessToken: string; refreshToken: string | null; expiresAt: number; accountId: string } | null;
  project: { id: string; name: string } | null;
  generation: number;
  scope: TodoScope;
  links: TodoLink[];
}

export function emptyTodoistState(): TodoistState {
  return { schemaVersion: 1, app: null, grant: null, project: null, generation: 0, scope: { kind: "all" }, links: [] };
}

function secret(value: JsonValue | undefined): string | null {
  const text = asJsonString(value);
  return text && text.length <= 4096 ? text : null;
}

export function parseTodoistState(value: JsonValue | undefined): TodoistState | null {
  const obj = asJsonObject(value);
  if (obj?.schemaVersion !== 1 || !Array.isArray(obj.links) || obj.links.length > 20_000) return null;
  const generation = asJsonNumber(obj.generation);
  if (generation === undefined || !Number.isSafeInteger(generation) || generation < 0) return null;
  const state = emptyTodoistState(); state.generation = generation;
  const scope = obj.scope === undefined ? { kind: "all" as const } : parseTodoScope(obj.scope);
  if (!scope) return null;
  state.scope = scope;
  if (obj.app !== null) {
    const app = asJsonObject(obj.app), clientId = secret(app?.clientId), clientSecret = secret(app?.clientSecret);
    if (!clientId || !clientSecret) return null;
    state.app = { clientId, clientSecret };
  }
  if (obj.grant !== null) {
    const grant = asJsonObject(obj.grant), accessToken = secret(grant?.accessToken), accountId = todoId(grant?.accountId);
    const refreshToken = grant?.refreshToken === null ? null : secret(grant?.refreshToken);
    const expiresAt = asJsonNumber(grant?.expiresAt);
    if (!accessToken || !accountId || expiresAt === undefined || !Number.isFinite(expiresAt) || (grant?.refreshToken !== null && !refreshToken)) return null;
    state.grant = { accessToken, accountId, refreshToken, expiresAt };
  }
  if (obj.project !== null) {
    const project = asJsonObject(obj.project), id = todoId(project?.id), name = asJsonString(project?.name);
    if (!id || name === undefined) return null;
    state.project = { id, name };
  }
  const ids = new Set<string>();
  for (const item of obj.links) {
    const link = asJsonObject(item), terminal = parseTerminalReference(link?.terminal), id = todoId(link?.id);
    const accountId = todoId(link?.accountId), projectId = todoId(link?.projectId), taskId = todoId(link?.taskId);
    const resource = asJsonString(link?.resource);
    if (!terminal || !id || ids.has(id) || !accountId || !projectId || !taskId || link?.kind !== "todoist" || (link.state !== "pending" && link.state !== "linked")) return null;
    if (resource !== JSON.stringify([accountId, projectId, taskId])) return null;
    ids.add(id);
    state.links.push({ id, terminal, kind: "todoist", accountId, projectId, taskId, resource, state: link.state });
  }
  return state;
}

export interface TodoistIo {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
}
const disk: TodoistIo = {
  async read(path) {
    try { return await readFile(path, "utf8"); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  },
  write: diskSettingsIo.write,
};

export function createTodoistStore(path: string, io: TodoistIo = disk) {
  let pending: Promise<void> = Promise.resolve();
  const read = async () => {
    const text = await io.read(path);
    if (text === null) return emptyTodoistState();
    if (text.length > 8 * 1024 * 1024) throw new Error("Todoist state too large");
    const state = parseTodoistState(parseJson(text));
    if (!state) throw new Error("Invalid Todoist state");
    return state;
  };
  const save = async (state: TodoistState) => {
    const text = JSON.stringify(state) + "\n";
    if (!parseTodoistState(parseJson(text)) || text.length > 8 * 1024 * 1024) throw new Error("Invalid Todoist state");
    await io.write(path, text);
  };
  return {
    read,
    run<T>(operation: (state: TodoistState, save: () => Promise<void>) => Promise<T>): Promise<T> {
      const result = pending.then(async () => { const state = await read(); return operation(state, () => save(state)); });
      pending = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
export type TodoistStore = ReturnType<typeof createTodoistStore>;
