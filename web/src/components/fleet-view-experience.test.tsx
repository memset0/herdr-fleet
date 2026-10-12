import { render, fireEvent, within, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "@/test/setup";
import { FleetViewExperience, FleetSyncControl } from "./fleet-view-experience";
import { terminalKey, terminalReference } from "../../../fleet/bindings/identity.ts";
import type { HomeData } from "@/lib/loaders";
import type { AgentView } from "@/lib/types";
import { scopeFromUrl } from "@/lib/scope";

const a: AgentView = { paneId: "p1", workspaceId: "w1", workspaceLabel: "Example", workspaceNumber: 1, tabId: "t1",
  agent: "codex", status: "working", cwd: "/example", focused: false, bindingId: "herdr:term_a", bindingSession: "default", session: "default" };
const b = { ...a, paneId: "p2", bindingId: "herdr:term_b" };
const inventory = { agents: [a, b], panes: [a, b], fresh: new Set([terminalKey(terminalReference(a)!), terminalKey(terminalReference(b)!)]) };
vi.mock("@/lib/fleet-panel-inventory", async (original) => ({ ...await original<typeof import("@/lib/fleet-panel-inventory")>(), loadPanelInventory: async () => inventory }));

it("reconnect follows an unchanged central revision after offline local navigation without echo", async () => {
  let online = true, writes = 0;
  server.use(http.get("*/fleet/api/view-state", () => online ? HttpResponse.json({ generation: "example", revision: 1,
    selection: terminalReference(a), rows: 3, columns: 4, slots: Array(12).fill(null) }) : HttpResponse.json({ error: "unavailable" }, { status: 503 })),
  http.post("*/fleet/api/view-state", () => { writes += 1; return HttpResponse.json({}); }));
  function Layout() {
    const here = useLocation();
    const data: HomeData = { agents: [a, b], shellPanes: [], workspaces: [], tabs: [], sessions: [], servers: [],
      bridge: "connected", device: undefined, ts: 1, scope: scopeFromUrl(`http://localhost${here.pathname}${here.search}`),
      viewAll: false, snoozedUntil: null, update: undefined, error: false, authError: false };
    return <FleetViewExperience data={data}><FleetSyncControl /><Outlet /></FleetViewExperience>;
  }
  const router = createMemoryRouter([{ path: "/", element: <Layout />, children: [{ path: "pane/:paneId", element: <div>Pane</div> }] }], { initialEntries: ["/pane/p1?s=default"] });
  const { container } = render(<RouterProvider router={router} />);
  fireEvent.click(within(container).getByRole("button", { name: "Join pane selection sync" }));
  await waitFor(() => expect(within(container).getByRole("button", { name: "Leave pane selection sync" })).toBeInTheDocument());
  online = false;
  await waitFor(() => expect(within(container).getByText("Unavailable")).toBeInTheDocument(), { timeout: 3500 });
  await router.navigate("/pane/p2?s=default");
  online = true;
  await waitFor(() => expect(router.state.location.pathname).toBe("/pane/p1"), { timeout: 3500 });
  expect(writes).toBe(0);
});

it("root shell publishes ordinary child Pane navigation before following the previous choice", async () => {
  let selection = terminalReference(a), revision = 1;
  const writes: unknown[] = [];
  server.use(http.get("*/fleet/api/view-state", () => HttpResponse.json({ generation: "example", revision,
    selection, rows: 3, columns: 4, slots: Array(12).fill(null) })),
  http.post("*/fleet/api/view-state", async ({ request }) => {
    writes.push(await request.json());
    // Keep the previous central selection visible during the local navigation effect.
    await new Promise((resolve) => setTimeout(resolve, 50));
    selection = terminalReference(b); revision += 1;
    return HttpResponse.json({ generation: "example", revision, selection, rows: 3, columns: 4, slots: Array(12).fill(null) });
  }));
  function Layout() {
    const data: HomeData = { agents: [a, b], shellPanes: [], workspaces: [], tabs: [], sessions: [], servers: [],
      bridge: "connected", device: undefined, ts: 1, scope: {}, viewAll: false, snoozedUntil: null,
      update: undefined, error: false, authError: false };
    return <FleetViewExperience data={data}><FleetSyncControl /><Outlet /></FleetViewExperience>;
  }
  const router = createMemoryRouter([{ path: "/", element: <Layout />, children: [{ path: "pane/:paneId", element: <div>Pane</div> }] }], { initialEntries: ["/pane/p1?s=default"] });
  const { container } = render(<RouterProvider router={router} />);
  fireEvent.click(within(container).getByRole("button", { name: "Join pane selection sync" }));
  await waitFor(() => expect(within(container).getByRole("button", { name: "Leave pane selection sync" })).toBeInTheDocument());
  await router.navigate("/pane/p2?s=default");
  await waitFor(() => expect(writes).toEqual([{ type: "select", terminal: terminalReference(b) }]));
  await waitFor(() => expect(router.state.location.pathname).toBe("/pane/p2"));
  expect(within(container).getByRole("button", { name: "Leave pane selection sync" })).toBeInTheDocument();
});

it("a viewer returning from the background follows the latest choice without echo", async () => {
  let hidden = false, reads = 0, writes = 0, selection = terminalReference(a), revision = 1;
  const visibility = vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  server.use(http.get("*/fleet/api/view-state", () => { reads += 1; return HttpResponse.json({ generation: "example", revision,
    selection, rows: 3, columns: 4, slots: Array(12).fill(null) }); }),
  http.post("*/fleet/api/view-state", () => { writes += 1; return HttpResponse.json({}); }));
  function Layout() {
    const data: HomeData = { agents: [a, b], shellPanes: [], workspaces: [], tabs: [], sessions: [], servers: [],
      bridge: "connected", device: undefined, ts: 1, scope: {}, viewAll: false, snoozedUntil: null,
      update: undefined, error: false, authError: false };
    return <FleetViewExperience data={data}><FleetSyncControl /><Outlet /></FleetViewExperience>;
  }
  const router = createMemoryRouter([{ path: "/", element: <Layout />, children: [{ path: "pane/:paneId", element: <div>Pane</div> }] }], { initialEntries: ["/pane/p1?s=default"] });
  const rendered = render(<RouterProvider router={router} />);
  try {
    fireEvent.click(within(rendered.container).getByRole("button", { name: "Join pane selection sync" }));
    await waitFor(() => expect(within(rendered.container).getByRole("button", { name: "Leave pane selection sync" })).toBeInTheDocument());
    hidden = true; fireEvent(document, new Event("visibilitychange"));
    selection = terminalReference(b); revision += 1;
    const before = reads;
    hidden = false; fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(reads).toBeGreaterThan(before));
    await waitFor(() => expect(router.state.location.pathname).toBe("/pane/p2"));
    expect(writes).toBe(0);
  } finally { rendered.unmount(); visibility.mockRestore(); }
});
