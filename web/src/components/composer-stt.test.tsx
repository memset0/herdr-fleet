import { useState } from "react";
import type { ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";

import { clearStatus, useStatus } from "@/lib/status";
import type { BridgeConfig } from "@/lib/types";
import { __resetHandsFree, setHandsFreeEnabled } from "@/lib/stt";
import { __resetOperatorCommands } from "@/lib/operator-config";
import { server } from "@/test/setup";
import { recordReply } from "@/test/handlers";
import {
  FakeMediaRecorder,
  installFakeMediaRecorder,
  uninstallFakeMediaRecorder,
} from "@/test/media-recorder";
import { FleetCommandsProvider, useFleetCommands } from "./fleet-commands";
import { derivePaneRoster } from "../../../fleet/ui/pane-roster.ts";
import { Composer } from "./composer";

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

// A guarded send is TWO reply calls (type, then submit-only). Keeping the fake pane's input line
// honest via recordReply is what lets the guard's verification poll pass.
function replyHandler(onBody: (body: { text: string; submit?: boolean }) => void) {
  return http.post<never, { text: string; submit?: boolean }>(
    /\/api\/pane\/[^/]+\/reply$/,
    async ({ request }) => {
      const body = await request.json();
      recordReply(body);
      onBody(body);
      return HttpResponse.json({ ok: true });
    },
  );
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
    dialogPresent: false,
    text: "pane output",
    terminalDraft: null,
    rawTerminalDraft: null,
    prefs: { wrap: true, fontSize: 11, draftFontSize: 14, fontFamily: "system", rawTerminal: false, tapToFocus: true },
    setWrap: vi.fn(),
    stepFontSize: vi.fn(),
    setRawTerminal: vi.fn(),
    setTapToFocus: vi.fn(),
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
    // …and the field keeps the narrow padding, so a collie without one loses no width to it.
    expect(screen.getByPlaceholderText(/type a reply/i).className).toContain("pr-11");
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
    // The second control sits BESIDE the field, so the field's own reserved strip is the attach
    // button's alone — the same one a collie with no microphone at all draws.
    expect(screen.getByPlaceholderText(/type a reply/i).className).toContain("pr-11");
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
    expect(await screen.findByText(/recording/i)).toBeInTheDocument();
    const box = screen.getByPlaceholderText(/type a reply/i);
    await user.type(box, "hello world");
    // Caret between the two words — dictating a clause into the middle of a sentence is the point.
    act(() => {
      if (box instanceof HTMLTextAreaElement) box.setSelectionRange(5, 5);
    });
    act(() => recorder.finish());

    await waitFor(() => expect(box).toHaveValue("hello there world"));
    // One clip, one POST, and the container names itself so the bridge can pick a demuxer.
    expect(posted).toMatch(/^audio\//);
    // The armed strip is gone and the microphone is idle again. AWAITED, because the strip now
    // leaves through `Collapse` (DESIGN.md §1) — which holds its child for the 240ms exit so the box
    // slides shut on the words rather than on nothing, and only unmounts at the end. Asserting on
    // the tick after the transcript would be asserting that the strip is torn out of the flow, which
    // is the fault the wrapper exists to stop; composer.test.tsx pins the wrapper structurally.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /discard recording/i })).toBeNull(),
    );
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
    expect(await screen.findByText(/recording/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "switch pane" }));
    // Whatever the browser delivers after the discard belongs to an operation that no longer exists.
    act(() => recorder.finish());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /discard recording/i })).toBeNull(),
    );
    expect(posts).toBe(0);
  });
});

describe("Composer — hands-free", () => {
  it("routes the transcript through the guarded send path when the draft is empty", async () => {
    const user = userEvent.setup();
    setHandsFreeEnabled(true);
    const bodies: { text: string; submit?: boolean }[] = [];
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("ship it"),
      replyHandler((body) => bodies.push(body)),
    );
    renderComposer();
    const recorder = await startRecording(user);
    act(() => recorder.finish());

    // The guard's own two-call shape: type without submitting, verify, then submit. A shortcut past
    // it would show one call, or a first call carrying submit.
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(2));
    expect(bodies[0]).toMatchObject({ text: "ship it", submit: false });
    expect(bodies.at(-1)?.submit).toBe(true);
    expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("");
  });

  it("falls back to inserting when the draft already holds text", async () => {
    const user = userEvent.setup();
    setHandsFreeEnabled(true);
    let replies = 0;
    server.use(
      configHandler(CONFIG_WITH_STT),
      sttHandler("and this"),
      replyHandler(() => (replies += 1)),
    );
    renderComposer();
    // Typed DURING the clip — see the caret case above for why that is the only way here.
    const recorder = await startRecording(user);
    const box = screen.getByPlaceholderText(/type a reply/i);
    await user.type(box, "typed by hand");
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
    // Nothing reached the draft, and the audio is not held for a retry — the strip is gone, so
    // there is no clip left to stop or discard.
    expect(screen.getByPlaceholderText(/type a reply/i)).toHaveValue("");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /discard recording/i })).toBeNull(),
    );
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
