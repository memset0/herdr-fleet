import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FleetHostActions } from "./fleet-row-actions";
import { CrewProvider } from "./crew-provider";
import { usePointerMenuGestures } from "./fleet-context-menu";
import { server } from "@/test/setup";
import { __resetOperatorCommands } from "@/lib/operator-config";
import type { ServerSummary } from "@/lib/types";

const { newSpace } = vi.hoisted(() => ({ newSpace: vi.fn() }));
vi.mock("@/hooks/use-spaces", () => ({ useSpaceActions: () => ({ newSpace, creatingSpace: false }) }));
const roster: ServerSummary[] = [
  { id: "example-lead", name: "Example lead", isLead: true, reachable: true, protocol: "ok", lastSeenAt: Date.now() },
  { id: "example-peer", name: "Example peer", isLead: false, reachable: true, protocol: "ok", lastSeenAt: Date.now() },
];
const media = window.matchMedia;
beforeEach(() => { newSpace.mockClear(); __resetOperatorCommands(); });
afterEach(() => { Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: media }); });

function Harness({ id = "example-peer", readOnly = false }: { id?: string; readOnly?: boolean }) {
  usePointerMenuGestures();
  const [open, setOpen] = useState(false);
  return <><button onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>Host</button>
    <FleetHostActions open={open} onClose={() => setOpen(false)} host={{ id, label: "Selected Host" }} readOnly={readOnly} />
  </>;
}
function mount(props: { id?: string; readOnly?: boolean } = {}, servers = roster) {
  return render(<CrewProvider servers={servers} ts={Date.now()} pollMs={3000}><Harness {...props} /></CrewProvider>);
}
function invoke() {
  const down = new MouseEvent("pointerdown", { bubbles: true });
  Object.defineProperty(down, "pointerType", { value: "mouse" });
  act(() => document.dispatchEvent(down));
  fireEvent.contextMenu(screen.getByRole("button", { name: "Host" }), { clientX: 60, clientY: 80 });
}

it("opens a pointer menu then creates on the fixed peer primary scope", async () => {
  mount(); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  expect(await screen.findByRole("dialog", { name: "New space" })).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("Host: Example peer")).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: /create space/i }));
  expect(newSpace).toHaveBeenCalledExactlyOnceWith({ label: undefined, cwd: undefined }, { host: "example-peer" });
});

it("addresses the lead explicitly without inheriting an ambient peer session", async () => {
  mount({ id: "example-lead" }); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  await userEvent.setup().click(await screen.findByRole("button", { name: /create space/i }));
  expect(newSpace).toHaveBeenCalledExactlyOnceWith({ label: undefined, cwd: undefined }, { host: undefined });
});

it("cancels the form without a workspace write", async () => {
  mount(); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  await userEvent.setup().click(await screen.findByRole("button", { name: /close/i }));
  expect(newSpace).not.toHaveBeenCalled();
});

it("shows a read-only refusal instead of creation", () => {
  mount({ readOnly: true }); invoke();
  expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull();
  expect(newSpace).not.toHaveBeenCalled();
});

it("does not offer creation on an unreachable Host", () => {
  mount({}, roster.map((s) => s.isLead ? s : Object.assign({}, s, { reachable: false, lastSeenAt: 0 }))); invoke();
  expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull();
  expect(newSpace).not.toHaveBeenCalled();
});

it("uses the selected Host's capability refusal", async () => {
  server.use(http.get("/api/config", () => HttpResponse.json({ mux: { name: "example", capabilities: { createSpace: false }, notes: { createSpace: "Example create refusal" } } })));
  mount(); invoke();
  await waitFor(() => expect(screen.queryByRole("menuitem", { name: "New space" })).toBeNull());
  expect(newSpace).not.toHaveBeenCalled();
});

it("offers the same Host action in the touch sheet", async () => {
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: (query: string) => ({ matches: query === "(pointer: coarse)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  mount(); invoke();
  expect(screen.queryByRole("menu")).toBeNull();
  await userEvent.setup().click(await screen.findByRole("button", { name: "New space" }));
  expect(await screen.findByText("Host: Example peer")).toBeInTheDocument();
  expect(newSpace).not.toHaveBeenCalled();
});

it("prevents submission after the fixed Host becomes unavailable", async () => {
  const view = mount(); invoke();
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: "New space" }));
  const offline = roster.map((s) => s.isLead ? s : Object.assign({}, s, { reachable: false, lastSeenAt: 0 }));
  view.rerender(<CrewProvider servers={offline} ts={Date.now()} pollMs={3000}><Harness /></CrewProvider>);
  expect(screen.getByRole("button", { name: /create space/i })).toBeDisabled();
  expect(newSpace).not.toHaveBeenCalled();
});
