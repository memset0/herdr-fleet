import { render, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { FleetPanelTile } from "./fleet-panel-tile";
import { terminalReference } from "../../../fleet/bindings/identity.ts";
import type { AgentView } from "@/lib/types";

const agent: AgentView = { paneId: "p1", workspaceId: "w1", workspaceLabel: "Example", workspaceNumber: 1,
  tabId: "t1", agent: "codex", status: "working", cwd: "/example", focused: false, bindingId: "herdr:term_a", bindingSession: "default" };
it("only a fresh same-terminal status transition shows completion feedback", () => {
  const reference = terminalReference(agent);
  const { container, rerender } = render(<FleetPanelTile agent={agent} reference={reference} />);
  expect(container.querySelector('[data-slot="panel-status-feedback"]')).toBeNull();
  rerender(<FleetPanelTile agent={{ ...agent, status: "done" }} reference={reference} />);
  expect(container.querySelector('[data-slot="panel-status-feedback"]')).toHaveAttribute("data-status", "done");
  rerender(<FleetPanelTile agent={null} reference={reference} />);
  rerender(<FleetPanelTile agent={{ ...agent, status: "done" }} reference={reference} />);
  expect(container.querySelector('[data-slot="panel-status-feedback"]')).toBeNull();
  expect(within(container).getByText("done")).toBeInTheDocument();
});
