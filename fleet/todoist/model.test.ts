import { expect, test } from "bun:test";
import { completionBlockers, taskAncestors, taskBody, taskMessage, withTaskLinks, type TodoTask } from "./model.ts";

function task(id: string, parentId: string | null = null, completed = false): TodoTask {
  return { id, parentId, completed, projectId: "project", sectionId: null, title: id, description: `Do ${id}`, recurring: false, order: 1, updatedAt: "", url: `https://app.todoist.com/app/task/${id}` };
}

test("all descendants block completion and completed ancestors are ordered outermost first", () => {
  const root = task("root", null, true), parent = task("parent", "root", true), child = task("child", "parent");
  const all = [root, parent, child];
  expect(completionBlockers(root, all)).toEqual([child]);
  expect(taskAncestors(child, new Map(all.map((entry) => [entry.id, entry])))).toEqual({ ok: true, ancestors: [root, parent] });
  expect(completionBlockers(root, [root, child])).toBeNull();
  const cycle = { ...root, parentId: "parent" };
  expect(taskAncestors(cycle, new Map([["root", cycle], ["parent", parent]]))).toEqual({ ok: false });
});

test("managed links are idempotent and retain the task body exactly", () => {
  const body = "Requirements\n- Keep this detail.\n";
  const link = { id: "one", url: "https://example.com/fleet/binding/one" };
  const linked = withTaskLinks(body, [link, link]);
  expect(withTaskLinks(linked, [link])).toBe(linked);
  expect(taskBody(linked)).toBe(body);
  expect(withTaskLinks(linked, [])).toBe(body);
  expect(taskBody(linked + "\nUser note after managed footer")).toBe(body + "\nUser note after managed footer");
  const extended = withTaskLinks(linked + "\nUser note after managed footer", [link]);
  expect(taskBody(extended)).toBe(body + "\nUser note after managed footer");
  expect(extended).toEndWith("<!-- herdr-fleet:todoist:end -->");
  expect(() => taskBody(linked.replace("<!-- herdr-fleet:todoist:end -->", ""))).toThrow();
});

test("the English message uses only ancestor titles and excludes backlink metadata", () => {
  const parent = { ...task("parent"), description: "Parent instructions must not be sent" };
  const child = { ...task("child", "parent"), description: withTaskLinks("Implement this requirement", [{ id: "one", url: "https://example.com/fleet/binding/one" }]) };
  const message = taskMessage(child, [parent]);
  expect(message).toContain("Parent tasks: parent");
  expect(message).toContain("Description:\nImplement this requirement");
  expect(message).not.toContain(parent.description);
  expect(message).not.toContain("example.com");
  expect(message).toContain("Do not automatically mark");
});
