import { asJsonObject, asJsonString, parseJson, type JsonValue } from "@/lib/json";
import { terminalKey, type TerminalRef } from "../../../fleet/bindings/identity.ts";
import type { TodoProject, TodoSection, TodoTask, TodoScope } from "../../../fleet/todoist/model.ts";
import type { TodoLink } from "../../../fleet/todoist/store.ts";

export interface TodoistStatus {
  configured: boolean;
  connected: boolean;
  accountId: string | null;
  clientId: string | null;
  generation: number;
  scope: TodoScope;
  callback: string;
  links: TodoLink[];
}
export interface TodoistSnapshot extends TodoistStatus { projects: TodoProject[]; contextTasks: TodoTask[]; tasks: TodoTask[]; sections: TodoSection[]; boundTasks: TodoTask[] }
export interface TodoistHistory { generation: number; since: number; until: number; tasks: TodoTask[] }

export class TodoistClientError extends Error {
  readonly code: string;
  readonly blockers: readonly { id: string; title: string }[];
  constructor(code: string, blockers: readonly { id: string; title: string }[] = []) { super(code); this.code = code; this.blockers = blockers; }
}

export async function todoistRequest<T>(action: string, body?: Record<string, JsonValue>): Promise<T> {
  const response = await fetch(`/fleet/api/todoist/${action}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
  const value = parseJson(await response.text());
  if (!response.ok) {
    const object = asJsonObject(value), code = asJsonString(object?.error) ?? "integration_unavailable";
    const blockers = Array.isArray(object?.blockers) ? object.blockers.flatMap((entry) => {
      const row = asJsonObject(entry), id = asJsonString(row?.id), title = asJsonString(row?.title);
      return id && title ? [{ id, title }] : [];
    }) : [];
    throw new TodoistClientError(code, blockers);
  }
  if (value === undefined) throw new TodoistClientError("integration_unavailable");
  // SAFETY: this is Fleet's same-origin typed service response, not provider JSON. Service boundary
  // parsing and integration tests pin each DTO; no caller-supplied endpoint or path is accepted.
  return value as T;
}

const RECEIPTS = "fleet:todoist:sent:v1";
const memory = new Set<string>();
export function deliveryReceipt(account: string, taskId: string, terminal: TerminalRef): string {
  return JSON.stringify([account, taskId, terminalKey(terminal)]);
}
export function hasDeliveryReceipt(key: string): boolean {
  if (memory.has(key)) return true;
  try {
    const value = parseJson(localStorage.getItem(RECEIPTS) ?? "[]");
    if (Array.isArray(value)) for (const entry of value) if (asJsonString(entry)) memory.add(String(entry));
  } catch { /* Private storage: the in-memory receipt still protects this page. */ }
  return memory.has(key);
}
export function saveDeliveryReceipt(key: string, pending: boolean): void {
  hasDeliveryReceipt(key);
  if (pending) memory.add(key); else memory.delete(key);
  try { localStorage.setItem(RECEIPTS, JSON.stringify([...memory].slice(-1000))); }
  catch { /* Never repeat a send just because browser persistence is unavailable. */ }
}
