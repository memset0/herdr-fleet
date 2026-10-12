import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CodexDetector, CodexSignIn } from "./codex-detect.ts";
import { CODEX_CONSENT_ID } from "./codex-setup.ts";
import { createSttSettingsReader, sttSettingsPath, type SttChangeStamp, type SttSettingsDocument, type SttWireIdentity } from "./config.ts";
import { parseSttHostRequest, sttHostGet, sttHostPut, sttHostSetup, sttHostStatus, type SttHostRouteDeps } from "./host-http.ts";
import type { SttProvider } from "./provider.ts";
import { createWhistleModelStore, resetWhistleModelState, type WhistleModelPin } from "./whistle-model.ts";
import { WHISTLE_MODEL } from "./whistle-pins.ts";

// The Host speech provider routes (ADR 0097), driven without Bun.serve. The gate in front of them
// (read vs write) and the audit line are pinned in server.test.ts, where the dispatch lives. No test
// here runs a real `codex` or dials the endpoint: the sign-in check and the probe are both injected.

const MODEL = new TextEncoder().encode("a tiny stand-in for whistle.cact");
const SHA = createHash("sha256").update(MODEL).digest("hex");
const PIN: WhistleModelPin = { url: "https://models.invalid/whistle.cact", revision: "rev1", sha256: SHA, bytes: MODEL.byteLength };
const CODEX = "/opt/codex/bin/codex";

let stateDir: string;

beforeEach(() => {
  resetWhistleModelState();
  stateDir = mkdtempSync(join(tmpdir(), "collie-stt-host-"));
});
afterEach(() => {
  resetWhistleModelState();
  rmSync(stateDir, { recursive: true, force: true });
});

/** A sign-in check that answers what it is told, and counts how often, and how freshly, it was asked. */
function fakeCodex(answer: CodexSignIn): CodexDetector & { asked: boolean[] } {
  const asked: boolean[] = [];
  return {
    asked,
    check: async (fresh = false) => {
      asked.push(fresh);
      return answer;
    },
  };
}

interface Harness {
  deps: SttHostRouteDeps;
  codex: ReturnType<typeof fakeCodex>;
  probes: string[];
}

function harness(
  over: {
    env?: Record<string, string | undefined>;
    codex?: CodexSignIn;
    probe?: (codexBin: string) => Promise<SttWireIdentity>;
    provider?: SttProvider | null;
  } = {},
): Harness {
  const probes: string[] = [];
  const codex = fakeCodex(over.codex ?? { state: "ready", codexBin: CODEX });
  const store = createWhistleModelStore({
    stateDir,
    version: "1.20.0",
    pin: PIN,
    accepted: [SHA],
    lookup: async () => ["203.0.113.7"],
    fetch: async () => new Response(MODEL, { headers: { "content-length": String(MODEL.byteLength) } }),
  });
  const deps: SttHostRouteDeps = {
    stateDir,
    env: over.env ?? {},
    stt: async () => over.provider ?? null,
    store,
    codex,
    gate: { busy: false },
    probe: async (settings) => {
      // The probe is asked with the honest identity, always, as `collie stt setup` asks it.
      expect(settings).toEqual({ provider: "codex", codexBin: settings.codexBin, wireIdentity: "honest" });
      probes.push(settings.codexBin);
      return over.probe === undefined ? "honest" : over.probe(settings.codexBin);
    },
  };
  return { deps, codex, probes };
}

async function modelReady(h: Harness): Promise<void> {
  await h.deps.store.start();
  await h.deps.store.settled();
}

const sttJson = (): string | null => (existsSync(sttSettingsPath(stateDir)) ? readFileSync(sttSettingsPath(stateDir), "utf8") : null);
/** `stt.json` as text, exactly: a document, or something that is not one. */
const seedText = (text: string): void => writeFileSync(sttSettingsPath(stateDir), text);
const seed = (doc: SttSettingsDocument | (SttSettingsDocument & SttChangeStamp)): void => seedText(JSON.stringify(doc));

/** A provider the gate would hand the microphone. */
const provider = (id: string, available = true, reason?: string): SttProvider => ({
  id,
  status: async () => (reason === undefined ? { available } : { available, reason }),
  transcribe: async () => ({ text: "" }),
});

describe("GET /api/stt/host", () => {
  test("nothing configured: none, and the three choices with their own reasons", async () => {
    const h = harness({ codex: { state: "signed-out", codexBin: CODEX } });
    expect(await (await sttHostGet(h.deps)).json()).toEqual({
      provider: "none",
      available: false,
      configuredBy: "none",
      codexBin: CODEX,
      switchable: {
        whistle: { ok: false, reason: "not-ready" },
        codex: { ok: false, reason: "codex-signed-out" },
        off: { ok: true },
      },
    });
  });

  test("whistle once the model is ready; codex when signed in with ChatGPT", async () => {
    const h = harness();
    await modelReady(h);
    expect((await sttHostStatus(h.deps)).switchable).toEqual({ whistle: { ok: true }, codex: { ok: true }, off: { ok: true } });
  });

  test("every codex verdict has its own reason, and a missing binary names none", async () => {
    for (const [state, reason] of [
      ["missing", "codex-missing"],
      ["other-login", "codex-other-login"],
      ["unknown", "codex-unknown"],
    ] as const) {
      const signIn: CodexSignIn = state === "missing" ? { state } : { state, codexBin: CODEX };
      const status = await sttHostStatus(harness({ codex: signIn }).deps);
      expect(status.switchable.codex).toEqual({ ok: false, reason });
      expect("codexBin" in status).toBe(state !== "missing");
    }
  });

  test("codex on: the provider, its availability, and the recorded identity, fallback word included", async () => {
    seed({ provider: "codex", codexBin: CODEX, wireIdentity: "codex-cli" });
    const h = harness({ provider: provider("codex", false, "the Codex sign-in has not been checked yet") });
    const status = await sttHostStatus(h.deps);
    expect(status).toMatchObject({
      provider: "codex",
      available: false,
      reason: "the Codex sign-in has not been checked yet",
      identity: "codex-cli",
      configuredBy: "file",
    });
    expect(status.switchable.off).toEqual({ ok: true });
  });

  test("a provider set up in a terminal is shown, and no choice is open; codex is not even asked", async () => {
    for (const doc of [
      { provider: "openai-compatible", baseUrl: "https://api.example.invalid/v1", apiKey: "sk-test-placeholder" },
      { baseUrl: "http://127.0.0.1:8080/v1" },
      { provider: "local-cli", command: "/usr/bin/whisper" },
      { provider: "something-new" },
    ]) {
      seed(doc);
      const h = harness({ provider: provider("openai-compatible") });
      const status = await sttHostStatus(h.deps);
      expect(status.configuredBy).toBe("file");
      expect(status.switchable).toEqual({
        whistle: { ok: false, reason: "terminal" },
        codex: { ok: false, reason: "terminal" },
        off: { ok: false, reason: "terminal" },
      });
      expect(h.codex.asked).toEqual([]);
      // The key never reaches the wire, whatever else does.
      expect(JSON.stringify(status)).not.toContain("sk-test-placeholder");
    }
  });

  test("the environment's provider and an unreadable stt.json lock every choice", async () => {
    const env = await sttHostStatus(harness({ env: { COLLIE_STT_PROVIDER: "whistle" } }).deps);
    expect(env).toMatchObject({ provider: "whistle", configuredBy: "env", switchable: { off: { ok: false, reason: "env" } } });
    // Any environment field counts: it outranks the file field by field.
    const partial = await sttHostStatus(harness({ env: { COLLIE_STT_LANG: "de" } }).deps);
    expect(partial.switchable.codex).toEqual({ ok: false, reason: "env" });
    seedText("{ not json");
    const unreadable = await sttHostStatus(harness().deps);
    expect(unreadable).toMatchObject({ configuredBy: "file", switchable: { whistle: { ok: false, reason: "unreadable" } } });
  });

  test("settings that name a provider and do not resolve say why", async () => {
    seed({ provider: "local-cli" });
    const status = await sttHostStatus(harness().deps);
    expect(status).toMatchObject({ provider: "local-cli", available: false });
    expect(status.reason).toContain("needs a command");
  });
});

describe("PUT /api/stt/host", () => {
  test("a body that is not one of the three choices is a 400", async () => {
    for (const body of [null, {}, { provider: "openai-compatible" }, { provider: "local-cli" }, { provider: "codex", consent: 7 }, "codex", [1]]) {
      expect(parseSttHostRequest(body)).toBeNull();
      expect((await sttHostPut(harness().deps, body)).response.status).toBe(400);
    }
  });

  test("codex without the consent id, or with another, is 400 and runs nothing at all", async () => {
    for (const body of [{ provider: "codex" }, { provider: "codex", consent: "codex-consent-000000000000" }]) {
      const h = harness();
      const result = await sttHostPut(h.deps, body);
      expect(result.response.status).toBe(400);
      expect((await result.response.json()).code).toBe("stt.consent_required");
      expect(h.codex.asked).toEqual([]);
      expect(h.probes).toEqual([]);
      expect(sttJson()).toBeNull();
    }
  });

  test("codex with the consent: a fresh sign-in check, the honest-first probe, and its verdict recorded", async () => {
    for (const identity of ["honest", "codex-cli"] as const) {
      rmSync(sttSettingsPath(stateDir), { force: true });
      const h = harness({ probe: async () => identity });
      const result = await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
      expect(result.response.status).toBe(200);
      expect(result.attempt).toEqual({ status: 200, outcome: "ok", provider: "codex", identity });
      expect(h.codex.asked[0]).toBe(true);
      expect(h.probes).toEqual([CODEX]);
      expect(JSON.parse(sttJson()!)).toEqual({ provider: "codex", codexBin: CODEX, wireIdentity: identity });
      if (process.platform !== "win32") expect(statSync(sttSettingsPath(stateDir)).mode & 0o777).toBe(0o600);
      expect(readdirSync(stateDir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
      expect(await result.response.json()).toMatchObject({ identity, configuredBy: "file" });
      // The bridge's own reader takes it with no restart.
      const read = createSttSettingsReader({ stateDir, warn: () => undefined, env: {} });
      expect(await read()).toEqual({ provider: "codex", codexBin: CODEX, wireIdentity: identity });
    }
  });

  test("codex not ready on the host: 409 with the verdict's code, no probe, nothing written", async () => {
    for (const [signIn, code] of [
      [{ state: "missing" }, "stt.codex_missing"],
      [{ state: "signed-out", codexBin: CODEX }, "stt.codex_signed_out"],
      [{ state: "other-login", codexBin: CODEX }, "stt.codex_other_login"],
      [{ state: "unknown", codexBin: CODEX }, "stt.codex_unknown"],
    ] as const) {
      const h = harness({ codex: signIn });
      const result = await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
      expect(result.response.status).toBe(409);
      expect((await result.response.json()).code).toBe(code);
      expect(h.probes).toEqual([]);
      expect(sttJson()).toBeNull();
    }
  });

  test("a probe that fails is 502 with Collie's own sentence, and nothing is written", async () => {
    seed({ provider: "whistle" });
    const h = harness({
      probe: async () => {
        throw new Error("the Codex transcription endpoint accepted neither identity (honest → 403)");
      },
    });
    const result = await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
    expect(result.response.status).toBe(502);
    const body = await result.response.json();
    expect(body.code).toBe("stt.codex_probe_failed");
    expect(body.detail.reason).toContain("accepted neither identity");
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "whistle" });
  });

  test("whistle needs the model; then writes exactly { provider: whistle }, and off removes it", async () => {
    const h = harness();
    const early = await sttHostPut(h.deps, { provider: "whistle" });
    expect(early.response.status).toBe(409);
    expect((await early.response.json()).code).toBe("stt.whistle_not_ready");
    expect(sttJson()).toBeNull();

    await modelReady(h);
    expect((await sttHostPut(h.deps, { provider: "whistle" })).response.status).toBe(200);
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "whistle" });
    // Choosing it again changes nothing.
    expect((await sttHostPut(h.deps, { provider: "whistle" })).attempt.outcome).toBe("unchanged");

    const off = await sttHostPut(h.deps, { provider: "off" });
    expect(off.response.status).toBe(200);
    expect(sttJson()).toBeNull();
    expect((await sttHostPut(h.deps, { provider: "off" })).attempt.outcome).toBe("unchanged");
  });

  test("codex replaces whistle, and whistle or off replace codex", async () => {
    const h = harness();
    await modelReady(h);
    seed({ provider: "whistle" });
    expect((await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID })).response.status).toBe(200);
    expect(JSON.parse(sttJson()!).provider).toBe("codex");
    expect((await sttHostPut(h.deps, { provider: "whistle" })).response.status).toBe(200);
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "whistle" });
    seed({ provider: "codex", codexBin: CODEX, wireIdentity: "codex-cli" });
    expect((await sttHostPut(h.deps, { provider: "off" })).response.status).toBe(200);
    expect(sttJson()).toBeNull();
  });

  test("never replaces or removes a provider set up with a key or a command, nor an unreadable file", async () => {
    for (const theirs of [
      JSON.stringify({ provider: "openai-compatible", baseUrl: "https://api.example.invalid/v1", apiKey: "sk-test-placeholder" }),
      JSON.stringify({ provider: "local-cli", command: "/usr/bin/whisper" }),
      "{ not json",
    ]) {
      const h = harness();
      await modelReady(h);
      seedText(theirs);
      for (const body of [{ provider: "whistle" }, { provider: "codex", consent: CODEX_CONSENT_ID }, { provider: "off" }]) {
        const result = await sttHostPut(h.deps, body);
        expect(result.response.status).toBe(409);
        expect((await result.response.json()).code).toBe("stt.host_provider_locked");
        expect(sttJson()).toBe(theirs);
      }
      expect(h.probes).toEqual([]);
      expect(h.codex.asked).toEqual([]);
    }
  });

  test("never writes over the environment's provider, not even off", async () => {
    seed({ provider: "whistle" });
    const h = harness({ env: { COLLIE_STT_PROVIDER: "codex" } });
    await modelReady(h);
    for (const body of [{ provider: "whistle" }, { provider: "codex", consent: CODEX_CONSENT_ID }, { provider: "off" }]) {
      expect((await sttHostPut(h.deps, body)).response.status).toBe(409);
    }
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "whistle" });
  });

  test("the operator wrote stt.json while the probe ran: 409 stt.host_changed, their file kept", async () => {
    const theirs = JSON.stringify({ provider: "local-cli", command: "/usr/bin/whisper" });
    const h = harness({
      probe: async () => {
        // `collie stt setup` lands during the probe: after the first read, before the write.
        seedText(theirs);
        return "honest";
      },
    });
    const result = await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
    expect(result.response.status).toBe(409);
    expect((await result.response.json()).code).toBe("stt.host_changed");
    expect(sttJson()).toBe(theirs);
  });

  test("the same race on the whistle path, during the model check", async () => {
    const h = harness();
    await modelReady(h);
    const theirs = JSON.stringify({ provider: "openai-compatible", baseUrl: "http://127.0.0.1:8080/v1" });
    const store = h.deps.store;
    h.deps.store = {
      ...store,
      ready: async () => {
        const held = await store.ready();
        seedText(theirs);
        return held;
      },
    };
    const result = await sttHostPut(h.deps, { provider: "whistle" });
    expect(result.response.status).toBe(409);
    expect((await result.response.json()).code).toBe("stt.host_changed");
    expect(sttJson()).toBe(theirs);
  });

  test("one switch at a time: a second PUT while a probe runs is 409 stt.host_busy", async () => {
    let finish: (identity: SttWireIdentity) => void = () => undefined;
    const h = harness({
      probe: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const first = sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
    // Let the first reach its probe.
    await Bun.sleep(0);
    const second = await sttHostPut(h.deps, { provider: "off" });
    expect(second.response.status).toBe(409);
    expect((await second.response.json()).code).toBe("stt.host_busy");
    finish("honest");
    expect((await first).response.status).toBe(200);
    // And the gate opens again afterwards.
    expect((await sttHostPut(h.deps, { provider: "off" })).response.status).toBe(200);
  });

  test("the audit attempt carries the choice and the outcome, never a reason's text or a path", async () => {
    const h = harness({
      probe: async () => {
        throw new Error(`no ${CODEX} today`);
      },
    });
    const result = await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
    expect(result.attempt).toEqual({ status: 502, outcome: "stt.codex_probe_failed", provider: "codex" });
  });
});

describe("Last changed by: the change stamp", () => {
  const AT = new Date("2026-10-11T09:41:00.000Z");

  test("a change from a named device writes its label and the time beside the settings, and GET reports them", async () => {
    const h = harness();
    h.deps.now = () => AT;
    await modelReady(h);
    const result = await sttHostPut(h.deps, { provider: "whistle" }, "Pixel 8");
    expect(result.response.status).toBe(200);
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "whistle", changedBy: "Pixel 8", changedAt: AT.toISOString() });
    expect(await result.response.json()).toMatchObject({ changedBy: "Pixel 8", changedAt: AT.toISOString() });
    expect(await (await sttHostGet(h.deps)).json()).toMatchObject({ provider: "whistle", changedBy: "Pixel 8" });
    // The stamp never reaches the settings the bridge runs with.
    const read = createSttSettingsReader({ stateDir, warn: () => undefined, env: {} });
    expect(await read()).toEqual({ provider: "whistle" });
  });

  test("codex keeps its identity and gains the stamp", async () => {
    const h = harness();
    h.deps.now = () => AT;
    await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID }, "ThinkPad");
    expect(JSON.parse(sttJson()!)).toEqual({
      provider: "codex",
      codexBin: CODEX,
      wireIdentity: "honest",
      changedBy: "ThinkPad",
      changedAt: AT.toISOString(),
    });
  });

  test("off from a named device leaves only the stamp, which reads as nothing configured", async () => {
    seed({ provider: "whistle" });
    const h = harness();
    h.deps.now = () => AT;
    expect((await sttHostPut(h.deps, { provider: "off" }, "Pixel 8")).response.status).toBe(200);
    expect(JSON.parse(sttJson()!)).toEqual({ changedBy: "Pixel 8", changedAt: AT.toISOString() });
    const status = await sttHostStatus(h.deps);
    expect(status).toMatchObject({ provider: "none", configuredBy: "none", changedBy: "Pixel 8", changedAt: AT.toISOString() });
    expect(status.switchable.off).toEqual({ ok: true });
    const read = createSttSettingsReader({ stateDir, warn: () => undefined, env: {} });
    expect(await read()).toBeNull();
    // Off again changes nothing, and Whistle can be chosen over the stamp-only file.
    expect((await sttHostPut(h.deps, { provider: "off" }, "Pixel 8")).attempt.outcome).toBe("unchanged");
    await modelReady(h);
    expect((await sttHostPut(h.deps, { provider: "whistle" }, "ThinkPad")).response.status).toBe(200);
    expect(JSON.parse(sttJson()!)).toMatchObject({ provider: "whistle", changedBy: "ThinkPad" });
  });

  test("a change no device is named for writes no stamp, and drops an older one", async () => {
    seed({ provider: "whistle", changedBy: "Pixel 8", changedAt: AT.toISOString() });
    const h = harness();
    await sttHostPut(h.deps, { provider: "codex", consent: CODEX_CONSENT_ID });
    expect(JSON.parse(sttJson()!)).toEqual({ provider: "codex", codexBin: CODEX, wireIdentity: "honest" });
    expect(await sttHostStatus(h.deps)).not.toHaveProperty("changedBy");
    expect((await sttHostPut(h.deps, { provider: "off" })).response.status).toBe(200);
    expect(sttJson()).toBeNull();
  });

  test("GET leaves out a stamp it cannot believe, and any stamp while the environment names the provider", async () => {
    for (const stamp of [
      { changedBy: "", changedAt: AT.toISOString() },
      { changedBy: "x".repeat(49), changedAt: AT.toISOString() },
      { changedBy: "Pixel\n8", changedAt: AT.toISOString() },
      { changedBy: "Pixel 8", changedAt: "yesterday" },
      { changedBy: 7, changedAt: AT.toISOString() },
      { changedBy: "Pixel 8" },
    ]) {
      seedText(JSON.stringify({ provider: "whistle", ...stamp }));
      expect(await sttHostStatus(harness().deps)).not.toHaveProperty("changedBy");
    }
    seedText(JSON.stringify({ provider: "whistle", changedBy: "Pixel 8", changedAt: AT.toISOString() }));
    expect(await sttHostStatus(harness({ env: { COLLIE_STT_PROVIDER: "codex" } }).deps)).not.toHaveProperty("changedBy");
  });
});

describe("setup: what the settings name, by name only", () => {
  const WRAPPER = "/var/home/someone/.local/share/collie-whistle/whistle-stt";

  test("local-cli: the command's basename, never its path; no model without a model argument", async () => {
    seed({ provider: "local-cli", command: WRAPPER });
    const status = await sttHostStatus(harness({ provider: provider("local-cli") }).deps);
    expect(status.setup).toEqual({ command: "whistle-stt" });
    expect(JSON.stringify(status)).not.toContain("/var/home");
  });

  test("local-cli: the first argument that names a model file, among others, and no other argument", async () => {
    seed({
      provider: "local-cli",
      command: "/opt/whisper.cpp/build/bin/whisper-cli",
      args: ["--api-key", "sk-or-v1-your-key-here", "-l", "de", "-m", "/models/ggml-base.bin", "--extra", "/models/second.gguf", "-f"],
    });
    const status = await sttHostStatus(harness().deps);
    expect(status.setup).toEqual({ command: "whisper-cli", model: "ggml-base.bin" });
    const wire = JSON.stringify(status);
    for (const hidden of ["sk-or-v1-your-key-here", "/models", "/opt/whisper.cpp", "second.gguf", "--extra"]) expect(wire).not.toContain(hidden);
  });

  test("local-cli: a flag's own value, every listed extension in any case, and a Windows path", () => {
    const local = (command: string, args: string[]) => sttHostSetup({ provider: "local-cli", command, args }, "rev1");
    expect(local("whisper", ["--model=/m/tiny.en.GGUF"])).toEqual({ command: "whisper", model: "tiny.en.GGUF" });
    for (const ext of ["bin", "gguf", "ggml", "cact", "onnx", "pt", "safetensors", "tflite"]) {
      expect(local("stt", [`/m/model.${ext}`])?.model).toBe(`model.${ext}`);
    }
    expect(local("C:\\Tools\\whisper\\whisper.exe", ["C:\\Models\\ggml-small.bin"])).toEqual({ command: "whisper.exe", model: "ggml-small.bin" });
    // A key-shaped argument is not a model file, and no other argument reaches the wire.
    expect(local("stt", ["--token", "sk-or-v1-your-key-here", "--lang=de"])).toEqual({ command: "stt" });
  });

  test("openai-compatible: the model, and the endpoint's host only, never userinfo, path, query or key", async () => {
    seed({
      provider: "openai-compatible",
      baseUrl: "https://user:pass@api.groq.com/openai/v1?token=abc",
      model: "whisper-large-v3",
      apiKey: "sk-test-placeholder",
    });
    const status = await sttHostStatus(harness({ provider: provider("openai-compatible") }).deps);
    expect(status.setup).toEqual({ model: "whisper-large-v3", endpoint: "api.groq.com" });
    const wire = JSON.stringify(status);
    for (const hidden of ["user", "pass", "/openai", "token=abc", "sk-test-placeholder"]) expect(wire).not.toContain(hidden);
  });

  test("openai-compatible: a port is kept, the default model is named, and an unsafe model name is dropped", () => {
    const service = (model: string) => sttHostSetup({ provider: "openai-compatible", baseUrl: "http://127.0.0.1:8080/v1", model }, "rev1");
    expect(service("gpt-transcribe")).toEqual({ model: "gpt-transcribe", endpoint: "127.0.0.1:8080" });
    expect(service("openai/whisper-1:latest")?.model).toBe("openai/whisper-1:latest");
    for (const unsafe of ["whisper large", "a<b>", "x".repeat(65), "model?key=1"]) expect(service(unsafe)).toEqual({ endpoint: "127.0.0.1:8080" });
  });

  test("whistle: the pinned model's short version, also when the environment names it", async () => {
    seed({ provider: "whistle" });
    const h = harness();
    h.deps.whistleRevision = "ca5287601bef25af26dcf2e1b2bdc0843a7c19e5";
    expect((await sttHostStatus(h.deps)).setup).toEqual({ model: "ca52876" });
    rmSync(sttSettingsPath(stateDir));
    // Unset, the revision is the pin this build ships.
    expect((await sttHostStatus(harness({ env: { COLLIE_STT_PROVIDER: "whistle" } }).deps)).setup).toEqual({ model: WHISTLE_MODEL.revision.slice(0, 7) });
  });

  test("codex names nothing; nothing configured, a provider this build cannot parse, or an unreadable file carry no setup", async () => {
    seed({ provider: "codex", codexBin: CODEX });
    expect(await sttHostStatus(harness().deps)).not.toHaveProperty("setup");
    rmSync(sttSettingsPath(stateDir));
    expect(await sttHostStatus(harness().deps)).not.toHaveProperty("setup");
    for (const text of [JSON.stringify({ provider: "something-new", command: "/usr/bin/x" }), JSON.stringify({ provider: "local-cli" }), "{ not json"]) {
      seedText(text);
      expect(await sttHostStatus(harness().deps)).not.toHaveProperty("setup");
    }
  });

  test("a hidden character drops the field it is in, and only that field", () => {
    expect(sttHostSetup({ provider: "local-cli", command: "/usr/bin/whis\u202Eper", args: ["/m/ggml-base.bin"] }, "rev1")).toEqual({ model: "ggml-base.bin" });
    expect(sttHostSetup({ provider: "local-cli", command: "whisper", args: ["/m/ggml\u200Bbase.bin"] }, "rev1")).toEqual({ command: "whisper" });
    expect(sttHostSetup({ provider: "local-cli", command: "whisper\u0007", args: [] }, "rev1")).toBeUndefined();
    expect(
      sttHostSetup({ provider: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", model: "whisper\u2028large" }, "rev1"),
    ).toEqual({ endpoint: "api.groq.com" });
  });
});
