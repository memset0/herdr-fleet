import { act, fireEvent, render, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NativeAgentRail } from "./native-agent-rail";
import { FleetAgentPanel } from "./fleet-agent-panel";
import type { HomeData } from "@/lib/loaders";
import type { AgentView } from "@/lib/types";
import type { ViewClientState } from "@/lib/fleet-view-state";
import type { PanelInventory } from "@/lib/fleet-panel-inventory";
import { terminalKey, terminalReference } from "../../../fleet/bindings/identity.ts";
import type { ViewCommand } from "../../../fleet/view-state/document.ts";

const a: AgentView = { paneId: "p1", workspaceId: "w1", workspaceLabel: "Example", workspaceNumber: 1,
  paneLabel: "Agent A", tabId: "t1", agent: "codex", status: "working", cwd: "/example", focused: false,
  bindingId: "herdr:term_a", bindingSession: "default" };
const b = { ...a, paneId: "p2", paneLabel: "Agent B", bindingId: "herdr:term_b" };
const data: HomeData = { agents: [a, b], shellPanes: [], bridge: "connected", device: undefined, workspaces: [], tabs: [], sessions: [], servers: [],
  ts: 1, scope: {}, viewAll: false, snoozedUntil: null, update: undefined, error: false, authError: false };
const mutate = vi.fn<(command: ViewCommand) => Promise<boolean>>(async () => true);
let state: ViewClientState;
let inventory: PanelInventory = { agents: [a, b], panes: [a, b], fresh: new Set([terminalKey(terminalReference(a)!), terminalKey(terminalReference(b)!)]) };
vi.mock("@/components/fleet-view-experience", () => ({ useFleetView: () => ({ client: { mutate }, state, inventory }), FleetSyncControl: () => null }));
function mount() {
  const router = createMemoryRouter([{ path: "/panel", element: <FleetAgentPanel data={data} /> }, { path: "/", element: <div>Ordinary Fleet</div> }], { initialEntries: ["/panel"] });
  return { ...render(<RouterProvider router={router} />), router };
}
beforeEach(() => {
  mutate.mockClear();
  inventory = { agents: [a, b], panes: [a, b], fresh: new Set([terminalKey(terminalReference(a)!), terminalKey(terminalReference(b)!)]) };
  state = { joined: true, joining: false, available: true, busy: false, error: null, snapshot: {
    generation: "example", revision: 0, selection: null, rows: 3, columns: 4,
    slots: Array.from({ length: 12 }, (_, index) => index === 0 ? terminalReference(a) : null),
  } };
});
afterEach(() => vi.useRealTimers());

it("keyboard assignment replaces one square and keeps both native queue rows", async () => {
  const { container } = mount();
  await act(async () => {
    fireEvent.click(within(container).getByRole("button", { name: "Place Agent B in a slot" }));
  });
  await act(async () => {
    fireEvent.click(within(container).getByRole("button", { name: "Slot 1" }));
  });
  expect(mutate).toHaveBeenCalledWith({ type: "slot", index: 0, expected: terminalReference(a), terminal: terminalReference(b), rows: 3, columns: 4 });
  expect(container.querySelectorAll('[data-slot="panel-agent-queue"] [data-slot="native-agent-card"]')).toHaveLength(2);
});

it("a joined panel tap publishes selection and keeps the panel route", () => {
  const { container, router } = mount();
  const rows = container.querySelectorAll('[data-slot="panel-agent-queue"] [data-slot="native-agent-card"]');
  fireEvent.click(rows[1]!.querySelector("[aria-current], button")!);
  expect(mutate).toHaveBeenCalledWith({ type: "select", terminal: terminalReference(b) });
  expect(router.state.location.pathname).toBe("/panel");
});

it("bottom row and column controls send bounded shape changes and exit returns to ordinary Fleet", async () => {
  const { container, router } = mount();
  fireEvent.change(within(container).getByLabelText("Rows"), { target: { value: "5" } });
  expect(mutate).toHaveBeenCalledWith({ type: "layout", rows: 5, columns: 4, expectedRows: 3, expectedColumns: 4 });
  fireEvent.click(within(container).getByRole("button", { name: "Exit panel" }));
  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
});

it("card scrolling and handle cancellation never assign or select a Pane", () => {
  vi.useFakeTimers();
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit) {
      super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "touch";
    }
  }
  const { container, router } = mount();
  const handle = within(container).getByRole("button", { name: "Place Agent B in a slot" });
  const body = handle.closest('[data-slot="native-agent-card"]')!.querySelector("button")!;
  const event = (type: string, x: number) => fireEvent(body, new TestPointerEvent(type, { bubbles: true, button: 0, pointerId: 1, pointerType: "touch", clientX: x, clientY: 100 }));
  event("pointerdown", 10); event("pointermove", 40); vi.advanceTimersByTime(400); event("pointerup", 40);
  event("pointerdown", 10); event("pointercancel", 10); vi.advanceTimersByTime(400);
  expect(mutate).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/panel");
});

it("an immediate handle drag can replace a slot and cancellation cannot", () => {
  vi.useFakeTimers();
  class TestPointerEvent extends MouseEvent {
    readonly pointerId = 1;
    readonly pointerType = "touch";
  }
  const { container, router } = mount();
  const handle = within(container).getByRole("button", { name: "Place Agent B in a slot" });
  const target = container.querySelector<HTMLElement>("[data-panel-slot='0']")!;
  const original = document.elementFromPoint;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => target });
  const event = (type: string) => fireEvent(handle, new TestPointerEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: 100 }));
  try {
    event("pointerdown");  event("pointercancel");
    expect(mutate).not.toHaveBeenCalled();
    event("pointerdown");  event("pointerup");
    expect(mutate).toHaveBeenCalledWith({ type: "slot", index: 0, expected: terminalReference(a), terminal: terminalReference(b), rows: 3, columns: 4 });
    expect(router.state.location.pathname).toBe("/panel");
  } finally { Object.defineProperty(document, "elementFromPoint", { configurable: true, value: original }); }
});

it("panel uses the rail's grouped rows and timestamp order", () => {
  const older = { ...a, lastActiveAt: 1000 };
  const newer = { ...b, lastActiveAt: 2000 };
  inventory = { ...inventory, agents: [older, newer], panes: [older, newer] };
  const panel = mount();
  const rail = render(<NativeAgentRail agents={[older, newer]} bridge="connected" onOpen={() => {}} />);
  const order = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-slot="native-agent-card"]')].map((row) => row.dataset.rowKey);
  expect(order(panel.container)).toEqual(order(rail.container));
  expect(order(panel.container)).toEqual(["\u0000\u0000p2", "\u0000\u0000p1"]);
  expect(within(panel.container).getByText("Working")).toBeInTheDocument();
});

it("an independent panel publishes Agent and slot choices without navigating or joining", () => {
  state = { ...state, joined: false, activeViewers: 2 };
  const { container, router } = mount();
  fireEvent.click(container.querySelector('[data-slot="native-agent-card"] button')!);
  fireEvent.click(within(container).getByRole("button", { name: "Slot 1" }));
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate).toHaveBeenLastCalledWith({ type: "select", terminal: terminalReference(a) });
  expect(router.state.location.pathname).toBe("/panel");
  expect(within(container).getByText("Active sync tabs: 2")).toBeInTheDocument();
});
