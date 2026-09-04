import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { useEffect } from "react";

import { NavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { agentFavoriteStore, __resetAgentFavorites } from "../../../fleet/ui/agent-favorites.ts";
import type { HomeData } from "@/lib/loaders";
import { NativeHierarchyToggle, useNativePaneSwitcher } from "./native-navigation-context";
import { NativeNavigationShell } from "./native-navigation-shell";

const pane = {
  paneId: "p1",
  workspaceId: "w1",
  workspaceLabel: "Project",
  workspaceNumber: 1,
  tabId: "t1",
  tabLabel: "Main",
  agent: "claude",
  status: "working" as const,
  cwd: "/repo",
  focused: false,
  lastActiveAt: 1,
};

const data: HomeData = {
  bridge: "connected",
  device: undefined,
  agents: [pane],
  shellPanes: [],
  workspaces: [
    {
      workspaceId: "w1",
      number: 1,
      label: "Project",
      focused: true,
      activeTabId: "t1",
      tabCount: 1,
      paneCount: 1,
    },
  ],
  tabs: [
    {
      tabId: "t1",
      workspaceId: "w1",
      number: 1,
      label: "Main",
      focused: true,
      paneCount: 1,
    },
  ],
  sessions: [],
  servers: [],
  ts: 0,
  scope: {},
  viewAll: false,
  snoozedUntil: null,
  update: undefined,
  error: false,
  authError: false,
};

/** Stands in for the Pane page, which reads the switcher presentation through the same seam. */
function SwitcherProbe() {
  const switcher = useNativePaneSwitcher();
  return <div data-testid="switcher-title">{switcher?.title ?? "none"}</div>;
}

function renderShell(
  store = new NavigationPreferenceStore(),
  onMount = vi.fn(),
  shellData: HomeData = data,
) {
  function Layout() {
    useEffect(() => {
      onMount();
    }, []);
    return (
      <NativeNavigationShell data={shellData} preferenceStore={store}>
        {/* The header's leading slot, as the root route wires it. */}
        <NativeHierarchyToggle />
        <SwitcherProbe />
        <Outlet />
      </NativeNavigationShell>
    );
  }

  // A DATA router, as the app's own root is: the shell revalidates after a rename or a close from a
  // hierarchy row, and `useRevalidator` exists only under one.
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Layout />,
        children: [
          { index: true, element: <Link to="/pane/p1">Open direct</Link> },
          { path: "space/:spaceId", element: <div>Space route</div> },
          { path: "pane/:paneId", element: <div>Pane route</div> },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return { store, onMount };
}

beforeEach(() => {
  localStorage.clear();
  __resetAgentFavorites();
});

describe("NativeNavigationShell", () => {
  it("keeps one shell mounted while the native outlet navigates", async () => {
    const user = userEvent.setup();
    const { onMount } = renderShell();
    const shell = document.querySelector('[data-slot="native-navigation-shell"]');
    await user.click(screen.getByRole("link", { name: "Open direct" }));
    expect(await screen.findByText("Pane route")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="native-navigation-shell"]')).toBe(shell);
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("shows both rails with no control that would hide either", () => {
    renderShell();
    expect(screen.getByRole("complementary", { name: "Herds" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Agents" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sidebar$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Collapse (Herds|Agents)/ })).toBeNull();
  });

  it("resizes a rail by keyboard within its bounds and remembers the width", () => {
    const { store } = renderShell();
    const separator = screen.getByRole("separator", { name: "Resize Herds sidebar" });
    expect(separator).toHaveAttribute("aria-valuenow", "280");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "296");
    expect(store.snapshot().left).toEqual({ preferredWidth: 296 });
    expect(document.querySelector('[data-slot="native-navigation-shell"]')?.innerHTML).toContain(
      "motion-reduce:transition-none",
    );
  });

  it("opens the hierarchy from the header trigger, makes the route column inert, and returns focus", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole("button", { name: "Open Herds", expanded: false });
    const column = screen.getByText("Open direct").closest("[aria-hidden]");

    await user.click(trigger);
    expect(document.querySelector("#fleet-hierarchy-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    expect(column).toHaveAttribute("aria-hidden", "true");
    expect(column).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.querySelector("#fleet-hierarchy-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(column).toHaveAttribute("aria-hidden", "false");
  });

  it("closes the hierarchy overlay after one native Pane navigation", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole("button", { name: "Open Herds", expanded: false });
    await user.click(trigger);
    const overlay = document.querySelector("#fleet-hierarchy-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("missing hierarchy overlay");
    const surface = within(overlay);
    // The lone Tab is elided, so the Pane hangs directly off its Space — under the Tab's name,
    // because nobody named the Pane.
    await user.click(surface.getByRole("button", { name: "Expand Project" }));
    // The row also carries its state, so its accessible name is the pair.
    await user.click(await surface.findByRole("button", { name: /^Main/ }));

    expect(await screen.findByText("Pane route")).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(overlay.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });

  it("publishes the Agent surface as the Pane page's switcher presentation", () => {
    renderShell();
    expect(screen.getByTestId("switcher-title")).toHaveTextContent("Agents");
  });
  test("every member expands, whichever member the address is on", async () => {
    // The lead's merged body carries both machines' rows, and the loader narrows `workspaces`/`tabs`
    // to the address the URL is on — which is why the hierarchy reads the unnarrowed siblings. A rail
    // that read the narrowed lists could only ever open the machine you were already looking at.
    const rowsOn = (host: string) => ({
      workspace: {
        workspaceId: "w1",
        number: 1,
        label: `Project on ${host}`,
        focused: false,
        activeTabId: "t1",
        tabCount: 1,
        paneCount: 1,
        host,
      },
      tab: { tabId: "t1", workspaceId: "w1", number: 1, label: "Main", focused: false, paneCount: 1, host },
      pane: { ...pane, paneId: `p-${host}`, host },
    });
    const here = rowsOn("lead");
    const there = rowsOn("peer-a");
    const packData: HomeData = {
      ...data,
      servers: [
        { id: "lead", name: "north", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 1 },
        { id: "peer-a", name: "attic", isLead: false, reachable: true, protocol: "ok", lastSeenAt: 1 },
      ],
      // The address is on the lead, so the narrowed lists hold only the lead's rows...
      scope: { host: "lead" },
      workspaces: [here.workspace],
      tabs: [here.tab],
      // ...while the merged ones hold both members'.
      allWorkspaces: [here.workspace, there.workspace],
      allTabs: [here.tab, there.tab],
      agents: [here.pane, there.pane],
    };

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <NativeNavigationShell data={packData} preferenceStore={new NavigationPreferenceStore()}>
              <Outlet />
            </NativeNavigationShell>
          ),
          children: [{ index: true, element: <div /> }],
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    // Both members are present, and the one the address is NOT on carries its own rows rather than
    // an empty row that cannot be opened.
    expect(await screen.findByText("north")).toBeInTheDocument();
    expect(screen.getByText("attic")).toBeInTheDocument();
    expect(screen.getByText("Project on lead")).toBeInTheDocument();
    expect(screen.getByText("Project on peer-a")).toBeInTheDocument();
  });
  test("a member the lead is refusing sinks below the ones that answer", async () => {
    const rowsOn = (host: string) => ({
      workspace: {
        workspaceId: "w1",
        number: 1,
        label: `Project on ${host}`,
        focused: false,
        activeTabId: "t1",
        tabCount: 1,
        paneCount: 1,
        host,
      },
      tab: { tabId: "t1", workspaceId: "w1", number: 1, label: "Main", focused: false, paneCount: 1, host },
      pane: { ...pane, paneId: `p-${host}`, host },
    });
    const lead = rowsOn("lead");
    const up = rowsOn("peer-up");
    const down = rowsOn("peer-down");
    const packData: HomeData = {
      ...data,
      servers: [
        { id: "lead", name: "north", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 1 },
        // Roster order puts the refused member in the middle; the rail must not.
        // Refused AND a receipt far older than one missed sweep, which is what makes it believable.
        { id: "peer-down", name: "cellar", isLead: false, reachable: false, protocol: "ok", lastSeenAt: 1 },
        { id: "peer-up", name: "attic", isLead: false, reachable: true, protocol: "ok", lastSeenAt: 1 },
      ],
      ts: 60_000,
      scope: { host: "lead" },
      workspaces: [lead.workspace],
      tabs: [lead.tab],
      allWorkspaces: [lead.workspace, up.workspace, down.workspace],
      allTabs: [lead.tab, up.tab, down.tab],
      agents: [lead.pane, up.pane, down.pane],
    };

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <NativeNavigationShell data={packData} preferenceStore={new NavigationPreferenceStore()}>
              <Outlet />
            </NativeNavigationShell>
          ),
          children: [{ index: true, element: <div /> }],
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    await screen.findByText("north");
    // Space rows disclose too, so pick the rows that name a member.
    const names = ["north", "attic", "cellar"];
    const hostOrder = screen
      .getAllByRole("button")
      .filter((row) => row.getAttribute("aria-expanded") !== null)
      .map((row) => names.find((name) => (row.textContent ?? "").includes(name)))
      .filter((name): name is string => name !== undefined);
    // Lead first, then the member that answers, and the refused one last.
    expect(hostOrder).toEqual(["north", "attic", "cellar"]);
    // And it is closed, rather than spilling its last-good rows into the hierarchy.
    expect(screen.getByText("Project on peer-up")).toBeInTheDocument();
    expect(screen.queryByText("Project on peer-down")).toBeNull();
  });
  test("one missed sweep does not repaint a member that is still answering", async () => {
    const rowsOn = (host: string) => ({
      workspace: {
        workspaceId: "w1",
        number: 1,
        label: `Project on ${host}`,
        focused: false,
        activeTabId: "t1",
        tabCount: 1,
        paneCount: 1,
        host,
      },
      tab: { tabId: "t1", workspaceId: "w1", number: 1, label: "Main", focused: false, paneCount: 1, host },
      pane: { ...pane, paneId: `p-${host}`, host },
    });
    const lead = rowsOn("lead");
    const blip = rowsOn("peer-blip");
    const packData: HomeData = {
      ...data,
      // The lead's probe budget is strictly below its poll interval, so a slow exchange on a loaded
      // member fails one sweep. `reachable` is false for that body, and the receipt is one sweep old.
      ts: 60_000,
      servers: [
        { id: "lead", name: "north", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 60_000 },
        { id: "peer-blip", name: "attic", isLead: false, reachable: false, protocol: "ok", lastSeenAt: 48_000 },
      ],
      scope: { host: "lead" },
      workspaces: [lead.workspace],
      tabs: [lead.tab],
      allWorkspaces: [lead.workspace, blip.workspace],
      allTabs: [lead.tab, blip.tab],
      agents: [lead.pane, blip.pane],
    };

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <NativeNavigationShell data={packData} preferenceStore={new NavigationPreferenceStore()}>
              <Outlet />
            </NativeNavigationShell>
          ),
          children: [{ index: true, element: <div /> }],
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    await screen.findByText("north");
    // Not repainted, not moved, and not closed: one missed sweep says nothing about the machine.
    const rows = screen
      .getAllByRole("button")
      .filter((row) => row.getAttribute("aria-expanded") !== null)
      .map((row) => row.textContent ?? "");
    expect(rows.some((row) => /unreachable|不可达/i.test(row))).toBe(false);
    expect(screen.getByText("Project on peer-blip")).toBeInTheDocument();
  });
});

describe("the shell's command layer", () => {
  it("opens the command bar on its one direct chord", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(document.querySelector('[data-slot="fleet-command-bar"]')).toBeNull();
    await user.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    const bar = screen.getByRole("dialog", { name: "Fleet commands" });
    expect(within(bar).getAllByRole("option").length).toBeGreaterThan(40);
  });

  it("finds a pane by name once the leading slash is gone", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    const bar = screen.getByRole("dialog", { name: "Fleet commands" });
    const input = within(bar).getByRole("combobox");
    await user.clear(input);
    // The pane is unnamed, so the roster calls it what the rail calls it: the agent's own name.
    await user.type(input, "claude");
    expect(within(bar).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Pane route")).toBeInTheDocument();
  });

  it("collapses and restores both rails together, keeping their DOM", async () => {
    const user = userEvent.setup();
    renderShell();
    const rail = screen.getByRole("complementary", { name: "Herds" });
    const agents = screen.getByRole("complementary", { name: "Agents" });

    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("b");
    // The SAME elements, made inert rather than unmounted — which is what preserves their scroll
    // position and disclosure state across the round trip. They are out of the accessibility tree,
    // which is why they are held by reference here rather than looked up again.
    expect(rail.isConnected).toBe(true);
    expect(rail).toHaveAttribute("inert");
    expect(rail).toHaveAttribute("aria-hidden", "true");
    expect(agents).toHaveAttribute("aria-hidden", "true");
    expect(rail.style.width).toBe("0px");

    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("b");
    expect(rail).not.toHaveAttribute("aria-hidden", "true");
    expect(rail.style.width).not.toBe("0px");
  });

  it("makes no request and recreates no frame when the rails collapse", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderShell();
    fetchSpy.mockClear();
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("b");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    fetchSpy.mockRestore();
  });
  it("opens Collie's own actions for the current pane rather than an editor of its own", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("link", { name: "Open direct" }));
    expect(await screen.findByText("Pane route")).toBeInTheDocument();

    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("{Shift>}P{/Shift}");
    // The sheet Collie already has, on the pane the route is on — not a second rename dialog.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Fleet commands" })).toBeNull();
  });

  it("copies a link built from the route it is on, and nothing else", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderShell();
    await user.click(screen.getByRole("link", { name: "Open direct" }));
    expect(await screen.findByText("Pane route")).toBeInTheDocument();

    await user.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    const bar = screen.getByRole("dialog", { name: "Fleet commands" });
    await user.type(within(bar).getByRole("combobox"), "copy fleet");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = String(writeText.mock.calls[0]?.[0]);
    expect(copied).toContain("/pane/p1");
    expect(copied).not.toContain("cookie");
  });

  it("walks the agents in the order the rail drew them, favourites and all", async () => {
    const user = userEvent.setup();
    const second = { ...pane, paneId: "p2", tabId: "t2", tabLabel: "Second", agent: "codex" };
    const two: HomeData = { ...data, agents: [pane, second] };
    // A favourite moves a row inside its section; the command layer must move with it.
    agentFavoriteStore.toggle(second);
    renderShell(new NavigationPreferenceStore(), vi.fn(), two);

    const rail = screen.getByRole("complementary", { name: "Agents" });
    const railOrder = Array.from(
      rail.querySelectorAll<HTMLElement>('[data-slot="native-agent-card"]'),
    ).map((row) => row.textContent);

    await user.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    const bar = screen.getByRole("dialog", { name: "Fleet commands" });
    await user.clear(within(bar).getByRole("combobox"));
    const barOrder = within(bar)
      .getAllByRole("option")
      .map((option) => option.textContent);

    // The two surfaces NAME a row differently — the rail shows the Tab, the bar shows the Agent —
    // so the assertion is about which row each puts FIRST, which is the thing that has to agree.
    expect(barOrder.map((text) => (text ?? "").startsWith("codex"))).toEqual([true, false]);
    expect(railOrder.map((text) => (text ?? "").includes("Second"))).toEqual([true, false]);
  });
});

