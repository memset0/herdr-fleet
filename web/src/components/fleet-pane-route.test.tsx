import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { paneSurfaceStore } from "../../../fleet/ui/terminal/switch.ts";
import { fleetPaneLoader, terminalPaneData } from "./fleet-pane-route";

interface PaneLoaderArgs {
  params: { paneId?: string };
  request?: Request;
}

const paneLoader = vi.fn();

vi.mock("@/lib/loaders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/loaders")>()),
  paneLoader: (args: PaneLoaderArgs) => paneLoader(args),
}));

vi.mock("@/routes/detail", () => ({
  DetailRoute: () => <div data-testid="mirror-surface" />,
}));

vi.mock("@/components/fleet-terminal", () => ({
  FleetTerminal: () => <div data-testid="terminal-surface" />,
}));

vi.mock("@/lib/route-data", () => ({
  useRootData: () => ({ agents: [], shellPanes: [], servers: undefined, sessions: undefined, device: undefined }),
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useLoaderData: () => terminalPaneData({ params: { paneId: "w1:p1" } }),
  useNavigate: () => vi.fn(),
}));

// Imported after the mocks so the element under test sees them.
const { FleetPaneRoute } = await import("./fleet-pane-route");

describe("which surface the pane route draws", () => {
  beforeEach(() => {
    paneLoader.mockReset();
    paneSurfaceStore.set("mirror");
  });

  it("renders Collie's own element while the switch is at its default", () => {
    render(<FleetPaneRoute />);
    expect(screen.getByTestId("mirror-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("terminal-surface")).toBeNull();
  });

  it("renders the terminal surface while the switch is on", () => {
    paneSurfaceStore.set("terminal");
    render(<FleetPaneRoute />);
    expect(screen.getByTestId("terminal-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("mirror-surface")).toBeNull();
  });

  it("ignores a surface named in the address or carried in navigation state", () => {
    // The stored switch decides. A link that could put a browser into the terminal surface would be
    // a link that types into somebody's terminal.
    window.history.replaceState({ surface: "terminal" }, "", "/pane/w1:p1?surface=terminal");
    render(<FleetPaneRoute />);
    expect(screen.getByTestId("mirror-surface")).toBeInTheDocument();
  });
});

describe("which loader runs", () => {
  beforeEach(() => {
    paneLoader.mockReset();
    paneSurfaceStore.set("mirror");
  });

  it("is Collie's own, with the same arguments, while the switch is at its default", async () => {
    const args = { params: { paneId: "w1:p1" }, request: new Request("https://fleet.example.com/pane/w1:p1") };
    paneLoader.mockResolvedValue({ paneId: "w1:p1", text: "mirror text" });
    await expect(fleetPaneLoader(args)).resolves.toEqual({ paneId: "w1:p1", text: "mirror text" });
    expect(paneLoader).toHaveBeenCalledTimes(1);
    expect(paneLoader).toHaveBeenCalledWith(args);
  });

  it("fetches no mirror at all while the switch is on", async () => {
    paneSurfaceStore.set("terminal");
    const data = await fleetPaneLoader({
      params: { paneId: "w1:p1" },
      request: new Request("https://fleet.example.com/pane/w1:p1?h=laptop&s=work"),
    });
    expect(paneLoader).not.toHaveBeenCalled();
    expect(data.text).toBe("");
    expect(data.scope).toEqual({ host: "laptop", session: "work" });
  });

  it("fails loudly on a route with no pane, exactly as Collie's does", () => {
    paneSurfaceStore.set("terminal");
    expect(() => terminalPaneData({ params: {} })).toThrow("missing :paneId");
  });
});

describe("what the stub leaves alone", () => {
  it("keeps the connection banner dated by the herd, exactly as an unedited root does", async () => {
    // `root.tsx` is upstream's and carries no port of ours: the stub is the shape its existing
    // fall-through already handles, which is the whole reason it has this shape.
    const { shownLastSeenAt } = await import("@/routes/root");
    // SAFETY: `shownLastSeenAt` reads exactly two fields of its first argument — `lastSeenAt`, and
    // nothing else on this branch — so a literal carrying that field exercises the real function.
    const home = { lastSeenAt: 1_700_000_000_000 } as Parameters<typeof shownLastSeenAt>[0];
    const stub = terminalPaneData({ params: { paneId: "w1:p1" } });
    expect(shownLastSeenAt(home, stub)).toBe(home.lastSeenAt);
    // And the branch that WOULD borrow the pane's own stamp is not reachable from this shape.
    expect(stub.error).toBe(false);
    expect(stub.text).toBe("");
  });
});
