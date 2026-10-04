import { render, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { changeTags, emptyTags, parseTagCommand, type TagDocument } from "../../../fleet/pane-tags/document.ts";
import { asJsonObject, parseJson } from "@/lib/json";
import { createPaneTagClient, tagPanePlace } from "@/lib/fleet-pane-tags";
import type { AgentView } from "@/lib/types";
import { FleetPaneTagsProvider, ManagePaneTags } from "./fleet-pane-tags";
import { NativeAgentCard } from "./native-agent-card";

const agent: AgentView = { paneId: "pane-1", host: "lead", session: "work", workspaceId: "w1", workspaceLabel: "Project", workspaceNumber: 1, tabId: "t1", tabLabel: "Work", agent: "claude", status: "working", cwd: "/repo", focused: false };
function setup(document: TagDocument = emptyTags()) {
  let current = document, revision = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    if (init?.method === "POST") {
      const body = asJsonObject(parseJson(String(init.body)));
      if (body?.version !== String(revision)) return Response.json({ version: String(revision), document: current }, { status: 409 });
      const command = parseTagCommand(body?.command);
      if (!command) throw new Error("bad command");
      const result = changeTags(current, command, () => ({ id: `tag-${revision + 1}`, color: "#3b82f6" }));
      if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
      current = result.document; revision += 1;
    }
    return Response.json({ version: String(revision), document: current });
  };
  const client = createPaneTagClient(fetcher), onOpen = vi.fn(), onPin = vi.fn();
  const ui = render(<FleetPaneTagsProvider client={client}>
    <ManagePaneTags />
    <NativeAgentCard agent={agent} pinned={false} onPinToggle={onPin} onOpen={onOpen} />
    <NativeAgentCard agent={{ ...agent, paneId: "pane-2" }} pinned={false} onPinToggle={onPin} onOpen={onOpen} />
  </FleetPaneTagsProvider>);
  return { ...ui, client, onOpen, onPin, current: () => current, replace: (next: TagDocument) => { current = next; revision += 1; } };
}

it("creates and displays a separate named colored line without opening or pinning the pane", async () => {
  const { container, client, onOpen, onPin, current } = setup();
  const q = within(container), user = userEvent.setup();
  await waitFor(() => expect(client.getSnapshot().available).toBe(true));
  expect(container.querySelector('[data-slot="pane-tag-line"]')).toBeNull();
  await user.click(q.getAllByRole("button", { name: "Edit pane tags" })[0]!);
  const dialog = within(q.getByRole("dialog"));
  await user.type(dialog.getByRole("textbox", { name: "Find or create a tag" }), "Review");
  await user.click(dialog.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(current().tags).toHaveLength(1));
  expect(container.querySelector('[data-slot="pane-tag-line"]')?.textContent).toBe("Review");
  expect(onOpen).not.toHaveBeenCalled(); expect(onPin).not.toHaveBeenCalled();
  await user.click(dialog.getByRole("button", { name: "Close" }));
  expect(q.getAllByRole("button", { name: "Edit pane tags" })[0]).toHaveFocus();
});

it("globally edits the stable definition on every associated row", async () => {
  const document: TagDocument = { schemaVersion: 1, tags: [{ id: "t1", name: "Review", color: "#3b82f6" }], panes: [agent, { ...agent, paneId: "pane-2" }].map((entry) => Object.assign(tagPanePlace(entry), { tags: ["t1"] })) };
  const { container, client, current } = setup(document);
  const q = within(container), user = userEvent.setup();
  await waitFor(() => expect(client.getSnapshot().available).toBe(true));
  await user.click(q.getByRole("button", { name: "Manage tags" }));
  const dialog = within(q.getByRole("dialog"));
  await user.click(dialog.getByRole("button", { name: "Edit tag Review" }));
  const name = dialog.getByRole("textbox", { name: "Name" });
  await user.clear(name); await user.type(name, "Ready");
  fireEvent.change(dialog.getByLabelText("Color"), { target: { value: "#123456" } });
  await user.click(dialog.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(current().tags[0]).toEqual({ id: "t1", name: "Ready", color: "#123456" }));
  expect(Array.from(container.querySelectorAll('[data-slot="pane-tag-line"]')).map((line) => line.textContent)).toEqual(["Ready", "Ready"]);
  expect(current().panes.map((pane) => pane.tags)).toEqual([["t1"], ["t1"]]);
});

it("shows all assigned tags in order, and removing the last leaves no reserved line", async () => {
  const document: TagDocument = { schemaVersion: 1, tags: [{ id: "t1", name: "First", color: "#123456" }, { id: "t2", name: "Second", color: "#abcdef" }], panes: [{ ...tagPanePlace(agent), tags: ["t2", "t1"] }] };
  const { container, client } = setup(document);
  const q = within(container), user = userEvent.setup();
  await waitFor(() => expect(client.getSnapshot().available).toBe(true));
  const line = container.querySelector('[data-slot="pane-tag-line"]')!;
  expect(line.textContent).toBe("SecondFirst");
  expect(line.className).toContain("flex-wrap");
  expect(line.className).toContain("pr-12");
  for (const badge of line.querySelectorAll('[data-slot="pane-tag"]')) {
    expect(badge.className).toContain("text-[10px]");
    expect(badge.className).toContain("whitespace-normal");
  }
  const actions = container.querySelector('[data-slot="native-agent-actions"]')!;
  expect(actions.children[0]?.getAttribute("data-slot")).toBe("agent-pin");
  expect(actions.children[1]?.getAttribute("data-slot")).toBe("agent-tag-action");
  await user.click(q.getAllByRole("button", { name: "Edit pane tags" })[0]!);
  const dialog = within(q.getByRole("dialog"));
  await user.click(dialog.getByRole("checkbox", { name: "First" }));
  await user.click(dialog.getByRole("checkbox", { name: "Second" }));
  await waitFor(() => expect(container.querySelector('[data-slot="pane-tag-line"]')).toBeNull());
});

it("traps keyboard focus and keeps global editing reachable without rows", async () => {
  const fetcher: typeof fetch = async () => Response.json({ version: "", document: emptyTags() });
  const client = createPaneTagClient(fetcher);
  const { container } = render(<FleetPaneTagsProvider client={client}><ManagePaneTags settings /></FleetPaneTagsProvider>);
  const q = within(container), user = userEvent.setup();
  await user.click(q.getByRole("button", { name: "Manage tags" }));
  const dialog = within(q.getByRole("dialog"));
  const input = dialog.getByRole("textbox"); input.focus();
  await user.tab(); expect(dialog.getByRole("button", { name: "Close" })).toHaveFocus();
  await user.tab({ shift: true }); expect(input).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(q.queryByRole("dialog")).toBeNull();
});

it("an open global edit cannot overwrite a newer edit received by polling", async () => {
  const document: TagDocument = { schemaVersion: 1, tags: [{ id: "t1", name: "Review", color: "#3b82f6" }], panes: [] };
  const { container, client, replace, current } = setup(document);
  const q = within(container), user = userEvent.setup();
  await waitFor(() => expect(client.getSnapshot().available).toBe(true));
  await user.click(q.getByRole("button", { name: "Manage tags" }));
  const dialog = within(q.getByRole("dialog"));
  await user.type(dialog.getByRole("textbox", { name: "Find or create a tag" }), "Review");
  await user.click(dialog.getByRole("button", { name: "Edit tag Review" }));
  await user.clear(dialog.getByRole("textbox", { name: "Name" }));
  await user.type(dialog.getByRole("textbox", { name: "Name" }), "My draft");
  replace({ ...document, tags: [{ id: "t1", name: "Other editor", color: "#123456" }] });
  await client.refresh();
  await user.click(dialog.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(dialog.getByText("Tags changed elsewhere. Review the latest state and retry.")).toBeVisible());
  expect(current().tags[0]!.name).toBe("Other editor");
  expect(dialog.getByRole("button", { name: "Edit tag Other editor" })).toBeVisible();
});
