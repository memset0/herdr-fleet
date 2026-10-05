import type { TodoSection, TodoTask } from "./model.ts";

export interface TaskRow { readonly task: TodoTask; readonly depth: number; readonly children: boolean }

export function taskRows(tasks: readonly TodoTask[], sections: readonly TodoSection[], tree: boolean, collapsed: ReadonlySet<string>, completed = false): TaskRow[] {
  const sectionOrder = new Map(sections.map((section) => [section.id, section.order]));
  const timestamp = (task: TodoTask) => {
    const value = Date.parse((completed && task.completedAt) || task.updatedAt);
    return Number.isFinite(value) ? value : 0;
  };
  const ordered = tasks.toSorted((a, b) => timestamp(b) - timestamp(a) || (sectionOrder.get(a.sectionId ?? "") ?? -1) - (sectionOrder.get(b.sectionId ?? "") ?? -1) || a.order - b.order);
  const children = new Map<string, TodoTask[]>();
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of ordered) {
    if (!task.parentId) continue;
    const group = children.get(task.parentId) ?? [];
    group.push(task); children.set(task.parentId, group);
  }
  if (!tree) return ordered.map((task) => ({ task, depth: 0, children: children.has(task.id) }));
  const result: TaskRow[] = [], visited = new Set<string>();
  const visit = (task: TodoTask, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    result.push({ task, depth, children: children.has(task.id) });
    if (depth >= 100 || collapsed.has(task.id)) return;
    for (const child of children.get(task.id) ?? []) visit(child, depth + 1);
  };
  for (const task of ordered) if (!task.parentId || !ids.has(task.parentId)) visit(task, 0);
  return result;
}
