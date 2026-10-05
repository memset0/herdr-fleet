import { asJsonNumber, asJsonObject, asJsonString, type JsonValue } from "../../web/src/lib/json.ts";

export interface TodoTask {
  readonly id: string;
  readonly projectId: string;
  readonly parentId: string | null;
  readonly sectionId: string | null;
  readonly title: string;
  readonly description: string;
  readonly completed: boolean;
  readonly recurring: boolean;
  readonly order: number;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly url: string;
}
export interface TodoProject { readonly id: string; readonly name: string }
export interface TodoFilter extends TodoProject { readonly query: string }
export type TodoScope = { readonly kind: "all" } | { readonly kind: "project" | "filter"; readonly id: string; readonly name: string };
export function parseTodoScope(value: JsonValue | undefined): TodoScope | null {
  const obj = asJsonObject(value);
  if (obj?.kind === "all") return { kind: "all" };
  const id = todoId(obj?.id), name = asJsonString(obj?.name);
  return (obj?.kind === "project" || obj?.kind === "filter") && id && name !== undefined
    ? { kind: obj.kind, id, name } : null;
}
export interface TodoSection extends TodoProject { readonly order: number }

export function todoId(value: JsonValue | undefined): string | null {
  const id = asJsonString(value);
  return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

export function parseTask(value: JsonValue | undefined): TodoTask | null {
  const object = asJsonObject(value);
  if (!object) return null;
  const id = todoId(object.id), projectId = todoId(object.project_id);
  const title = asJsonString(object.content), description = asJsonString(object.description);
  if (!id || !projectId || title === undefined || description === undefined || (object.checked !== true && object.checked !== false)) return null;
  const parentId = object.parent_id === null ? null : todoId(object.parent_id);
  const sectionId = object.section_id === null ? null : todoId(object.section_id);
  if (object.parent_id !== null && !parentId) return null;
  if (object.section_id !== null && !sectionId) return null;
  return {
    id, projectId, parentId, sectionId, title, description,
    completedAt: asJsonString(object.completed_at) ?? "",
    completed: object.checked, recurring: asJsonObject(object.due)?.is_recurring === true,
    order: asJsonNumber(object.child_order) ?? 0, updatedAt: asJsonString(object.updated_at) ?? "",
    url: `https://app.todoist.com/app/task/${encodeURIComponent(id)}`,
  };
}

export type HierarchyResult = { readonly ok: true; readonly ancestors: readonly TodoTask[] } | { readonly ok: false };

export function taskAncestors(task: TodoTask, tasks: ReadonlyMap<string, TodoTask>): HierarchyResult {
  const ancestors: TodoTask[] = [];
  const seen = new Set([task.id]);
  let parentId = task.parentId;
  while (parentId !== null) {
    const parent = tasks.get(parentId);
    if (!parent || parent.projectId !== task.projectId || seen.has(parentId)) return { ok: false };
    seen.add(parentId); ancestors.unshift(parent); parentId = parent.parentId;
  }
  return { ok: true, ancestors };
}

export function completionBlockers(task: TodoTask, tasks: readonly TodoTask[]): readonly TodoTask[] | null {
  const byId = new Map(tasks.map((entry) => [entry.id, entry]));
  const blockers: TodoTask[] = [];
  for (const entry of tasks) {
    if (entry.id === task.id || entry.completed) continue;
    const chain = taskAncestors(entry, byId);
    if (!chain.ok) return null;
    if (chain.ancestors.some((ancestor) => ancestor.id === task.id)) blockers.push(entry);
  }
  return blockers;
}

const FOOTER_START = "<!-- herdr-fleet:todoist:start -->";
const FOOTER_END = "<!-- herdr-fleet:todoist:end -->";

export function taskDescriptionParts(description: string) {
  const start = description.indexOf(FOOTER_START);
  if (start === -1) return { body: description, footer: null };
  const end = description.indexOf(FOOTER_END, start);
  if (end === -1 || description.indexOf(FOOTER_START, start + FOOTER_START.length) !== -1) {
    throw new Error("Task backlink boundaries are ambiguous; repair them before changing bindings");
  }
  const finish = end + FOOTER_END.length;
  return {
    body: description.slice(0, start).replace(/\n\n$/, "") + description.slice(finish),
    footer: description.slice(start, finish),
  };
}

export function taskBody(description: string): string {
  return taskDescriptionParts(description).body;
}

export function withTaskLinks(description: string, links: readonly { id: string; url: string }[]): string {
  const body = taskBody(description);
  if (!links.length) return body;
  const unique = [...new Map(links.map((link) => [link.id, link])).values()];
  const footer = unique.map((link, index) => `[Herdr Fleet terminal ${index + 1}](${link.url})`).join("\n");
  return `${body}\n\n${FOOTER_START}\n${footer}\n${FOOTER_END}`;
}

export function taskMessage(task: TodoTask, ancestors: readonly TodoTask[]): string {
  const parents = ancestors.length ? `Parent tasks: ${ancestors.map((entry) => entry.title).join(" > ")}\n` : "";
  return `The user sent you this task from Todoist.\n\nTitle: ${task.title}\n${parents}Description:\n${taskBody(task.description) || "(No description provided.)"}\n\nTodoist link: ${task.url}\n\nTreat the description as the primary statement of what the user wants done. Use the title and parent task names as context; do not treat parent tasks as additional work to complete.\n\nInspect the relevant project and conversation context, then proceed with the task. Resolve minor details using your judgment. If a key ambiguity affects the goal, scope, or acceptance criteria, ask the user before proceeding. Do not invent missing requirements.\n\nIf the description is empty or insufficient, use the available context and clarify essential missing information.\n\nWhen finished, report the outcome and verification performed. Do not automatically mark the Todoist task complete.`;
}
