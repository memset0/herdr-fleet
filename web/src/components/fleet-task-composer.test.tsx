// Terminal-bound task delivery drives Collie's own composer (FORK.toml composer-voice-rank-port, the
// `bindingPane` / `useFleetTaskComposer` port): the native type, verify and submit path, never a
// second sender, and never over an operator's draft or into a bare shell.
import type { ComponentProps } from "react";
import { act, fireEvent, render, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";

import { deliverTodoistTask } from "@/lib/fleet-task-delivery";
import { clearStatus } from "@/lib/status";
import { server } from "@/test/setup";
import { recordReply } from "@/test/handlers";
import { terminalReference } from "../../../fleet/bindings/identity.ts";
import { Composer } from "./composer";

// The send gates on liveness; these cases drive a mocked network and never poll first.
vi.mock("@/lib/liveness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/liveness")>()),
  isLive: () => true,
  useLive: () => true,
}));

// A guarded send is two reply calls (type, then submit-only); recordReply keeps the fake pane's
// input line honest so the verification poll passes.
function replyHandler(onTyped: (text: string) => void, onSubmit?: () => void) {
  return http.post<never, { text: string; submit?: boolean }>(/\/api\/pane\/[^/]+\/reply$/, async ({ request }) => {
    const body = await request.json();
    recordReply(body);
    if (body.submit) onSubmit?.();
    else onTyped(body.text);
    return HttpResponse.json({ ok: true });
  });
}

beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});
beforeEach(() => clearStatus());

function renderComposer(overrides: Partial<ComponentProps<typeof Composer>> = {}) {
  const props: ComponentProps<typeof Composer> = {
    paneId: "w1:p1",
    agent: "claude",
    isShell: false,
    gone: false,
    readOnly: false,
    dialogPresent: false,
    text: "pane output",
    terminalDraft: null,
    rawTerminalDraft: null,
    prefs: { wrap: true, fontSize: 11, draftFontSize: 14, chatFontSize: 14, fontFamily: "system", rawTerminal: false, tapToFocus: true, expandClippedReply: true },
    display: { open: false, onToggle: vi.fn() },
    onSent: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: "/", element: <Composer {...props} /> }]);
  const rendered = render(<RouterProvider router={router} />);
  return { ...props, container: rendered.container };
}

describe("Fleet task delivery through the native composer", () => {
  const bindingPane = { paneId: "w1:p1", bindingId: "herdr:term_example", bindingSession: "default" };
  const terminal = terminalReference(bindingPane)!;

  it("uses the native type, verify, submit path and clears its inserted draft", async () => {
    const typed = vi.fn(), submitted = vi.fn();
    server.use(replyHandler(typed, submitted));
    const props = renderComposer({ bindingPane });
    let sent = false;
    await act(async () => { sent = await deliverTodoistTask(terminal, bindingPane.paneId, "Implement the Todoist description."); });
    expect(sent).toBe(true);
    expect(typed).toHaveBeenCalledExactlyOnceWith("Implement the Todoist description.");
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(within(props.container).getByPlaceholderText(/type a reply/i)).toHaveValue("");
    expect(props.onSent).toHaveBeenCalledTimes(1);
  });

  it("preserves an existing draft and refuses a changed target", async () => {
    const props = renderComposer({ bindingPane });
    const input = within(props.container).getByPlaceholderText(/type a reply/i);
    fireEvent.change(input, { target: { value: "My existing draft" } });
    expect(await deliverTodoistTask(terminal, bindingPane.paneId, "Task content")).toBe(false);
    expect(input).toHaveValue("My existing draft");
    fireEvent.change(input, { target: { value: "" } });
    expect(await deliverTodoistTask(terminal, "w9:p7", "Task content")).toBe(false);
    expect(props.onSent).not.toHaveBeenCalled();
  });

  it("does not submit task prose to a bare shell", async () => {
    const props = renderComposer({ bindingPane, isShell: true, agent: "shell" });
    expect(await deliverTodoistTask(terminal, bindingPane.paneId, "Task content")).toBe(false);
    expect(props.onSent).not.toHaveBeenCalled();
  });
});
