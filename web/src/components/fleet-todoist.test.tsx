import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { server } from "@/test/setup";
import { useFleetTaskComposer } from "@/lib/fleet-task-delivery";
import { FleetTodoistProvider } from "./fleet-todoist-provider";
import { FleetRightSidebar, FleetTodoistPane, FleetTodoistSettings } from "./fleet-todoist";
import type { TodoTask } from "../../../fleet/todoist/model.ts";

const pane = { paneId: "w1:p1", host: "member-a", agent: "codex", bindingId: "herdr:term_one", bindingSession: "default" };
const status = { scope: { kind: "all" }, configured: true, connected: true, accountId: "account", clientId: "example-client", projects: [{ id: "project", name: "Example project" }], generation: 1, callback: "https://example.com/fleet/todoist/callback", links: [] };
const tasks: TodoTask[] = [
  { id: "root", title: "Root", parentId: null },
  { id: "parent", title: "Parent", parentId: "root" },
  { id: "child", title: "Child", parentId: "parent" },
].map((item) => Object.assign({}, item, { projectId: "project", sectionId: null, description: `Requirements: ${item.title}`, completed: false, recurring: false, updatedAt: "one", order: 1, url: `https://app.todoist.com/app/task/${item.id}` }));

beforeEach(() => {
  localStorage.removeItem("fleet:todoist:view");
  localStorage.removeItem("fleet:todoist:collapsed:account");
  server.use(
    http.get(/\/fleet\/api\/todoist\/choices$/, () => HttpResponse.json({ projects: status.projects, filters: [{ id: "focus", name: "Focus", query: "search: child" }] })),
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(status)),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...status, tasks, treeTasks: tasks, contextTasks: [], sections: [], boundTasks: [] })),
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
  await view.findByRole("heading", { name: "Example project" });
  expect(view.getByRole("button", { name: /^Child/ })).toBeInTheDocument();
  await user.click(view.getAllByRole("button", { name: "Collapse subtasks" })[0]!);
  expect(view.queryByRole("button", { name: /^Child/ })).toBeNull();
  await user.click(view.getByRole("button", { name: "List" }));
  expect(view.getByText("Example project / Root / Parent")).toBeInTheDocument();
  await user.click(view.getByRole("button", { name: "Agents" }));
  expect(view.getByText("Existing agents")).toBeInTheDocument();
});

it("a hierarchy refusal opens a blocker dialog with no force or cascade control", async () => {
  const user = userEvent.setup();
  server.use(http.post(/\/fleet\/api\/todoist\/complete$/, () => HttpResponse.json({ error: "descendants_incomplete", blockers: [{ id: "child", title: "Child" }] }, { status: 409 })));
  const view = renderPane();
  await user.click(await view.findByRole("button", { name: "Root · Example project" }));
  await user.click(view.getByRole("button", { name: "Complete" }));
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
  await user.click(await view.findByRole("button", { name: /^Child/ }));
  await user.click(view.getByRole("button", { name: "Send to agent" }));
  const confirmation = await view.findByRole("dialog", { name: "Send this task to the agent?" });
  expect(within(confirmation).getByText("Child")).toBeInTheDocument();
  expect(confirmation).toHaveTextContent("codex · member-a · default · w1:p1");
  expect(prepared).toBe(0); expect(bound).toBe(0); expect(submit).not.toHaveBeenCalled();
  await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));
  expect(prepared).toBe(0); expect(bound).toBe(0);
  await user.click(view.getByRole("button", { name: "Send to agent" }));
  await user.click(view.getByRole("button", { name: "Confirm send" }));
  await waitFor(() => expect(bound).toBe(1));
  const retry = await view.findByRole("button", { name: "Retry binding only" });
  await waitFor(() => expect(retry).toBeEnabled());
  await user.click(retry);
  await waitFor(() => expect(bound).toBe(2));
  expect(prepared).toBe(1); expect(submit).toHaveBeenCalledExactlyOnceWith("Task description");
});

it("shows project groups and labels, and creates in the explicitly chosen project", async () => {
  const user = userEvent.setup();
  const projects = [...status.projects, { id: "second", name: "Second project" }, { id: "empty", name: "Empty project" }];
  let created: unknown;
  server.use(
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...status, projects, tasks: [...tasks, { ...tasks[0]!, id: "second-root", projectId: "second" }], treeTasks: [...tasks, { ...tasks[0]!, id: "second-root", projectId: "second" }], contextTasks: [], sections: [], boundTasks: [] })),
    http.post(/\/fleet\/api\/todoist\/create$/, async ({ request }) => { created = await request.json(); return HttpResponse.json({ ok: true }); }),
  );
  const view = renderPane();
  const second = await view.findByRole("region", { name: "Second project" });
  expect(within(second).getByRole("button", { name: "Root · Second project" })).toBeInTheDocument();
  expect(view.queryByRole("region", { name: "Empty project" })).toBeNull();
  await user.click(view.getByRole("button", { name: "Add task" }));
  const dialog = view.getByRole("dialog", { name: "Add task" });
  await user.selectOptions(within(dialog).getByRole("combobox", { name: "Project" }), "second");
  await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "New task");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(created).toMatchObject({ projectId: "second", parentId: null, title: "New task" }));
});

it("shows the configured client ID and secret status with a default-All display selector", async () => {
  const view = renderPane(<FleetTodoistSettings />);
  expect(await view.findByDisplayValue("example-client")).toHaveAttribute("readonly");
  expect(view.getByText("Client secret is configured and kept on the server.")).toBeInTheDocument();
  expect(view.getByRole("combobox", { name: "Display scope" })).toHaveValue("all");
});

it("Settings saves a Todoist filter as display scope", async () => {
  let selection: unknown;
  server.use(http.post(/\/fleet\/api\/todoist\/scope$/, async ({ request }) => { selection = await request.json(); return HttpResponse.json({ ok: true }); }));
  const user = userEvent.setup(), view = renderPane(<FleetTodoistSettings />);
  await view.findByRole("option", { name: "Focus" });
  await user.selectOptions(view.getByRole("combobox", { name: "Display scope" }), "filter:focus");
  await waitFor(() => expect(selection).toMatchObject({ generation: 1, scope: { kind: "filter", id: "focus", name: "Focus" } }));
});

it("completing a task invalidates an already-loaded empty history", async () => {
  let completed = false, historyReads = 0;
  server.use(
    http.get(/\/fleet\/api\/todoist\/history/, () => { historyReads++; return HttpResponse.json({ generation: 1, since: 0, until: Date.now(), tasks: completed ? [{ ...tasks[2]!, completed: true }] : [] }); }),
    http.post(/\/fleet\/api\/todoist\/complete$/, () => { completed = true; return HttpResponse.json({ ok: true }); }),
  );
  const user = userEvent.setup(), view = renderPane();
  await user.click(await view.findByRole("button", { name: "Completed" }));
  await waitFor(() => expect(historyReads).toBe(1));
  await waitFor(() => expect(view.getByRole("button", { name: "Tree" })).toBeEnabled());
  await user.click(view.getByRole("button", { name: "Tree" }));
  await user.click(view.getByRole("button", { name: "Child · Example project" }));
  await user.click(view.getByRole("button", { name: "Complete" }));
  await waitFor(() => expect(view.getByRole("button", { name: "Completed" })).toBeEnabled());
  await user.click(view.getByRole("button", { name: "Completed" }));
  await waitFor(() => expect(historyReads).toBe(2));
  expect(await view.findByRole("button", { name: /^Child/ })).toBeInTheDocument();
});

it("expands one highlighted task card in place and collapses it on a second click", async () => {
  const user = userEvent.setup(), view = renderPane();
  const childButton = await view.findByRole("button", { name: /^Child/ });
  await user.click(childButton);
  const card = childButton.closest<HTMLElement>('[data-slot="todoist-task-card"]')!;
  expect(card).toHaveAttribute("data-selected", "true");
  expect(card).toHaveClass("bg-primary/10", "border-primary/60");
  expect(within(card).getByRole("button", { name: "Edit task" })).toBeInTheDocument();
  await user.click(view.getByRole("button", { name: /^Parent ·/ }));
  await waitFor(() => expect(within(card).queryByRole("button", { name: "Edit task" })).toBeNull());
  expect(view.container.querySelectorAll('[data-slot="todoist-task-card"][data-selected="true"]')).toHaveLength(1);
  await user.click(view.getByRole("button", { name: /^Parent ·/ }));
  await waitFor(() => expect(view.queryByRole("button", { name: "Edit task" })).toBeNull());
});

it("sidebar display scope changes preserve the independently selected list view", async () => {
  let generation = 1, scoped = false;
  const current = () => ({ ...status, generation, scope: scoped ? { kind: "project", id: "project", name: "Example project" } : { kind: "all" } });
  server.use(
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(current())),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...current(), tasks, treeTasks: tasks, contextTasks: [], sections: [], boundTasks: [] })),
    http.post(/\/fleet\/api\/todoist\/scope$/, () => { scoped = true; generation++; return HttpResponse.json(current()); }),
  );
  const user = userEvent.setup(), view = renderPane();
  await user.click(await view.findByRole("button", { name: "List" }));
  await view.findByRole("option", { name: "Example project" });
  await user.selectOptions(view.getByRole("combobox", { name: "Display scope" }), "project:project");
  await waitFor(() => expect(view.getByRole("combobox", { name: "Display scope" })).toHaveValue("project:project"));
  expect(view.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
});

it("a parent-only filter keeps nested children in Tree but not in List", async () => {
  const filtered = { ...status, scope: { kind: "filter", id: "parents", name: "Parent tasks" } };
  server.use(
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(filtered)),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...filtered, tasks: [tasks[0]], treeTasks: tasks, contextTasks: [], sections: [], boundTasks: [] })),
  );
  const user = userEvent.setup(), view = renderPane();
  expect(await view.findByRole("button", { name: /^Child ·/ })).toBeInTheDocument();
  await user.click(view.getByRole("button", { name: "List" }));
  expect(view.queryByRole("button", { name: /^Child ·/ })).toBeNull();
  expect(view.getByRole("button", { name: /^Root ·/ })).toBeInTheDocument();
});

it("a directly selected empty project still shows its empty and create state", async () => {
  const selected = { ...status, scope: { kind: "project", id: "project", name: "Example project" } };
  server.use(
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(selected)),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...selected, tasks: [], treeTasks: [], contextTasks: [], sections: [], boundTasks: [] })),
  );
  const view = renderPane();
  expect(await view.findByRole("region", { name: "Example project" })).toHaveTextContent("No tasks in this view.");
  expect(view.getByRole("button", { name: "Add task" })).toBeEnabled();
});

it("Escape and a changed terminal invalidate send confirmation without requests", async () => {
  let attempts = 0;
  server.use(http.post(/\/fleet\/api\/todoist\/(prepare|bind)$/, () => { attempts++; return HttpResponse.json({ ok: true }); }));
  const user = userEvent.setup();
  function App({ moved = false }: { moved?: boolean }) {
    return <MemoryRouter><FleetTodoistProvider><FleetTodoistPane pane={moved ? { ...pane, paneId: "w2:p3", bindingId: "herdr:term_two" } : pane} /></FleetTodoistProvider></MemoryRouter>;
  }
  const view = render(<App />);
  await user.click(await view.findByRole("button", { name: /^Child/ }));
  await user.click(view.getByRole("button", { name: "Send to agent" }));
  const dialog = await view.findByRole("dialog", { name: "Send this task to the agent?" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());
  await user.keyboard("{Escape}");
  expect(view.queryByRole("dialog")).toBeNull();
  await user.click(view.getByRole("button", { name: "Send to agent" }));
  view.rerender(<App moved />);
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
  expect(attempts).toBe(0);
});

it("a collapsed task binds and unbinds a plain terminal without preparing or sending a message", async () => {
  const terminal = { version: 1, host: pane.host, session: "default", id: pane.bindingId };
  const link = { id: "link-direct", kind: "todoist", resource: '["account","project","child"]', accountId: "account", projectId: "project", taskId: "child", terminal, state: "linked" };
  let linked = false, prepare = 0;
  const requests: unknown[] = [];
  const current = () => ({ ...status, links: linked ? [link] : [] });
  server.use(
    http.get(/\/fleet\/api\/todoist\/status$/, () => HttpResponse.json(current())),
    http.get(/\/fleet\/api\/todoist\/tasks/, () => HttpResponse.json({ ...current(), tasks, treeTasks: tasks, contextTasks: [], sections: [], boundTasks: linked ? [tasks[2]] : [] })),
    http.post(/\/fleet\/api\/todoist\/bind$/, async ({ request }) => { requests.push(await request.json()); linked = true; return HttpResponse.json({ ok: true }); }),
    http.post(/\/fleet\/api\/todoist\/unbind$/, () => { linked = false; return HttpResponse.json({ ok: true }); }),
    http.post(/\/fleet\/api\/todoist\/prepare$/, () => { prepare++; return HttpResponse.json({ text: "Must not send" }); }),
  );
  const user = userEvent.setup(), view = renderPane(<FleetTodoistPane pane={{ ...pane, agent: "shell", kind: "shell" }} />);
  const title = await view.findByRole("button", { name: /^Child ·/ });
  const card = title.closest<HTMLElement>('[data-slot="todoist-task-card"]')!;
  await user.click(within(card).getByRole("button", { name: "Bind terminal: Child" }));
  const unbind = await within(card).findByRole("button", { name: "Unbind: Child" });
  await waitFor(() => expect(unbind).toBeEnabled());
  expect(unbind).toHaveAttribute("aria-pressed", "true");
  expect(requests).toEqual([{ taskId: "child", terminal, generation: 1 }]);
  expect(card).toHaveAttribute("data-selected", "false");
  expect(view.getByRole("region", { name: "Bound to this terminal" })).toHaveTextContent("Child");
  await user.click(unbind);
  await within(card).findByRole("button", { name: "Bind terminal: Child" });
  expect(view.queryByRole("region", { name: "Bound to this terminal" })).toBeNull();
  expect(prepare).toBe(0);
});

it("binding remains visible with guidance but disabled without a selected terminal", async () => {
  const view = renderPane(<FleetTodoistPane />);
  expect(await view.findByRole("button", { name: "Bind terminal: Child" })).toBeDisabled();
  expect(view.getByText("Open a terminal with stable identity to bind or send this task.")).toBeInTheDocument();
});

it("requires expanded details for completion and reopening without row checkboxes", async () => {
  const user = userEvent.setup();
  let completed = 0, reopened = 0;
  server.use(
    http.post(/\/fleet\/api\/todoist\/complete$/, () => { completed++; return HttpResponse.json({ ok: true }); }),
    http.post(/\/fleet\/api\/todoist\/reopen$/, () => { reopened++; return HttpResponse.json({ ok: true }); }),
    http.get(/\/fleet\/api\/todoist\/history/, () => HttpResponse.json({ generation: 1, since: 0, until: Date.now(), tasks: [{ ...tasks[2]!, completed: true }] })),
  );
  const view = renderPane();
  await view.findByRole("button", { name: "Child · Example project" });
  expect(view.queryByRole("checkbox")).toBeNull();
  expect(view.queryByRole("button", { name: "Complete" })).toBeNull();
  await user.click(view.getByRole("button", { name: "Child · Example project" }));
  expect(completed).toBe(0);
  await user.click(view.getByRole("button", { name: "Complete" }));
  await waitFor(() => expect(completed).toBe(1));
  await waitFor(() => expect(view.getByRole("button", { name: "Completed" })).toBeEnabled());
  await user.click(view.getByRole("button", { name: "Completed" }));
  await view.findByRole("button", { name: "Child · Example project" });
  expect(view.queryByRole("checkbox")).toBeNull();
  await user.click(view.getByRole("button", { name: "Child · Example project" }));
  expect(reopened).toBe(0);
  await user.click(view.getByRole("button", { name: "Reopen" }));
  await waitFor(() => expect(reopened).toBe(1));
});
