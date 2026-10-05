import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { server } from "@/test/setup";
import { useFleetTaskComposer } from "@/lib/fleet-task-delivery";
import { FleetTodoistProvider } from "./fleet-todoist-provider";
import { FleetRightSidebar, FleetTodoistPane } from "./fleet-todoist";
import type { TodoTask } from "../../../fleet/todoist/model.ts";

const pane = { paneId: "w1:p1", host: "member-a", agent: "codex", bindingId: "herdr:term_one", bindingSession: "default" };
const status = { configured: true, connected: true, accountId: "account", project: { id: "project", name: "Example project" }, generation: 1, callback: "https://example.com/fleet/todoist/callback", links: [] };
const tasks: TodoTask[] = [
  { id: "root", title: "Root", parentId: null },
  { id: "parent", title: "Parent", parentId: "root" },
  { id: "child", title: "Child", parentId: "parent" },
].map((item) => Object.assign({}, item, { projectId: "project", sectionId: null, description: `Requirements: ${item.title}`, completed: false, recurring: false, updatedAt: "one", order: 1, url: `https://app.todoist.com/app/task/${item.id}` }));

beforeEach(() => {
  localStorage.removeItem("fleet:todoist:view");
  localStorage.removeItem("fleet:todoist:collapsed:project");
  server.use(
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(status)),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...status, tasks, sections: [], boundTasks: [] })),
  );
});

function renderPane(child = <FleetTodoistPane pane={pane} />) {
  return render(<MemoryRouter><FleetTodoistProvider>{child}</FleetTodoistProvider></MemoryRouter>);
}

it("switches Agents and Todoist without navigating, then preserves nested tree and list context", async () => {
  const user = userEvent.setup();
  const view = renderPane(<FleetRightSidebar agents={<div>Existing agents</div>} pane={pane} />);
  expect(view.getByText("Existing agents")).toBeInTheDocument();
  await user.click(view.getByRole("button", { name: "Todoist" }));
  await view.findByText("Example project");
  expect(view.getByRole("button", { name: "Child" })).toBeInTheDocument();
  await user.click(view.getAllByRole("button", { name: "Collapse subtasks" })[0]!);
  expect(view.queryByRole("button", { name: "Child" })).toBeNull();
  await user.click(view.getByRole("button", { name: "List" }));
  expect(view.getByText("Root / Parent")).toBeInTheDocument();
  await user.click(view.getByRole("button", { name: "Agents" }));
  expect(view.getByText("Existing agents")).toBeInTheDocument();
});

it("a hierarchy refusal opens a blocker dialog with no force or cascade control", async () => {
  const user = userEvent.setup();
  server.use(http.post(/\/fleet\/api\/todoist\/complete$/, () => HttpResponse.json({ error: "descendants_incomplete", blockers: [{ id: "child", title: "Child" }] }, { status: 409 })));
  const view = renderPane();
  await user.click(await view.findByRole("checkbox", { name: "Complete Root" }));
  const dialog = await view.findByRole("dialog", { name: "Complete all subtasks first." });
  expect(within(dialog).getByText("Child")).toBeInTheDocument();
  expect(within(dialog).getAllByRole("button")).toHaveLength(1);
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(view.queryByRole("dialog")).toBeNull();
});

it("a successful native send followed by a failed link retries only the link", async () => {
  const user = userEvent.setup(), submit = vi.fn(async () => true);
  let prepared = 0, bound = 0;
  server.use(
    http.post(/\/fleet\/api\/todoist\/prepare$/, () => { prepared++; return HttpResponse.json({ text: "Task description", paneId: pane.paneId }); }),
    http.post(/\/fleet\/api\/todoist\/bind$/, () => { bound++; return bound === 1 ? HttpResponse.json({ error: "provider_rejected" }, { status: 502 }) : HttpResponse.json({ ok: true }); }),
  );
  function ComposerPort() { useFleetTaskComposer({ pane, blocked: false, submit }); return null; }
  const view = renderPane(<><ComposerPort /><FleetTodoistPane pane={pane} /></>);
  await user.click(await view.findByRole("button", { name: "Child" }));
  await user.click(view.getByRole("button", { name: "Send to agent" }));
  await waitFor(() => expect(bound).toBe(1));
  const retry = await view.findByRole("button", { name: "Retry binding only" });
  await waitFor(() => expect(retry).toBeEnabled());
  await user.click(retry);
  await waitFor(() => expect(bound).toBe(2));
  expect(prepared).toBe(1); expect(submit).toHaveBeenCalledExactlyOnceWith("Task description");
});
