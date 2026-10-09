// The two ports the Fleet shell takes on Collie's one header (FORK.toml native-navigation-sidebars-port
// and native-pane-chrome-port): a leading node before the mark, and a route that declines the mark
// while keeping the lost-connection badge the mark would carry.
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import type { ComponentProps, ReactElement } from "react";

import { ROOT_ROUTE_ID } from "@/lib/loaders";
import { AppHeaderHost, RouteHeader, SettingsGear } from "./app-header";
import { CONNECTION_LOST_MS } from "@/hooks/use-connection-lost";
import { __resetConnectionHealth } from "@/lib/connection-health";
import type { BridgeStatus } from "@/lib/types";

function renderHeader(ui: ReactElement) {
  const router = createMemoryRouter([{ id: ROOT_ROUTE_ID, path: "/", element: ui }], {
    initialEntries: ["/"],
  });
  return render(<RouterProvider router={router} />);
}

function Header({
  bridge,
  error,
  ...route
}: { bridge: BridgeStatus | undefined; error: boolean } & ComponentProps<typeof RouteHeader>) {
  return (
    <AppHeaderHost bridge={bridge} error={error}>
      <RouteHeader {...route} />
    </AppHeaderHost>
  );
}

describe("the header — a route that declines the mark keeps its lost badge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetConnectionHealth();
  });
  afterEach(() => vi.useRealTimers());

  it("stays in the row, with the mark's words, on a route that declines the mark", () => {
    const fleetBadge = (root: ParentNode) => root.querySelector('[data-slot="fleet-lost-badge"]');
    const { container } = renderHeader(<Header bridge="connected" error mark={false} onHome={() => {}} />);
    expect(fleetBadge(container)).toBeNull();
    act(() => vi.advanceTimersByTime(CONNECTION_LOST_MS));
    expect(screen.queryByRole("button", { name: "Collie home — not connected" })).toBeNull();
    expect(fleetBadge(container)?.getAttribute("data-icon")).toBe("cloud-off");
    expect(screen.getByRole("img", { name: "Collie home — not connected" })).toBeInTheDocument();
  });
});

const DashRoute = () => <RouteHeader wordmark width="column" rightTrail={<SettingsGear />} />;
const SettingsLikeRoute = () => (
  <RouteHeader width="column" override={<button type="button">Back</button>} />
);

describe("the header — the shell's leading node", () => {
  beforeEach(() => __resetConnectionHealth());

  it("renders a downstream leading node before the mark, and never over an override row", async () => {
    // A slot at the start of the row, drawn BEFORE the mark so the shell's navigation control is
    // where a thumb reaches for it, and inside the non-override branch so a route that takes the
    // whole row still owns every pixel.
    const router = createMemoryRouter(
      [
        {
          id: ROOT_ROUTE_ID,
          path: "/",
          element: (
            <AppHeaderHost bridge="connected" error={false} leading={<button type="button">Open Herds</button>}>
              <Outlet />
            </AppHeaderHost>
          ),
          children: [
            { index: true, element: <DashRoute /> },
            { path: "settings", element: <SettingsLikeRoute /> },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );
    const { container } = render(<RouterProvider router={router} />);
    const leading = screen.getByRole("button", { name: "Open Herds" });
    const mark = screen.getByRole("button", { name: "Collie home" });
    expect(leading.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[data-slot="header-row"]')?.contains(leading)).toBe(true);

    await act(async () => {
      await router.navigate("/settings");
    });
    expect(screen.queryByRole("button", { name: "Open Herds" })).toBeNull();
  });
});
