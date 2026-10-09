import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FleetHostActions } from "./fleet-row-actions";
import { CrewProvider } from "./crew-provider";
import { usePointerMenuGestures } from "./fleet-context-menu";
import { server } from "@/test/setup";
import { __resetOperatorCommands } from "@/lib/operator-config";
import type { ServerSummary } from "@/lib/types";

const roster: ServerSummary[] = [
  { id: "example-lead", name: "Example lead", isLead: true, reachable: true, protocol: "ok", lastSeenAt: Date.now() },
  { id: "example-peer", name: "Example peer", isLead: false, reachable: true, protocol: "ok", lastSeenAt: Date.now() },
];
const media = window.matchMedia;
beforeEach(() => { __resetOperatorCommands(); });
afterEach(() => { Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: media }); });

function Harness({ id = "example-peer", readOnly = false }: { id?: string; readOnly?: boolean }) {
  usePointerMenuGestures();
  const [open, setOpen] = useState(false);
  return <><button onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>Host</button>
    <FleetHostActions open={open} onClose={() => setOpen(false)} host={{ id, label: "Selected Host" }} readOnly={readOnly} />
  </>;
}
// Every write the action could make is a request, so a page that opens with no request proves none.
const writes: string[] = [];
beforeEach(() => {
  writes.length = 0;
  server.events.on("request:start", ({ request }) => { if (request.method !== "GET") writes.push(request.url); });
});
afterEach(() => { server.events.removeAllListeners(); });

function mount(props: { id?: string; readOnly?: boolean } = {}, servers = roster) {
  const tree = (list: ServerSummary[]) => <CrewProvider servers={list} ts={Date.now()} pollMs={3000}><Harness {...props} /></CrewProvider>;
  const router = createMemoryRouter([
    { path: "/", element: tree(servers) },
    { path: "/new", element: <p>New page</p> },
  ], { initialEntries: ["/?s=ambient"] });
  render(<RouterProvider router={router} />);
  return router;
}
const where = (router: ReturnType<typeof mount>) => router.state.location.pathname + router.state.location.search;
function invoke() {
  const down = new MouseEvent("pointerdown", { bubbles: true });
  Object.defineProperty(down, "pointerType", { value: "mouse" });
  act(() => document.dispatchEvent(down));
  fireEvent.contextMenu(screen.getByRole("button", { name: "Host" }), { clientX: 60, clientY: 80 });
}

it("opens a pointer menu then the New page on that peer, in its primary session", async () => {
  const router = mount(); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  await screen.findByText("New page");
  expect(where(router)).toBe("/new?machine=example-peer");
  expect(writes).toEqual([]);
});

it("names the lead by its own id without inheriting the route's session", async () => {
  const router = mount({ id: "example-lead" }); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  await screen.findByText("New page");
  expect(where(router)).toBe("/new?machine=example-lead");
});

it("shows a read-only refusal instead of creation", () => {
  const router = mount({ readOnly: true }); invoke();
  expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull();
  expect(where(router)).toBe("/?s=ambient");
});

it("does not offer creation on an unreachable Host", () => {
  const router = mount({}, roster.map((s) => s.isLead ? s : Object.assign({}, s, { reachable: false, lastSeenAt: 0 }))); invoke();
  expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull();
  expect(where(router)).toBe("/?s=ambient");
});

it("uses the selected Host's capability refusal", async () => {
  server.use(http.get("/api/config", () => HttpResponse.json({ mux: { name: "example", capabilities: { createSpace: false }, notes: { createSpace: "Example create refusal" } } })));
  mount(); invoke();
  await waitFor(() => expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull());
  expect(writes).toEqual([]);
});

it("offers the same Host action in the touch sheet", async () => {
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: (query: string) => ({ matches: query === "(pointer: coarse)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  const router = mount(); invoke();
  expect(screen.queryByRole("menu")).toBeNull();
  await userEvent.setup().click(await screen.findByRole("button", { name: "New space" }));
  await screen.findByText("New page");
  expect(where(router)).toBe("/new?machine=example-peer");
});
