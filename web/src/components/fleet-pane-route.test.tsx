import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaneContentProps } from "./agent-chat";
import { ROOT_ROUTE_ID, type HomeData, type PaneData } from "@/lib/loaders";
import type * as LoaderModule from "@/lib/loaders";
import { shownLastSeenAt } from "@/routes/root";
import { fixtureAgents } from "@/test/handlers";
import { withHeaderHost } from "@/test/header-host";
import { paneSurfaceStore } from "../../../fleet/ui/terminal/switch.ts";
import { FleetPaneRoute, fleetPaneLoader, terminalPaneData } from "./fleet-pane-route";

interface PaneLoaderArgs {
  params: { paneId?: string };
  request?: Request;
}

const paneLoader = vi.fn();
vi.mock("@/lib/loaders", async (importOriginal) => ({
  ...(await importOriginal<typeof LoaderModule>()),
  paneLoader: (args: PaneLoaderArgs) => paneLoader(args),
}));
vi.mock("@/components/fleet-terminal", () => ({
  FleetTerminal: ({ onOutputChange }: PaneContentProps) => {
    useEffect(() => onOutputChange(true), [onOutputChange]);
    return <div data-testid="terminal-surface">terminal output</div>;
  },
}));

function mount() {
  const agent = { ...fixtureAgents[0]!, paneLabel: "native-pane", cwd: "/workspace/other" };
  const root: HomeData = {
    bridge: "connected", agents: [agent], shellPanes: [], workspaces: [], tabs: [],
    device: undefined, sessions: [], servers: [], ts: 0, scope: {}, viewAll: false,
    snoozedUntil: null, update: undefined, error: false, authError: false,
  };
  paneLoader.mockImplementation((): PaneData => ({
    ...terminalPaneData({ params: { paneId: agent.paneId } }),
    text: "fresh mirror output", requestedLines: 600,
  }));
  const router = createMemoryRouter([{
    id: ROOT_ROUTE_ID, path: "/", loader: () => root, element: withHeaderHost(<Outlet />),
    children: [{ path: "pane/:paneId", loader: fleetPaneLoader, element: <FleetPaneRoute /> }],
  }], { initialEntries: [`/pane/${agent.paneId}`] });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

beforeEach(() => {
  paneSurfaceStore.set("mirror");
  paneLoader.mockReset();
});

describe("native Pane frame across surface changes", () => {
  it("keeps identity and actions mounted, and restores fresh mirror text on return", async () => {
    const { container, router } = mount();
    await screen.findByText("fresh mirror output");
    const identity = screen.getByRole("button", { name: /Open .+ overview/ });
    const actions = screen.getByRole("button", { name: "Pane actions" });
    expect(identity).toHaveTextContent("native-pane");
    expect(identity).toHaveTextContent("/workspace/other");
    paneLoader.mockClear();

    await act(async () => { paneSurfaceStore.set("terminal"); });
    await screen.findByTestId("terminal-surface");
    expect(container.querySelector('[data-slot="pane-identity"]')).toBe(identity);
    expect(screen.getByRole("button", { name: "Pane actions" })).toBe(actions);
    expect(screen.queryByText("fresh mirror output")).toBeNull();
    expect(screen.queryByPlaceholderText(/type a reply/i)).toBeNull();
    expect(paneLoader).not.toHaveBeenCalled();
    fireEvent.click(actions);
    expect(await screen.findByRole("button", { name: "Find in output" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await act(async () => { paneSurfaceStore.set("mirror"); });
    await screen.findByText("fresh mirror output");
    expect(container.querySelector('[data-slot="pane-identity"]')).toBe(identity);
    expect(within(identity).getByText("native-pane")).toBeInTheDocument();
    await waitFor(() => expect(router.state.revalidation).toBe("idle"));
    router.dispose();
  });

  it("uses the native header on a direct terminal visit without reading a mirror", async () => {
    paneSurfaceStore.set("terminal");
    const { container, router } = mount();
    await screen.findByTestId("terminal-surface");
    expect(container.querySelector('[data-slot="pane-identity"]')).toHaveTextContent("native-pane");
    expect(screen.getByRole("button", { name: "Pane actions" })).toBeInTheDocument();
    expect(paneLoader).not.toHaveBeenCalled();
    router.dispose();
  });
});

describe("terminal loader boundaries", () => {
  it("fetches no mirror while keeping the requested host and session scope", async () => {
    paneSurfaceStore.set("terminal");
    const data = await fleetPaneLoader({
      params: { paneId: "w1:p1" },
      request: new Request("https://fleet.example.com/pane/w1:p1?h=laptop&s=work"),
    });
    expect(paneLoader).not.toHaveBeenCalled();
    expect(data.scope).toEqual({ host: "laptop", session: "work" });
  });

  it("rejects a route without a Pane", () => {
    expect(() => terminalPaneData({ params: {} })).toThrow("missing :paneId");
  });

  it("dates the connection banner from the herd when no mirror is being read", () => {
    // SAFETY: only the root timestamp is read on the no-mirror branch being exercised.
    const root = { lastSeenAt: 1_700_000_000_000 } as Parameters<typeof shownLastSeenAt>[0];
    expect(shownLastSeenAt(root, terminalPaneData({ params: { paneId: "w1:p1" } }))).toBe(root.lastSeenAt);
  });
});
