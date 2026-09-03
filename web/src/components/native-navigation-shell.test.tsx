import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Outlet, Route, Routes, MemoryRouter } from "react-router";
import { useEffect } from "react";

import { NavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import type { HomeData } from "@/lib/loaders";
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

function renderShell(store = new NavigationPreferenceStore(), onMount = vi.fn()) {
  function Layout() {
    useEffect(() => {
      onMount();
    }, []);
    return (
      <NativeNavigationShell data={data} preferenceStore={store}>
        <Outlet />
      </NativeNavigationShell>
    );
  }

  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Link to="/pane/p1">Open direct</Link>} />
          <Route path="space/:spaceId" element={<div>Space route</div>} />
          <Route path="pane/:paneId" element={<div>Pane route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { store, onMount };
}

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

  it("keeps responsive overlays mutually exclusive and restores trigger focus", async () => {
    const user = userEvent.setup();
    renderShell();
    const spacesTrigger = screen.getByRole("button", { name: "Spaces", expanded: false });
    const agentsTrigger = screen.getByRole("button", { name: "Agents", expanded: false });

    await user.click(spacesTrigger);
    expect(document.querySelector("#fleet-hierarchy-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await user.click(agentsTrigger);
    expect(document.querySelector("#fleet-hierarchy-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(document.querySelector("#fleet-agents-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(agentsTrigger).toHaveFocus());
    expect(document.querySelector("#fleet-agents-overlay")?.closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("resizes by keyboard and collapse makes desktop descendants inert", async () => {
    const user = userEvent.setup();
    const { store } = renderShell();
    const separator = screen.getByRole("separator", { name: "Resize Spaces sidebar" });
    expect(separator).toHaveAttribute("aria-valuenow", "280");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "296");

    await user.click(screen.getByRole("button", { name: "Collapse Spaces sidebar" }));
    const content = document.querySelector("#fleet-left-sidebar-content");
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(content).toHaveAttribute("inert");
    expect(store.snapshot().left).toEqual({ preferredWidth: 296, collapsed: true });

    await user.click(screen.getByRole("button", { name: "Expand Spaces sidebar" }));
    expect(store.snapshot().left).toEqual({ preferredWidth: 296, collapsed: false });
    expect(document.querySelector('[data-slot="native-navigation-shell"]')?.innerHTML).toContain(
      "motion-reduce:transition-none",
    );
  });

  it("closes the hierarchy overlay after one native Pane navigation", async () => {
    const user = userEvent.setup();
    renderShell();
    const spacesTrigger = screen.getByRole("button", { name: "Spaces", expanded: false });
    await user.click(spacesTrigger);
    const overlay = document.querySelector("#fleet-hierarchy-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("missing hierarchy overlay");
    const surface = within(overlay);
    await user.click(surface.getByRole("button", { name: "Expand Project" }));
    await user.click(surface.getByRole("button", { name: "Main" }));
    await user.click(surface.getByRole("button", { name: "claude" }));

    expect(await screen.findByText("Pane route")).toBeInTheDocument();
    await waitFor(() => expect(spacesTrigger).toHaveFocus());
    expect(overlay.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });
});
