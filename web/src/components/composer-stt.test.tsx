import { useState } from "react";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";

import { clearStatus, useStatus } from "@/lib/status";
import type { BridgeConfig } from "@/lib/types";
import { __resetHandsFree, setHandsFreeEnabled } from "@/lib/stt";
import { __resetOperatorCommands } from "@/lib/operator-config";
import { server } from "@/test/setup";
import { sendAnswer, sendHandler } from "@/test/handlers";
import {
  FakeMediaRecorder,
  installFakeMediaRecorder,
  uninstallFakeMediaRecorder,
} from "@/test/media-recorder";
import { FleetCommandsProvider, useFleetCommands } from "./fleet-commands";
import { derivePaneRoster } from "../../../fleet/ui/pane-roster.ts";
import { Composer } from "./composer";

// M46 spec 11 turns every send off for a pane the bridge has not answered lately (lib/liveness.ts).
// These suites drive sends against a mocked network and never poll first, so they pin the pane live;
// the gating itself is covered by liveness.test.ts and the *-offline suites.
vi.mock("@/lib/liveness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/liveness")>()),
  isLive: () => true,
  useLive: () => true,
}));

// The composer's microphone (ADR 0029). Two gates decide whether it is drawn at all — the bridge
// publishing a provider, and this browser being able to record — and jsdom fails the second one by
// default, so every case that wants a button installs the fake recorder first.
//
// The send path is asserted AT THE NETWORK, never with a spy on `sendGuardedReply`: hands-free is
// specified as "through the same guarded path a typed reply takes", and the only evidence that
// distinguishes that from a shortcut is the guard's own two-call shape on the wire — type with
// `submit:false`, verify, then submit.

const CONFIG_WITH_STT: BridgeConfig = {
  push: false,
  vapidPublicKey: "",
  stt: { provider: "openai-compatible", available: true },
};

/** `/api/config` answering with a given stt block (or none), counting the reads. */
function configHandler(config: BridgeConfig, onRead?: () => void) {
  return http.get("/api/config", () => {
    onRead?.();
    return HttpResponse.json(config);
  });
}

/** The transcription endpoint, answering with one transcript and counting the posts. */
function sttHandler(text: string, onPost?: (contentType: string | null) => void) {
  return http.post("/api/stt", ({ request }) => {
    onPost?.(request.headers.get("content-type"));
    return HttpResponse.json({ ok: true, text });
  });
}

/** The transcription endpoint refusing, exactly as bridge/stt/http.ts does. */
function sttRefusal(status: number, error: string) {
  return http.post("/api/stt", () => HttpResponse.json({ ok: false, error }, { status }));
}

/** The fake bridge's Send Protocol, calling back with each request's body (M56 spec 06: one request per text). */
function replyHandler(onBody: (body: { text: string; mode: string }) => void) {
  return sendHandler((request) => {
    onBody({ text: request.text, mode: request.mode });
    return sendAnswer(request.id, "sent");
  });
}

function StatusSentinel() {
  const status = useStatus();
  return <div data-testid="status">{status?.text ?? ""}</div>;
}

function baseProps(
  overrides: Partial<ComponentProps<typeof Composer>>,
): ComponentProps<typeof Composer> {
  return {
    paneId: "w1:p1",
    agent: "claude",
    isShell: false,
    gone: false,
    readOnly: false,
    surface: { revision: 1, turn: "idle", modal: "none", composer: "empty" },
    text: "pane output",
    terminalDraft: null,
    rawTerminalDraft: null,
    prefs: { wrap: true, fontSize: 11, draftFontSize: 14, chatFontSize: 14, fontFamily: "system", rawTerminal: false, tapToFocus: true, expandClippedReply: true },
    display: { open: false, onToggle: vi.fn() },
    onSent: vi.fn(),
    ...overrides,
  };
}

function renderComposer(overrides: Partial<ComponentProps<typeof Composer>> = {}) {
  const props = baseProps(overrides);
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <StatusSentinel />
          <Composer {...props} />
        </>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return props;
}

/** Same composer, plus a control that changes the pane it addresses IN PLACE. */
function renderSwitchablePane() {
  function Harness() {
    const [paneId, setPaneId] = useState("w1:p1");
    return (
      <>
        <StatusSentinel />
        <button type="button" onClick={() => setPaneId("w2:p1")}>
          switch pane
        </button>
        <Composer {...baseProps({ paneId })} />
      </>
    );
  }
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
  render(<RouterProvider router={router} />);
}

/** Tap the mic, wait for the recorder the tap created. */
async function startRecording(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
  await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
  return FakeMediaRecorder.instances[0]!;
}

beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});
beforeEach(() => {
  clearStatus();
  __resetHandsFree();
  // The config store caches one successful read for the life of a page; each case is a page.
  __resetOperatorCommands();
  installFakeMediaRecorder();
});
afterEach(() => {
  uninstallFakeMediaRecorder();
  __resetHandsFree();
  __resetOperatorCommands();
});

describe("Composer — the record button is drawn only when there is a microphone", () => {
  it("renders no microphone when the bridge publishes no stt capability", async () => {
    let reads = 0;
    server.use(configHandler({ push: false, vapidPublicKey: "" }, () => (reads += 1)));
    renderComposer();
    await waitFor(() => expect(reads).toBe(1));
    expect(screen.queryByRole("button", { name: /record a voice message/i })).toBeNull();
    // …and the field reserves no strip at all, so a collie without one loses no width to it. It
    // was `pr-11` while the attach button stood in the field's corner; the button is the field's
    // sibling on the box's one row now (ADR 0057) and nothing inside the field reserves width.
    expect(screen.getByPlaceholderText(/type a reply/i).className).not.toMatch(/(?:^|\s)pr-/);
  });

  it("renders no microphone in an insecure context, even with a provider configured", async () => {
    // The guard #115 forgot: over plain HTTP `navigator.mediaDevices` is simply absent, so a button
    // would render and do nothing. Nothing on the phone fixes that, so it is hidden, not disabled.
    uninstallFakeMediaRecorder();
    let reads = 0;
    server.use(configHandler(CONFIG_WITH_STT, () => (reads += 1)));
    renderComposer();
    await waitFor(() => expect(reads).toBe(1));
    expect(screen.queryByRole("button", { name: /record a voice message/i })).toBeNull();
  });

  it("renders a disabled microphone wearing the bridge's reason when the provider can't serve", async () => {
    server.use(
      configHandler({
        push: false,
        vapidPublicKey: "",
        stt: { provider: "codex", available: false, reason: "codex is not signed in" },
      }),
    );
    renderComposer();
    const button = await screen.findByRole("button", { name: /codex is not signed in/i });
    expect(button).toBeDisabled();
  });
});

// The record control and Send are TWO controls, and which one you get is not decided by what the
// draft holds. They shared one slot for one round — the microphone while the box was empty, Send the
// moment it wasn't — which bought the field a button's width and cost the operator every dictation
// after the first: the transcript filled the box and the way back to the microphone was gone.
describe("Composer — the record control stands beside Send, not instead of it", () => {
  it("draws both on an empty box, and the field keeps the padding it always had", async () => {
    let reads = 0;
    server.use(configHandler(CONFIG_WITH_STT, () => (reads += 1)));
    renderComposer();
    await waitFor(() => expect(reads).toBe(1));

    expect(await screen.findByRole("button", { name: /record a voice message/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument();
    // Same field as a collie with no microphone at all: it pays nothing for the feature, and
    // since the buttons became the field's siblings it reserves no horizontal strip for anything.
    expect(screen.getByPlaceholderText(/type a reply/i).className).not.toMatch(/(?:^|\s)pr-/);
  });

  // Collie 1.18's left-hand layout mirrors the box in CSS and keeps the DOM order. The record
  // control sits between Attach and Send in that order, so mirrored it stands directly beside Send
  // on the field's side: Send, record, Attach, field (fleet-composer-voice).
  it("mirrors with the left-hand layout and keeps record beside Send", async () => {
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer({ hand: "left" });
    await screen.findByRole("button", { name: /record a voice message/i });
    const box = document.querySelector<HTMLElement>('[data-slot="composer-box"]')!;
    expect(box.className).toMatch(/(?:^|\s)flex-row-reverse(?=\s|$)/);
    const order = [...box.querySelectorAll("textarea, button")]
      .map((el) => (el.tagName === "TEXTAREA" ? "field" : el.getAttribute("aria-label")))
      .filter((name): name is string => name !== null && ["field", "Attach file", "Record a voice message", "Send"].includes(name));
    expect(order).toEqual(["field", "Attach file", "Record a voice message", "Send"]);
  });

  it("keeps both once there is a draft, so a clause can be dictated into what you typed", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await screen.findByRole("button", { name: /record a voice message/i });

    await user.type(box, "x");
    // The one thing the old shared slot could not do.
    expect(await screen.findByRole("button", { name: /record a voice message/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  // ADR 0060: a chip is something to send. DOWNSTREAM PORT (FORK.toml composer-voice-rank-port):
  // the record control is its own control, so a box holding only chips keeps BOTH, and both accept.
  it("a box holding only chips keeps both controls, and both accept", async () => {
    server.use(
      configHandler(CONFIG_WITH_STT),
      http.post(/\/api\/pane\/[^/]+\/upload$/, () => HttpResponse.json({ ok: true, path: "/a.png" })),
    );
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await screen.findByRole("button", { name: /record a voice message/i });

    // SAFETY: `getByTestId` throws when the element is absent, and this id is on an `<input>`.
    const photos = screen.getByTestId("attach-photos") as HTMLInputElement;
    fireEvent.change(photos, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    await waitFor(() => expect(box).toHaveValue("[Image #1] "));
    fireEvent.change(box, { target: { value: "" } });

    expect(screen.getByRole("button", { name: /record a voice message/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  it("whitespace alone is not text — Send refuses it, and the microphone still accepts", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await screen.findByRole("button", { name: /record a voice message/i });

    await user.type(box, "   ");
    // `send` refuses a blank value, and the button says so rather than accepting a tap that does nothing.
    expect(await screen.findByRole("button", { name: /record a voice message/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("keeps one control for the whole clip, so the same button starts and stops it", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("done"));
    renderComposer();
    const recorder = await startRecording(user);
    expect(await screen.findByRole("button", { name: /stop recording/i })).toBeInTheDocument();

    act(() => recorder.finish());
    await waitFor(() => expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("done"));
    // And it is a microphone again straight away, rather than waiting for the box to be emptied.
    expect(await screen.findByRole("button", { name: /record a voice message/i })).toBeEnabled();
  });

  it("dictates in turns: a second clip joins the draft the first one wrote", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("first"));
    renderComposer();

    const one = await startRecording(user);
    act(() => one.finish());
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await waitFor(() => expect(box).toHaveValue("first"));

    // The draft is no longer empty, and that is exactly the state the old slot had no microphone in.
    server.use(sttHandler("second"));
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(2));
    act(() => FakeMediaRecorder.instances[1]!.finish());

    await waitFor(() => expect(box).toHaveValue("first second"));
  });
});

// Both refusals below were structural while the two controls shared one slot: there was no Send
// during a clip, and none on an empty box either. Separating the controls removes that guarantee, so
// each becomes something the control has to say for itself.
describe("Composer — what Send refuses now that it is always drawn", () => {
  it("refuses a blank draft, and accepts on the first real character", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);

    expect(await screen.findByRole("button", { name: /^send$/i })).toBeDisabled();
    // Whitespace is not text: `send` trims before it decides, and so does the button.
    await user.type(box, "   ");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();

    await user.type(box, "x");
    await waitFor(() => expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled());
  });

  it("refuses while a clip is live, and accepts again once the transcript lands", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("spoken"));
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await user.type(box, "typed by hand");

    const recorder = await startRecording(user);
    // A draft with text in it would otherwise be sendable — the live clip is what forbids it.
    await waitFor(() => expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled());

    act(() => recorder.finish());
    await waitFor(() => expect(box).toHaveValue("typed by hand spoken"));
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  it("refuses a live clip on the keyboard too — a disabled button disables no binding", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("spoken"),
      replyHandler(() => (posts += 1)),
    );
    renderComposer();
    const box = await screen.findByPlaceholderText(/type a reply/i);
    await user.type(box, "typed by hand");
    await startRecording(user);

    await user.type(box, "{Control>}{Enter}{/Control}");
    // Nothing left for the pane, and the draft is still the operator's.
    expect(posts).toBe(0);
    expect(box).toHaveValue("typed by hand");
  });
});

describe("Composer — a finished clip", () => {
  it("lands in the draft at the caret", async () => {
    const user = userEvent.setup();
    let posted: string | null = null;
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("there", (contentType) => (posted = contentType)),
    );
    renderComposer();
    // The microphone is the primary button only while the box is EMPTY, so recording starts first
    // and the typing happens DURING the clip — which is the one way a transcript can still meet a
    // non-empty draft, and the reason the caret insert below is not dead code.
    const recorder = await startRecording(user);
    expect(await screen.findByRole("group", { name: /voice input/i })).toBeInTheDocument();
    const box = screen.getByPlaceholderText(/type a reply/i);
    // The takeover makes the box inert, so a person can no longer type during a clip; a draft can
    // still appear under it (a restored or terminal-side one), which is the case this pins.
    fireEvent.change(box, { target: { value: "hello world" } });
    // Caret between the two words — dictating a clause into the middle of a sentence is the point.
    act(() => {
      if (box instanceof HTMLTextAreaElement) box.setSelectionRange(5, 5);
    });
    act(() => recorder.finish());

    await waitFor(() => expect(box).toHaveValue("hello there world"));
    // One clip, one POST, and the container names itself so the bridge can pick a demuxer.
    expect(posted).toMatch(/^audio\//);
    // The takeover is gone and the composer is back.
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
  });

  it("is discarded — and never uploaded — when the pane changes mid-recording", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("never sent", () => (posts += 1)),
    );
    renderSwitchablePane();
    const recorder = await startRecording(user);
    expect(await screen.findByRole("group", { name: /voice input/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "switch pane" }));
    // Whatever the browser delivers after the discard belongs to an operation that no longer exists.
    act(() => recorder.finish());

    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
    expect(posts).toBe(0);
  });
});

describe("Composer — hands-free", () => {
  it("routes the transcript through the Send Protocol when the draft is empty", async () => {
    const user = userEvent.setup();
    setHandsFreeEnabled(true);
    const bodies: { text: string; mode: string }[] = [];
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("ship it"),
      ...replyHandler((body) => bodies.push(body)),
    );
    renderComposer();
    const recorder = await startRecording(user);
    act(() => recorder.finish());

    // The same one Send Protocol request the Send button makes: the bridge's guard, never around it.
    await waitFor(() => expect(bodies).toEqual([{ text: "ship it", mode: "send" }]));
    expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("");
  });

  it("falls back to inserting when the draft already holds text", async () => {
    const user = userEvent.setup();
    setHandsFreeEnabled(true);
    let replies = 0;
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("and this"),
      ...replyHandler(() => (replies += 1)),
    );
    renderComposer();
    // Typed DURING the clip — see the caret case above for why that is the only way here.
    const recorder = await startRecording(user);
    const box = screen.getByPlaceholderText(/type a reply/i);
    fireEvent.change(box, { target: { value: "typed by hand" } });
    act(() => recorder.finish());

    // Merging dictated words onto typed ones and sending the result would send a sentence nobody
    // has read, so the two are combined in the box and the operator still presses Send.
    await waitFor(() => expect(box).toHaveValue("typed by hand and this"));
    expect(replies).toBe(0);
  });
});

describe("Composer — a refused transcription", () => {
  it.each([
    [429, "two recordings are already being transcribed", /busy/i],
    [413, "the recording is larger than 8 MiB", /too long/i],
    [504, "the transcriber timed out", /didn't answer in time/i],
  ])("says what %i means, in the composer's words", async (status, serverError, expected) => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttRefusal(status, serverError));
    renderComposer();
    const recorder = await startRecording(user);
    act(() => recorder.finish());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent(expected));
    // Nothing reached the draft, and the audio is not held for a retry — the takeover is gone, so
    // there is no clip left to stop or discard.
    expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("");
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
  });
});

// THE VOICE TAKEOVER (design 3.3). A tap on the mic covers the whole chrome block without adding a
// pixel to it. jsdom has no layout, so the zero-shift property is pinned by its CAUSES: the takeover
// is an `absolute inset-0` SIBLING of the composer (inside agent-chat's `relative` chrome block, which
// this suite does not mount), and the real composer stays in flow beneath it, invisible and inert,
// the same nodes, never remounted. The measured proof is the browser case in
// web/e2e/voice-takeover.spec.ts.
describe("Composer — the voice takeover", () => {
  function block(): HTMLElement {
    const box = document.querySelector('[data-slot="composer-box"]');
    const el = box?.closest("div.relative.bg-chrome");
    if (!(el instanceof HTMLElement)) throw new Error("no composer block");
    return el;
  }

  it("covers the block with an absolute sibling, and leaves the real composer in flow, inert and unseen", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    await screen.findByRole("button", { name: /record a voice message/i });
    const blockBefore = block();
    const boxBefore = document.querySelector('[data-slot="composer-box"]');
    const fieldBefore = screen.getByPlaceholderText(/type a reply/i);
    expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull();
    expect(blockBefore).not.toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: /record a voice message/i }));
    const region = await screen.findByRole("group", { name: /voice input/i });

    // The takeover is positioned over the whole box, and takes no place in the flow.
    expect(region.className).toMatch(/\babsolute\b/);
    expect(region.className).toMatch(/\binset-0\b/);
    expect(region.parentElement).toBe(block().parentElement);
    // The composer stays laid out: the same nodes, not remounted, hidden and inert in place.
    expect(block()).toBe(blockBefore);
    expect(document.querySelector('[data-slot="composer-box"]')).toBe(boxBefore);
    expect(screen.getByPlaceholderText(/type a reply/i)).toBe(fieldBefore);
    expect(block()).toHaveAttribute("inert");
    expect(block().className).toContain("invisible");
    expect(block().className).not.toMatch(/\bhidden\b|\bcontents\b/);
  });

  it("gives the block back with the same nodes when the clip is thrown away", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    const fieldBefore = screen.getByPlaceholderText(/type a reply/i);
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    await user.click(await screen.findByRole("button", { name: /discard recording/i }));
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
    expect(screen.getByPlaceholderText(/type a reply/i)).toBe(fieldBefore);
    expect(block()).not.toHaveAttribute("inert");
    expect(block().className).not.toContain("invisible");
  });

  it("wears the block's own bottom padding, with the keyboard up or down", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer({ composing: true });
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    const region = await screen.findByRole("group", { name: /voice input/i });
    expect(block().className).toMatch(/\bpb-2\b/);
    expect(region.className).toMatch(/\bpb-2\b/);
  });

  it("OK finishes and transcribes, and the transcript lands in the box", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("hello"));
    renderComposer();
    const recorder = await startRecording(user);
    act(() => recorder.emit(1024));
    await user.click(await screen.findByRole("button", { name: /finish and transcribe/i }));
    expect(recorder.state).toBe("inactive");
    await waitFor(() => expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("hello"));
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
  });

  it("cancels an in-flight transcription from the bin: the request is aborted and the answer dropped", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let aborted = false;
    let started = false;
    server.use(
      configHandler(CONFIG_WITH_STT),
      http.post("/api/stt", async ({ request }) => {
        started = true;
        request.signal.addEventListener("abort", () => {
          aborted = true;
        });
        await gate;
        return HttpResponse.json({ ok: true, text: "never lands" });
      }),
    );
    renderComposer();
    const recorder = await startRecording(user);
    act(() => recorder.finish());
    await waitFor(() => expect(started).toBe(true));
    const ok = await screen.findByRole("button", { name: /finish and transcribe/i });
    expect(ok).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/transcribing/i);

    await user.click(screen.getByRole("button", { name: /discard recording/i }));
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
    await waitFor(() => expect(aborted).toBe(true));
    release();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("");
    expect(screen.getByTestId("status")).toHaveTextContent("");
  });

  it("discards on Escape without uploading", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("x", () => (posts += 1)));
    renderComposer();
    const recorder = await startRecording(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: /voice input/i })).toBeNull());
    act(() => recorder.finish());
    expect(posts).toBe(0);
  });

  it("moves focus to OK on open and back to the round button on close", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /finish and transcribe/i })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: /discard recording/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /record a voice message/i })).toHaveFocus());
  });

  it("says OK will send when hands-free will send the transcript", async () => {
    const user = userEvent.setup();
    setHandsFreeEnabled(true);
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    expect(await screen.findByRole("button", { name: /transcribe and send/i })).toBeInTheDocument();
  });

  it("mirrors for the left hand: OK takes the mic's side", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer({ hand: "left" });
    await user.click(await screen.findByRole("button", { name: /record a voice message/i }));
    const row = (await screen.findByRole("group", { name: /voice input/i })).querySelector('[data-slot="voice-takeover-row"]');
    expect(row?.className).toContain("flex-row-reverse");
    expect(document.querySelector('[data-slot="composer-box"]')?.className).toContain("flex-row-reverse");
  });

  it("the armed strip is gone: no Stop link and no 'Recording m:ss' line", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderComposer();
    await startRecording(user);
    await screen.findByRole("group", { name: /voice input/i });
    expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();
    expect(screen.queryByText(/^recording /i)).toBeNull();
  });
});

describe("Composer — the microphone from the keyboard", () => {
  /**
   * The composer inside the command layer, plus a button that invokes one command through the one
   * dispatcher. The wiring is what this exercises: the decision itself is proved in
   * `fleet/ui/mic-commands.test.ts` without a browser, and this asserts that the recorder the
   * composer owns is actually reached and that a refusal reaches the status channel.
   */
  function renderWithCommands(command: "start-mic-recording" | "stop-mic-recording" | "toggle-mic-recording") {
    function Invoke() {
      const commands = useFleetCommands();
      return (
        <button type="button" onClick={() => commands?.invoke(command, "ui")}>
          run it
        </button>
      );
    }
    const props = baseProps({});
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <FleetCommandsProvider
            adapters={{}}
            available={() => true}
            roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
            onOpenPane={() => {}}
          >
            <StatusSentinel />
            <Invoke />
            <Composer {...props} />
          </FleetCommandsProvider>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
  }

  const run = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: "run it" }));

  it("toggles the real recorder the composer owns", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT), sttHandler("from the keyboard"), replyHandler(() => {}));
    renderWithCommands("toggle-mic-recording");
    await screen.findByRole("button", { name: /record a voice message/i });

    await run(user);
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    // Toggling again stops it, which is the same call the button's second tap makes.
    await run(user);
    await waitFor(() => expect(FakeMediaRecorder.instances[0]!.state).toBe("inactive"));
  });

  it("refuses to stop a microphone that is not recording, and changes nothing", async () => {
    const user = userEvent.setup();
    server.use(configHandler(CONFIG_WITH_STT));
    renderWithCommands("stop-mic-recording");
    await screen.findByRole("button", { name: /record a voice message/i });

    await run(user);
    expect(await screen.findByText(/not recording/i)).toBeTruthy();
    // No recorder was created: a refusal is a statement about the world, not a half-attempt.
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("wears the bridge's own reason when the provider is the thing that is missing", async () => {
    const user = userEvent.setup();
    // The operator's next move is on the host, so the host's sentence is the one shown — our generic
    // one would hide the only fact that tells them so.
    server.use(
      configHandler({
        push: false,
        vapidPublicKey: "",
        stt: { provider: "openai-compatible", available: false, reason: "no API key on the host" },
      }),
    );
    renderWithCommands("toggle-mic-recording");
    await run(user);
    expect(await screen.findByText(/no API key on the host/i)).toBeTruthy();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
