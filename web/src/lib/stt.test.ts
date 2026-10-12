import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSttModel } from "@/lib/api";
import { server } from "@/test/setup";
import { t } from "./i18n";
import {
  __resetSttEngine,
  noteSttProbe,
  phoneEngineBlock,
  phoneFailureMessage,
  recordingLimitMs,
  setSttEnginePreference,
  sttEnginePreference,
  sttModelErrorMessage,
  sttProbeState,
  type PhoneEngineEnv,
} from "./stt";
import { SttModelError, type SttModelErrorCode } from "./stt-model";

const KEY = "collie:stt-engine:v1";
const FULL_ENV: PhoneEngineEnv = {
  secureContext: true,
  webAssembly: true,
  worker: true,
  subtleCrypto: true,
  cacheStorage: true,
  bigInt: true,
};

beforeEach(() => {
  localStorage.clear();
  __resetSttEngine();
});
afterEach(() => vi.restoreAllMocks());

describe("the engine preference", () => {
  it("is the host until the person chooses, and a stranger's value is not a choice", async () => {
    expect(sttEnginePreference()).toBe("host");
    localStorage.setItem(KEY, "cloud");
    vi.resetModules();
    const fresh = await import("./stt");
    expect(fresh.sttEnginePreference()).toBe("host");
  });

  it("is kept in localStorage under its own key and read back by a new page", async () => {
    setSttEnginePreference("phone");
    expect(localStorage.getItem(KEY)).toBe("phone");
    vi.resetModules();
    const fresh = await import("./stt");
    expect(fresh.sttEnginePreference()).toBe("phone");
  });

  it("still applies for the session when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setSttEnginePreference("phone");
    expect(sttEnginePreference()).toBe("phone");
  });
});

describe("phoneEngineBlock: the first reason, in the order a person can act on", () => {
  const base = { env: FULL_ENV, probe: "unknown" as const, haveLocalModel: true, hostReady: true };

  it("is null when nothing rules the phone out", () => {
    expect(phoneEngineBlock(base)).toBeNull();
    expect(phoneEngineBlock({ ...base, probe: "ok" })).toBeNull();
  });

  it("names an insecure connection before anything else", () => {
    expect(phoneEngineBlock({ ...base, env: { ...FULL_ENV, secureContext: false, webAssembly: false }, probe: "wasm-csp" })).toBe("insecure");
  });

  it("names each missing browser feature as the browser", () => {
    for (const missing of ["webAssembly", "worker", "subtleCrypto", "cacheStorage", "bigInt"] as const) {
      expect(phoneEngineBlock({ ...base, env: { ...FULL_ENV, [missing]: false } })).toBe("browser");
    }
  });

  it("names what the worker probe said", () => {
    expect(phoneEngineBlock({ ...base, probe: "wasm-csp" })).toBe("wasm-csp");
    expect(phoneEngineBlock({ ...base, probe: "glue-failed" })).toBe("engine");
    expect(phoneEngineBlock({ ...base, probe: "crashed" })).toBe("engine");
  });

  it("asks for the setup only while the phone has no copy of its own", () => {
    expect(phoneEngineBlock({ ...base, haveLocalModel: false, hostReady: false })).toBe("host-not-ready");
    expect(phoneEngineBlock({ ...base, haveLocalModel: false, hostReady: true })).toBeNull();
    expect(phoneEngineBlock({ ...base, haveLocalModel: true, hostReady: false })).toBeNull();
  });
});

describe("the probe's answer", () => {
  it("keeps the browser's refusal and drops an aborted probe", () => {
    noteSttProbe({ ok: false, reason: "aborted" });
    expect(sttProbeState()).toBe("unknown");
    noteSttProbe({ ok: false, reason: "wasm-csp" });
    expect(sttProbeState()).toBe("wasm-csp");
    noteSttProbe({ ok: true });
    expect(sttProbeState()).toBe("ok");
    noteSttProbe({ ok: false, reason: "disabled" });
    expect(sttProbeState()).toBe("crashed");
  });

  it("runs the shared engine once, records what it said, and leaves the worker to its idle timer", async () => {
    const dispose = vi.fn();
    const probe = vi.fn(async () => ({ ok: false as const, reason: "wasm-csp" as const }));
    const createSttEngine = vi.fn(() => ({ probe, dispose, transcribe: vi.fn(), disabled: () => false }));
    vi.resetModules();
    vi.doMock("@/lib/stt-engine", () => ({ createSttEngine }));
    const fresh = await import("./stt");
    await Promise.all([fresh.runSttProbe(), fresh.runSttProbe()]);
    await fresh.runSttProbe();
    expect(createSttEngine).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    expect(fresh.sttProbeState()).toBe("wasm-csp");
    vi.doUnmock("@/lib/stt-engine");
  });

  it("stays unknown when the probe itself cannot run", async () => {
    vi.resetModules();
    vi.doMock("@/lib/stt-engine", () => ({
      createSttEngine: () => {
        throw new Error("no Worker here");
      },
    }));
    const fresh = await import("./stt");
    await fresh.runSttProbe();
    expect(fresh.sttProbeState()).toBe("unknown");
    vi.doUnmock("@/lib/stt-engine");
  });
});

describe("sttModelErrorMessage", () => {
  const CODES: SttModelErrorCode[] = [
    "unsupported",
    "low-space",
    "unknown-model",
    "download-failed",
    "busy",
    "hash-mismatch",
    "engine-mismatch",
    "aborted",
    "storage-failed",
    "damaged",
    "missing",
  ];

  it("has its own sentence for every code, none of them a raw key", () => {
    const sentences = CODES.map((c) => sttModelErrorMessage(new SttModelError(c)));
    expect(new Set(sentences).size).toBe(CODES.length);
    for (const sentence of sentences) expect(sentence).not.toMatch(/^stt\.model\./);
  });

  it("says the host's own refusal when the copy broke on a code this build knows", async () => {
    server.use(
      http.get(`/api/stt/model/${"d".repeat(64)}`, () =>
        HttpResponse.json({ error: "unknown model", code: "stt.model_unknown" }, { status: 404 }),
      ),
    );
    let cause: unknown;
    try {
      await fetchSttModel("d".repeat(64));
    } catch (thrown) {
      cause = thrown;
    }
    expect(sttModelErrorMessage(new SttModelError("download-failed", undefined, { cause }))).toBe(t("apiError.stt.model_unknown"));
  });

  it("falls back to 'Download stopped' for a break with no code, and describes a foreign throw", () => {
    expect(sttModelErrorMessage(new SttModelError("download-failed", undefined, { cause: new TypeError("offline") }))).toBe(
      t("stt.model.error.downloadFailed"),
    );
    expect(sttModelErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("recordingLimitMs", () => {
  const whistle = { provider: "whistle", available: true, input: "wav-16k" as const, maxDurationMs: 240_000 };

  it("is the provider's cap on the host engine, and five minutes on the phone", () => {
    expect(recordingLimitMs("host", whistle)).toBe(240_000);
    expect(recordingLimitMs("phone", whistle)).toBe(5 * 60 * 1000);
  });

  it("is five minutes when the provider names none, and never more than five", () => {
    expect(recordingLimitMs("host", null)).toBe(5 * 60 * 1000);
    expect(recordingLimitMs("host", { provider: "codex", available: true })).toBe(5 * 60 * 1000);
    expect(recordingLimitMs("host", { ...whistle, maxDurationMs: 3_600_000 })).toBe(5 * 60 * 1000);
    expect(recordingLimitMs("host", { ...whistle, maxDurationMs: 0 })).toBe(5 * 60 * 1000);
    expect(recordingLimitMs("host", { ...whistle, maxDurationMs: Number.NaN })).toBe(5 * 60 * 1000);
  });
});

describe("phoneFailureMessage", () => {
  it("says the engine is off after the second crash, whichever code ended the clip", () => {
    expect(phoneFailureMessage("crashed", true, null)).toBe(t("stt.error.phone.disabled"));
    expect(phoneFailureMessage("timeout", true, null)).toBe(t("stt.error.phone.disabled"));
    expect(phoneFailureMessage("disabled", true, null)).toBe(t("stt.error.phone.disabled"));
    expect(phoneFailureMessage("crashed", false, null)).toBe(t("stt.error.phone.crashed"));
    expect(phoneFailureMessage("timeout", false, null)).toBe(t("stt.error.phone.timeout"));
  });

  it("has a sentence for each case in the failure table, none of them a raw key", () => {
    const damaged = new SttModelError("damaged");
    const sentences = [
      phoneFailureMessage("oom", false, null),
      phoneFailureMessage("busy", false, null),
      phoneFailureMessage("unsupported", false, null),
      phoneFailureMessage("wasm-hash", false, null),
      phoneFailureMessage("model-hash", false, null),
      phoneFailureMessage("bytes-failed", false, damaged),
      phoneFailureMessage("bytes-failed", false, new SttModelError("engine-mismatch")),
      phoneFailureMessage("bytes-failed", false, null),
      phoneFailureMessage("transcribe-failed", false, null),
    ];
    for (const sentence of sentences) expect(sentence).not.toMatch(/^(stt|composer)\./);
    expect(phoneFailureMessage("busy", false, null)).toBe(t("stt.error.busy"));
    expect(phoneFailureMessage("bytes-failed", false, damaged)).toBe(t("stt.model.error.damaged"));
    expect(phoneFailureMessage("wasm-hash", false, null)).toBe(t("stt.error.phone.engineFiles"));
  });
});

describe("transcribeOnPhone", () => {
  /** A fresh stt module over a fake engine. */
  async function withEngine(engine: {
    transcribe: ReturnType<typeof vi.fn>;
    disabled?: () => boolean;
    probe?: ReturnType<typeof vi.fn>;
  }) {
    const fake = { probe: vi.fn(), disabled: () => false, dispose: vi.fn(), ...engine };
    vi.resetModules();
    vi.doMock("@/lib/stt-engine", () => ({ createSttEngine: () => fake }));
    return { fresh: await import("./stt"), fake };
  }

  it("returns the words and shares one engine across clips", async () => {
    const transcribe = vi.fn(async () => ({ ok: true, text: "hello", language: "en" }));
    const { fresh } = await withEngine({ transcribe });
    const signal = new AbortController().signal;
    await expect(fresh.transcribeOnPhone(new Float32Array(4), signal)).resolves.toEqual({ ok: true, text: "hello" });
    await fresh.transcribeOnPhone(new Float32Array(4), signal);
    expect(transcribe).toHaveBeenCalledTimes(2);
    vi.doUnmock("@/lib/stt-engine");
  });

  it("hands back the probe answer when two crashes switched the engine off, and notes nothing itself", async () => {
    const probe = vi.fn(async () => ({ ok: false as const, reason: "disabled" as const }));
    const { fresh } = await withEngine({
      transcribe: vi.fn(async () => ({ ok: false, code: "crashed" })),
      disabled: () => true,
      probe,
    });
    const result = await fresh.transcribeOnPhone(new Float32Array(4), new AbortController().signal);
    expect(result).toEqual({
      ok: false,
      message: fresh.phoneFailureMessage("crashed", true, null),
      probe: { ok: false, reason: "disabled" },
    });
    expect(fresh.sttProbeState()).toBe("unknown");
    fresh.noteSttProbe(result.ok ? { ok: true } : (result.probe ?? { ok: true }));
    expect(fresh.sttProbeState()).toBe("crashed");
    vi.doUnmock("@/lib/stt-engine");
  });

  it("carries no probe for an ordinary failure", async () => {
    const { fresh } = await withEngine({ transcribe: vi.fn(async () => ({ ok: false, code: "oom" })) });
    const result = await fresh.transcribeOnPhone(new Float32Array(4), new AbortController().signal);
    expect(result).toEqual({ ok: false, message: t("stt.error.phone.memory") });
    vi.doUnmock("@/lib/stt-engine");
  });
});
