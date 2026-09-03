import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { useEffect } from "react";

import { NavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
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

function renderShell(store = new NavigationPreferenceStore(), onMount = vi.fn()) {
  function Layout() {
    useEffect(() => {
      onMount();
    }, []);
    return (
      <NativeNavigationShell data={data} preferenceStore={store}>
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
});
