import { describe, expect, it } from "vitest";

import type { SttHostStatus, WhistleStatus } from "@/lib/types";
import {
  guidedPlan,
  askFor,
  codexStateOf,
  hostOptionOf,
  modelChip,
  namedSetup,
  oldWhistleWrapper,
  phoneChoiceInForce,
  setupSteps,
  shortVersion,
  statusFacts,
  tierOf,
  voiceStatus,
  type SetupInput,
  type VoiceStatusInput,
} from "./voice";

// The pure rules behind Settings → Voice (lib/voice.ts). The pages' words are pinned in
// components/speech-control.test.tsx; here only the decisions.

const READY: WhistleStatus = { state: "ready", bytes: 1, hostEngine: true, hostTaken: false, sha256: "a".repeat(64) };
const COPY = { sha256: "a".repeat(64), bytes: 1 };

describe("the host's options", () => {
  it.each([
    ["whistle", "whistle"],
    ["local-cli", "command"],
    ["openai-compatible", "service"],
    ["codex", "chatgpt"],
    ["none", "off"],
    ["something-new", null],
  ])("%s is %s", (provider, option) => {
    expect(hostOptionOf(provider)).toBe(option);
  });

  it("lists a command under the machines it stays on, and Off under neither tier", () => {
    expect(tierOf("command")).toBe("stays");
    expect(tierOf("service")).toBe("leaves");
    expect(tierOf("chatgpt")).toBe("leaves");
    expect(tierOf("off")).toBeNull();
  });
});

describe("askFor: what a tap asks before anything is sent", () => {
  it("ChatGPT always asks for consent, even from another option that leaves the host", () => {
    expect(askFor("off", "codex")).toBe("consent");
    expect(askFor("service", "codex")).toBe("consent");
  });

  it("asks for the host-wide confirm when audio would travel further", () => {
    expect(askFor("off", "whistle")).toBe("confirm");
    expect(askFor(null, "whistle")).toBe("confirm");
  });

  it("sends a step back toward the host on the tap", () => {
    expect(askFor("whistle", "off")).toBe("none");
    expect(askFor("chatgpt", "whistle")).toBe("none");
    expect(askFor("service", "off")).toBe("none");
  });
});

describe("voiceStatus: what happens when the mic is pressed", () => {
  const base: VoiceStatusInput = {
    engine: "host",
    local: null,
    block: null,
    provider: "whistle",
    available: true,
    whistle: READY,
    recording: true,
  };

  it("no recording in this browser is broken, whatever else is set", () => {
    expect(voiceStatus({ ...base, recording: false })).toMatchObject({ kind: "no-recording", state: "broken" });
  });

  it("this phone with its copy works on the phone", () => {
    expect(voiceStatus({ ...base, engine: "phone", local: COPY })).toEqual({ kind: "phone", state: "works", reach: "phone" });
  });

  it("this phone without its copy is paused, never the host", () => {
    expect(voiceStatus({ ...base, engine: "phone" })).toEqual({ kind: "paused", state: "paused", reach: null, action: "restore" });
    expect(voiceStatus({ ...base, engine: "phone", whistle: null })).toMatchObject({ kind: "paused", action: null });
  });

  it("a browser that cannot run the engine reads as the host", () => {
    expect(phoneChoiceInForce("phone", "insecure")).toBe("host");
    expect(phoneChoiceInForce("phone", "host-not-ready")).toBe("phone");
    expect(voiceStatus({ ...base, engine: "phone", block: "insecure" })).toMatchObject({ kind: "host", state: "works" });
  });

  it("the host with no option needs setup; an option that does not answer is broken, with Fix", () => {
    expect(voiceStatus({ ...base, provider: "none", available: false })).toMatchObject({ kind: "setup" });
    expect(voiceStatus({ ...base, provider: "codex", available: false })).toMatchObject({
      kind: "host",
      state: "broken",
      option: "chatgpt",
      reach: "chatgpt",
      action: "fix",
    });
  });
});

describe("modelChip", () => {
  it.each([
    [{ whistle: READY, local: null, phoneInForce: true }, "gone"],
    [{ whistle: READY, local: { ...COPY, sha256: "b".repeat(64) }, phoneInForce: true }, "update"],
    [{ whistle: READY, local: COPY, phoneInForce: false }, "both"],
    [{ whistle: READY, local: null, phoneInForce: false }, "host"],
    [{ whistle: null, local: COPY, phoneInForce: false }, "phone"],
    [{ whistle: { ...READY, state: "downloading" as const }, local: null, phoneInForce: false }, "downloading"],
    [{ whistle: { ...READY, state: "failed" as const }, local: null, phoneInForce: false }, "failed"],
    [{ whistle: null, local: null, phoneInForce: false }, "absent"],
  ])("%j is %s", (input, chip) => {
    expect(modelChip(input)).toBe(chip);
  });
});

describe("statusFacts: the five facts, and what Ready rests on", () => {
  const OPEN = { whistle: { ok: true }, codex: { ok: true }, off: { ok: true } } as const;
  const host = (over: Partial<SttHostStatus>): SttHostStatus => ({ provider: "whistle", available: true, configuredBy: "file", switchable: OPEN, ...over });
  const of = (provider: string, available: boolean, h: SttHostStatus | null, whistle: WhistleStatus | null = READY) =>
    statusFacts(voiceStatus({ engine: "host", local: null, block: null, provider, available, whistle, recording: true }), { host: h, whistle });

  it("this phone with its copy: the phone, set up from the host's copy, ready on the copy", () => {
    const status = voiceStatus({ engine: "phone", local: COPY, block: null, provider: "none", available: false, whistle: READY, recording: true });
    expect(statusFacts(status, { host: null, whistle: READY })).toEqual({ engine: "phone", runsOn: "phone", setUp: { kind: "phone" }, readiness: "phone-ready" });
  });

  it("each host engine rests on its own check", () => {
    expect(of("whistle", true, host({})).readiness).toBe("whistle-ready");
    expect(of("whistle", false, host({ available: false }), { ...READY, state: "absent" }).readiness).toBe("whistle-no-model");
    expect(of("whistle", false, host({ available: false })).readiness).toBe("whistle-no-engine");
    expect(of("local-cli", true, host({ provider: "local-cli" })).readiness).toBe("command-found");
    expect(of("local-cli", false, host({ provider: "local-cli", available: false })).readiness).toBe("command-missing");
    expect(of("openai-compatible", true, host({ provider: "openai-compatible" })).readiness).toBe("service-set");
    expect(of("codex", true, host({ provider: "codex" })).readiness).toBe("codex-ready");
    expect(of("codex", false, host({ provider: "codex", available: false, switchable: { ...OPEN, codex: { ok: false, reason: "codex-signed-out" } } })).readiness).toBe(
      "codex-signed-out",
    );
    // Codex says it is signed in, yet the provider does not answer: only the host's words are left.
    expect(of("codex", false, host({ provider: "codex", available: false })).readiness).toBe("host-says");
    expect(of("future", false, host({ provider: "future", available: false })).readiness).toBe("host-says");
  });

  it("Set up: Settings by a named device, the environment, a terminal, or nothing", () => {
    expect(of("whistle", true, host({ changedBy: "Pixel 8", changedAt: "2026-10-11T09:41:00.000Z" })).setUp).toEqual({
      kind: "settings",
      by: "Pixel 8",
      at: "2026-10-11T09:41:00.000Z",
    });
    expect(of("whistle", true, host({ configuredBy: "env" })).setUp).toEqual({ kind: "env" });
    expect(of("whistle", true, host({})).setUp).toEqual({ kind: "terminal" });
    expect(of("whistle", true, null).setUp).toEqual({ kind: "terminal" });
    expect(of("none", false, host({ provider: "none", available: false, configuredBy: "none" }))).toEqual({
      engine: "off",
      runsOn: "nothing",
      setUp: { kind: "none" },
      readiness: "nothing",
    });
  });
});

describe("setupSteps: how to set up each host option, and which step is next", () => {
  const base: SetupInput = { lock: null, interactive: true, inUse: false, working: false, whistleReady: false, codex: "ready" };
  const marks = (option: Parameters<typeof setupSteps>[0], over: Partial<SetupInput>) =>
    setupSteps(option, { ...base, ...over }).map((s) => `${s.id}:${s.mark ?? "-"}`);

  it("Whistle: download, then use; the app's own buttons only when it may act", () => {
    expect(marks("whistle", {})).toEqual(["whistle-download:next", "whistle-use:-"]);
    expect(marks("whistle", { whistleReady: true })).toEqual(["whistle-download:done", "whistle-use:next"]);
    expect(marks("whistle", { whistleReady: true, inUse: true, working: true })).toEqual(["whistle-download:done", "whistle-use:done"]);
    expect(marks("whistle", { interactive: false })).toEqual(["whistle-command:-"]);
  });

  it("a terminal lock puts collie stt off first for Whistle and ChatGPT, never for the others", () => {
    expect(marks("whistle", { lock: "terminal", interactive: false })).toEqual(["lock-off:next", "whistle-command:-"]);
    expect(marks("chatgpt", { lock: "terminal", interactive: false, codex: null })[0]).toBe("lock-off:next");
    expect(marks("command", { lock: "terminal", interactive: false, inUse: true, working: true })).toEqual(["command-run:done"]);
    expect(marks("service", { lock: "terminal", interactive: false })).toEqual(["service-run:-"]);
  });

  it.each([
    ["missing", ["codex-install:next", "codex-login:-", "codex-use:-"]],
    ["signed-out", ["codex-install:done", "codex-login:next", "codex-use:-"]],
    ["other-login", ["codex-install:done", "codex-login:next", "codex-use:-"]],
    ["unknown", ["codex-install:done", "codex-login:next", "codex-use:-"]],
    ["ready", ["codex-install:done", "codex-login:done", "codex-use:next"]],
    [null, ["codex-install:-", "codex-login:-", "codex-use:-"]],
  ] as const)("ChatGPT with Codex %s", (codex, expected) => {
    expect(marks("chatgpt", { codex })).toEqual(expected);
  });

  it("ChatGPT in use and signed out: the sign-in is next, not done", () => {
    expect(marks("chatgpt", { codex: "signed-out", inUse: true })).toEqual(["codex-install:done", "codex-login:next", "codex-use:-"]);
    expect(marks("chatgpt", { codex: "ready", inUse: true, working: true })).toEqual(["codex-install:done", "codex-login:done", "codex-use:done"]);
  });

  it("codexStateOf reads the host's switch check; a lock checked nothing", () => {
    const sw = (codex: SttHostStatus["switchable"]["codex"]): SttHostStatus => ({
      provider: "none",
      available: false,
      configuredBy: "none",
      switchable: { whistle: { ok: true }, codex, off: { ok: true } },
    });
    expect(codexStateOf(sw({ ok: true }))).toBe("ready");
    expect(codexStateOf(sw({ ok: false, reason: "codex-missing" }))).toBe("missing");
    expect(codexStateOf(sw({ ok: false, reason: "terminal" }))).toBeNull();
    expect(codexStateOf(null)).toBeNull();
  });
});

describe("guidedPlan: what one tap of Set up speech on this phone does", () => {
  const NOT_SET_UP = { kind: "setup", state: "setup", reach: null } as const;
  const base = { status: NOT_SET_UP, block: null, recording: true, whistle: READY, local: null, canWrite: true };
  const ABSENT: WhistleStatus = { ...READY, state: "absent", sha256: undefined };

  it("walks from where things are: choose, copy, or download then copy", () => {
    expect(guidedPlan({ ...base, local: COPY })).toBe("select");
    expect(guidedPlan(base)).toBe("copy");
    expect(guidedPlan({ ...base, whistle: ABSENT })).toBe("both");
  });

  it("a device that may not write copies a model the host holds, and only reads a sentence when it does not", () => {
    expect(guidedPlan({ ...base, canWrite: false })).toBe("copy");
    expect(guidedPlan({ ...base, whistle: ABSENT, canWrite: false })).toBe("needs-host");
  });

  it("is not offered while speech works, while paused, where the engine cannot run, or before the copy is looked for", () => {
    expect(guidedPlan({ ...base, status: { kind: "phone", state: "works", reach: "phone" } })).toBeNull();
    expect(guidedPlan({ ...base, status: { kind: "paused", state: "paused", reach: null, action: "restore" } })).toBeNull();
    expect(guidedPlan({ ...base, block: "insecure" })).toBeNull();
    expect(guidedPlan({ ...base, recording: false })).toBeNull();
    expect(guidedPlan({ ...base, local: undefined })).toBeNull();
    expect(guidedPlan({ ...base, whistle: null })).toBeNull();
  });
});

describe("namedSetup: what the in-use card names beyond the kind", () => {
  const LOCK = { ok: false, reason: "terminal" } as const;
  const host = (provider: string, setup?: SttHostStatus["setup"]): SttHostStatus => {
    const status: SttHostStatus = { provider, available: true, configuredBy: "file", switchable: { whistle: LOCK, codex: LOCK, off: LOCK } };
    if (setup !== undefined) status.setup = setup;
    return status;
  };
  const none = { name: null, model: null, endpoint: null };

  it("a command names itself, and its model file when the host found one", () => {
    expect(namedSetup("command", { host: host("local-cli", { command: "whistle-stt" }), whistle: null, local: null })).toEqual({ ...none, name: "whistle-stt" });
    expect(namedSetup("command", { host: host("local-cli", { command: "whisper-cli", model: "ggml-base.bin" }), whistle: null, local: null })).toEqual({
      ...none,
      name: "whisper-cli",
      model: "ggml-base.bin",
    });
  });

  it("a speech service names its model as the title, and its host for the line under it", () => {
    expect(namedSetup("service", { host: host("openai-compatible", { model: "whisper-large-v3", endpoint: "api.groq.com" }), whistle: null, local: null })).toEqual({
      ...none,
      name: "whisper-large-v3",
      endpoint: "api.groq.com",
    });
  });

  it("Whistle on the host: the host's pinned version, else the held model's; on this phone, the copy's", () => {
    expect(namedSetup("whistle", { host: host("whistle", { model: "ca52876" }), whistle: null, local: null }).model).toBe("ca52876");
    expect(namedSetup("whistle", { host: host("whistle"), whistle: { ...READY, revision: "0123456789" }, local: null }).model).toBe("0123456");
    expect(namedSetup("whistle", { host: host("whistle"), whistle: null, local: null })).toEqual(none);
    expect(namedSetup("phone", { host: null, whistle: null, local: { ...COPY, revision: "abcdef0123" } }).model).toBe("abcdef0");
    expect(namedSetup("phone", { host: null, whistle: null, local: null })).toEqual(none);
  });

  it("ChatGPT names a model only when the host sends one; an older host, Off and an unknown provider name nothing", () => {
    expect(namedSetup("chatgpt", { host: host("codex"), whistle: null, local: null })).toEqual(none);
    expect(namedSetup("chatgpt", { host: host("codex", { model: "gpt-transcribe" }), whistle: null, local: null }).model).toBe("gpt-transcribe");
    expect(namedSetup("command", { host: host("local-cli"), whistle: null, local: null })).toEqual(none);
    expect(namedSetup("service", { host: null, whistle: null, local: null })).toEqual(none);
    expect(namedSetup("off", { host: host("none", { command: "x" }), whistle: null, local: null })).toEqual(none);
    expect(namedSetup("other", { host: host("future", { command: "x" }), whistle: null, local: null })).toEqual(none);
  });

  it("the old Whistle wrapper is a local-cli command named whistle-stt, and nothing else", () => {
    expect(oldWhistleWrapper(host("local-cli", { command: "whistle-stt" }))).toBe(true);
    expect(oldWhistleWrapper(host("local-cli", { command: "whisper-cli" }))).toBe(false);
    expect(oldWhistleWrapper(host("local-cli"))).toBe(false);
    expect(oldWhistleWrapper(host("whistle", { command: "whistle-stt" }))).toBe(false);
    expect(oldWhistleWrapper(null)).toBe(false);
  });

  it("shortVersion: seven characters of the revision, else of the hash", () => {
    expect(shortVersion("ca5287601bef", undefined)).toBe("ca52876");
    expect(shortVersion(undefined, "b6e02f048568")).toBe("b6e02f0");
    expect(shortVersion(undefined, undefined)).toBe("");
  });
});
