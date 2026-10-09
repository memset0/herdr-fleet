import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";

import { server } from "@/test/setup";
import { clearStatus } from "@/lib/status";
import { __resetOperatorCommands } from "@/lib/operator-config";
import { fixtureAgents, paneTextWithDraft } from "@/test/handlers";
import { withHeaderHost } from "@/test/header-host";
import { AgentChat } from "./agent-chat";
import { __resetPaneFitAvailability, hostCanFit } from "./fleet-pane-fit";

// Manual Pane fit is Fleet's: the Display row asks the Fleet Gateway which Hosts can fit and sends
// its one request to the Gateway's own route. These cases drive it through the real Pane page,
// because where the row stands (directly below Text size, among the mirror's rows) is part of it.

beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});
beforeEach(() => {
  clearStatus();
  __resetOperatorCommands();
  __resetPaneFitAvailability();
});

function available(body: { lead: boolean; members: string[] } = { lead: true, members: [] }) {
  return http.get("/fleet/api/pane-fit", () => HttpResponse.json(body));
}

function renderChat(overrides: Partial<ComponentProps<typeof AgentChat>> = {}) {
  const agent = fixtureAgents[0]!;
  const props: ComponentProps<typeof AgentChat> = {
    paneId: agent.paneId,
    agent,
    agents: fixtureAgents,
    shellPanes: [],
    tabs: [],
    text: paneTextWithDraft("recent pane output"),
    onBack: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: "/", element: withHeaderHost(<AgentChat {...props} />) }]);
  return render(<RouterProvider router={router} />);
}

async function openDisplay(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Display settings" }));
}

describe("useFleetPaneFit on the Pane page", () => {
  it("renders the Custom Resize row directly below Text size and sends one measured request", async () => {
    let requestBody: unknown;
    let requestUrl = "";
    let requests = 0;
    server.use(
      available(),
      http.post(/\/fleet\/api\/pane\/[^/]+\/resize(?:\?.*)?$/, async ({ request }) => {
        requests += 1;
        requestUrl = request.url;
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, cols: 80, rows: 31 });
      }),
    );
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1_000,
      height: 10,
      top: 0,
      right: 1_000,
      bottom: 10,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const user = userEvent.setup();
    const { container } = renderChat();
    const scrollport = container.querySelector<HTMLElement>(".overflow-y-auto.overflow-x-hidden");
    expect(scrollport).not.toBeNull();
    Object.defineProperty(scrollport, "clientWidth", { configurable: true, value: 816 });
    if (scrollport !== null) {
      scrollport.style.paddingLeft = "8px";
      scrollport.style.paddingRight = "8px";
    }

    await openDisplay(user);
    const resize = await screen.findByRole("button", { name: "Resize Pane to this view" });
    const textSize = screen.getByText("Text size");
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(textSize.compareDocumentPosition(resize) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    fireEvent.click(resize);
    fireEvent.click(resize);
    await waitFor(() => expect(requests).toBe(1));
    expect(requestBody).toEqual({ cols: 80 });
    expect(new URL(requestUrl).search).toBe("");
    expect(await screen.findByText("Resized to 80 columns × 31 rows.")).toBeInTheDocument();
    rect.mockRestore();
  });

  it("never sends from render, font, viewport, or drawer changes", async () => {
    let requests = 0;
    server.use(
      available(),
      http.post(/\/fleet\/api\/pane\/[^/]+\/resize(?:\?.*)?$/, () => {
        requests += 1;
        return HttpResponse.json({ ok: true, cols: 80, rows: 31 });
      }),
    );
    const user = userEvent.setup();
    renderChat();
    await openDisplay(user);
    await screen.findByRole("button", { name: "Resize Pane to this view" });
    await user.click(screen.getByRole("button", { name: "Increase font size" }));
    window.dispatchEvent(new Event("resize"));
    await user.click(within(screen.getByRole("dialog", { name: "Display" })).getByRole("button", { name: "Close" }));
    await openDisplay(user);
    expect(requests).toBe(0);
  });

  it("fails closed when geometry cannot be measured", async () => {
    let requests = 0;
    server.use(
      available(),
      http.post(/\/fleet\/api\/pane\/[^/]+\/resize(?:\?.*)?$/, () => {
        requests += 1;
        return HttpResponse.json({ ok: true, cols: 80, rows: 31 });
      }),
    );
    const user = userEvent.setup();
    renderChat();
    await openDisplay(user);
    // jsdom lays nothing out: the scrollport is zero wide, which is unmeasurable, not 20 columns.
    fireEvent.click(await screen.findByRole("button", { name: "Resize Pane to this view" }));
    expect(await screen.findByText("The terminal width is not ready to measure.")).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("is absent with no Fleet Gateway, and disabled for a read-only client", async () => {
    const user = userEvent.setup();
    // The shared handlers answer the availability read with Collie's own 404.
    const first = renderChat();
    await openDisplay(user);
    await screen.findByText("Text size");
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
    first.unmount();

    __resetPaneFitAvailability();
    server.use(available());
    renderChat({ device: { enforced: true, device: "viewer", authorized: false } });
    await openDisplay(user);
    expect(await screen.findByRole("button", { name: "Resize Pane to this view" })).toBeDisabled();
  });

  it("shows the row unavailable for a member without a terminal endpoint", async () => {
    const user = userEvent.setup();
    server.use(available({ lead: true, members: ["member-a"] }));
    renderChat({ scope: { host: "member-b" } });
    await openDisplay(user);
    expect(await screen.findByRole("button", { name: "Resize Pane to this view" })).toBeDisabled();
  });

  it("offers Resize among the terminal body's rows and not among Chat's", async () => {
    const user = userEvent.setup();
    server.use(available());
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ chatExperiment: true, paneView: "chat" }));
    renderChat({ agent: { ...fixtureAgents[0]!, hasSession: true } });
    await screen.findByText("what changed today?");
    await openDisplay(user);
    expect(screen.queryByRole("button", { name: "Resize Pane to this view" })).toBeNull();
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
    localStorage.removeItem("collie:dash-prefs:v1");
  });
});

describe("which Hosts can fit", () => {
  it("is Fleet's answer: the lead's own flag, and members with a terminal endpoint", () => {
    const answer = { lead: true, members: ["member-a"] };
    expect(hostCanFit(answer, undefined)).toBe(true);
    expect(hostCanFit(answer, { host: "member-a" })).toBe(true);
    expect(hostCanFit(answer, { host: "member-b" })).toBe(false);
    expect(hostCanFit({ lead: false, members: [] }, undefined)).toBe(false);
  });
});
