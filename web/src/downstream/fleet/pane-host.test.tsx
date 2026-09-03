import type { ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./terminal-resize", () => ({
  measureTerminalColumns: vi.fn(() => 64),
}));
const shortcut = vi.hoisted(() => ({
  handler: null as null | (() => void | Promise<void>),
}));
vi.mock("./shortcuts", () => ({
  startFleetShortcuts: vi.fn(() => () => {}),
  registerFleetShortcutHandler: vi.fn((_action: string, handler: () => void | Promise<void>) => {
    shortcut.handler = handler;
    return () => {
      if (shortcut.handler === handler) shortcut.handler = null;
    };
  }),
}));

import { AgentChat } from "@/components/agent-chat";
import { clearStatus } from "@/lib/status";
import { fixtureAgents } from "@/test/handlers";
import { server } from "@/test/setup";
import { measureTerminalColumns } from "./terminal-resize";

beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

function renderChat(overrides: Partial<ComponentProps<typeof AgentChat>> = {}) {
  const agent = fixtureAgents[0]!;
  const props: ComponentProps<typeof AgentChat> = {
    paneId: agent.paneId,
    agent,
    agents: fixtureAgents,
    shellPanes: [],
    tabs: [],
    text: "recent pane output",
    onBack: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: "/", element: <AgentChat {...props} /> }]);
  render(<RouterProvider router={router} />);
}

describe("Fleet Pane host ports", () => {
  beforeEach(() => {
    clearStatus();
    vi.mocked(measureTerminalColumns).mockClear();
    shortcut.handler = null;
  });

  it("keeps native controls mounted behind exact framed presentation hooks", async () => {
    const user = userEvent.setup();
    renderChat();

    const trigger = screen.getByRole("button", { name: "Switch pane" });
    expect(trigger).toHaveAttribute("data-fleet-pane-switch-trigger");
    const label = screen.getByText("Controls");
    expect(label.parentElement).toHaveAttribute("data-fleet-controls-label");
    expect(label.parentElement?.parentElement).toHaveAttribute("data-fleet-controls-row");

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Switch pane" })).toBeInTheDocument();
  });

  it("uses the same measured session-scoped resize for shortcut and Display", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.post(/\/api\/pane\/[^/]+\/resize$/, async ({ request }) => {
        requests.push({ url: request.url, body: await request.json() });
        return HttpResponse.json({ ok: true, cols: 64, rows: 31 });
      }),
    );
    const user = userEvent.setup();
    renderChat({ session: "shortcut-session" });
    await waitFor(() => expect(shortcut.handler).not.toBeNull());

    await act(async () => shortcut.handler?.());
    await waitFor(() => expect(requests).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Display settings" }));
    await user.click(screen.getByRole("button", { name: "Resize pane to this view" }));
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(measureTerminalColumns).toHaveBeenCalledTimes(2);
    expect(requests[0]!.url).toContain("/api/pane/w1%3Ap1/resize?session=shortcut-session");
    expect(requests[0]!.body).toEqual({ cols: 64 });
    expect(requests[1]).toEqual(requests[0]);
  });

  it("surfaces a controller conflict without changing the browser layout", async () => {
    server.use(
      http.post(/\/api\/pane\/[^/]+\/resize$/, () =>
        HttpResponse.json({ ok: false, error: "terminal already has a controller" }),
      ),
    );
    const user = userEvent.setup();
    renderChat();
    await user.click(screen.getByRole("button", { name: "Display settings" }));
    await user.click(screen.getByRole("button", { name: "Resize pane to this view" }));
    expect(await screen.findByText("terminal already has a controller")).toBeInTheDocument();
  });

  it("omits Collie home chrome only inside a frame", () => {
    const ownParent = Object.getOwnPropertyDescriptor(window, "parent");
    Object.defineProperty(window, "parent", { configurable: true, value: {} });
    try {
      renderChat();
      expect(screen.queryByRole("button", { name: "Collie home" })).toBeNull();
      expect(screen.getByRole("button", { name: "Open webapp overview" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Find in output" })).toBeInTheDocument();
    } finally {
      Object.defineProperty(
        window,
        "parent",
        ownParent ?? { configurable: true, value: window },
      );
    }
  });
});
