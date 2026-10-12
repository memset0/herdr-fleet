// The phone's speech engine, page side (ADR 0096 Decisions 8 and 12). It owns one worker
// (stt/worker.ts) and nothing else: it does not fetch the engine or the model and does not store
// them. The caller hands the bytes in through `getBytes` when a fresh worker needs a load
// (lib/stt-model.ts reads them from its own cache), and they are transferred, never kept here.
//
// THE WORKER IS MADE FROM ITS URL, NEVER FROM A BLOB. Only a URL worker runs under the policy its own
// response carries, the one that allows wasm. A `blob:` worker inherits the document's policy, which
// does not and must not. `new Worker(new URL(...), { type: "classic" })` is the form Vite rewrites to
// the built `stt/worker-<hash>.js`, relative to this chunk, so a mount works (ADR 0052).
//
// A RUNNING WASM CALL STOPS FOR CERTAIN ONLY WHEN ITS WORKER DIES. So every way out of a stuck or
// unwanted clip is `terminate()`: the watchdog, a crash, an abort, `pagehide`, and sixty seconds of
// idle. The next clip makes a new worker and loads again (about a tenth of a second on a Pixel).
//
// TWO CRASHES AND THE ENGINE IS OFF FOR THE PAGE SESSION. A crash is an `error` or `messageerror`
// event, or a worker that does not answer in time: from the page a hung worker and a dead one look
// the same. Hold one engine per page, so "the page session" is the engine's life.
//
// ONE CLIP AT A TIME. A second `transcribe` while one is in flight answers `busy` at once.

import { asJsonNumber, asJsonString } from "@/lib/json";
import type {
  SttPageInbound,
  SttUnsupportedReason,
  SttWorkerErrorCode,
  SttWorkerReply,
  SttWorkerRequest,
} from "@/stt/protocol";

/** The two files the worker needs, as the caller holds them. Both buffers are transferred to the
 *  worker, so they are detached on return: hand in fresh buffers for every call. */
export interface SttEngineBytes {
  wasm: ArrayBuffer;
  model: ArrayBuffer;
}

export type SttEngineErrorCode =
  | SttWorkerErrorCode
  /** This browser cannot run the engine; `probe()` says why. */
  | "unsupported"
  /** Two crashes this page session. */
  | "disabled"
  /** A clip is already in flight. */
  | "busy"
  /** The worker died: an `error` or `messageerror` event, or no answer to its boot. */
  | "crashed"
  /** The watchdog ran out. The worker was terminated, and this counts as a crash. */
  | "timeout"
  /** The caller's signal, `pagehide` or `dispose` ended the clip. */
  | "aborted"
  /** `getBytes` rejected. */
  | "bytes-failed";

export type SttEngineOutcome =
  | { ok: true; text: string; language: string }
  | { ok: false; code: SttEngineErrorCode };

export type SttProbe =
  | { ok: true }
  | { ok: false; reason: SttUnsupportedReason | "crashed" | "disabled" | "aborted" };

/** The part of `Worker` the engine uses, so a test can hand in a fake. */
export interface SttWorkerLike {
  postMessage: (message: SttWorkerRequest, transfer: Transferable[]) => void;
  terminate: () => void;
  addEventListener: {
    (type: "message", listener: (event: MessageEvent) => void): void;
    (type: "error" | "messageerror", listener: () => void): void;
  };
}

/** Run `fn` after `ms`; the return value cancels it. */
export type SttTimer = (ms: number, fn: () => void) => () => void;

export interface SttEngineOptions {
  getBytes: () => Promise<SttEngineBytes>;
  /** Defaults to the real worker from its built URL. */
  createWorker?: () => SttWorkerLike;
  /** Defaults to `setTimeout`. */
  timer?: SttTimer;
  /** Subscribe to `pagehide`; returns the unsubscribe. Defaults to the window's event. */
  onPageHide?: (fn: () => void) => () => void;
}

export interface SttEngine {
  /** Start the worker if none runs, and answer whether it can run the engine. */
  probe: () => Promise<SttProbe>;
  /** Transcribe 16 kHz mono PCM. The array's buffer is transferred, so it is detached on return. */
  transcribe: (pcm: Float32Array, options?: { signal?: AbortSignal }) => Promise<SttEngineOutcome>;
  /** True once two crashes have switched the engine off for the page session. */
  disabled: () => boolean;
  /** Terminate the worker and stop listening. The engine can still start a new worker afterwards. */
  dispose: () => void;
}

export const STT_SAMPLE_RATE = 16_000;
/** No answer to the boot probe in this long is a crash. */
export const PROBE_DEADLINE_MS = 20_000;
/** Hashing 17 MB and compiling 1 MB takes well under a second on a phone; a minute is a hang. */
export const LOAD_DEADLINE_MS = 60_000;
export const IDLE_TERMINATE_MS = 60_000;
export const CRASH_LIMIT = 2;

/** The watchdog for one clip: half its length, at least a minute, at most three. */
export function transcribeDeadlineMs(samples: number): number {
  const clipSeconds = samples / STT_SAMPLE_RATE;
  return Math.min(180_000, Math.max(60_000, Math.round(clipSeconds * 500)));
}

function spawnWorker(): SttWorkerLike {
  return new Worker(new URL("../stt/worker.ts", import.meta.url), { type: "classic", name: "collie-stt" });
}

/** The placeholder a probe resolver holds for the instant before its promise exists. */
function ignoreProbe(): void {}

function realTimer(ms: number, fn: () => void): () => void {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
}

function windowPageHide(fn: () => void): () => void {
  window.addEventListener("pagehide", fn);
  return () => window.removeEventListener("pagehide", fn);
}

const WORKER_ERROR_CODES: ReadonlySet<string> = new Set<SttWorkerErrorCode>([
  "wasm-hash",
  "model-hash",
  "load-failed",
  "not-loaded",
  "oom",
  "transcribe-failed",
  "bad-request",
]);

/** The worker's answer, checked field by field with lib/json.ts's tag checks, which hold whatever
 *  the inbound type claims. Anything else is dropped as if it never came. */
function parseReply(inbound: SttPageInbound | null): SttWorkerReply | null {
  const id = asJsonNumber(inbound?.id);
  switch (inbound?.type) {
    case "ready":
      return { type: "ready" };
    case "unsupported": {
      const reason = asJsonString(inbound.reason);
      return reason === "wasm-csp" || reason === "glue-failed" ? { type: "unsupported", reason } : null;
    }
    case "loaded":
      return id === undefined ? null : { type: "loaded", id };
    case "result": {
      const text = asJsonString(inbound.text);
      const language = asJsonString(inbound.language);
      return id === undefined || text === undefined || language === undefined
        ? null
        : { type: "result", id, text, language };
    }
    case "error": {
      const code = asJsonString(inbound.code);
      if (id === undefined || code === undefined || !WORKER_ERROR_CODES.has(code)) return null;
      // SAFETY: membership in WORKER_ERROR_CODES is exactly the SttWorkerErrorCode union.
      return { type: "error", id, code: code as SttWorkerErrorCode };
    }
    default:
      return null;
  }
}

function probeFailureCode(reason: Extract<SttProbe, { ok: false }>["reason"]): SttEngineErrorCode {
  switch (reason) {
    case "wasm-csp":
    case "glue-failed":
      return "unsupported";
    case "disabled":
    case "crashed":
    case "aborted":
      return reason;
  }
}

type Settle = { kind: "reply"; reply: SttWorkerReply } | { kind: "end"; code: "crashed" | "timeout" | "aborted" };

/** One live worker and what it is waiting for. Replaced, never reused, once it is killed. */
interface Live {
  worker: SttWorkerLike;
  probe: Promise<SttProbe>;
  loaded: boolean;
  dead: boolean;
  /** The boot probe's resolver, until `ready` or `unsupported` arrives. */
  settleProbe: ((probe: SttProbe) => void) | null;
  /** The one request in flight. */
  pending: { id: number; settle: (outcome: Settle) => void; cancelTimer: () => void } | null;
  unsubscribePageHide: () => void;
}

export function createSttEngine(options: SttEngineOptions): SttEngine {
  const createWorker = options.createWorker ?? spawnWorker;
  const timer = options.timer ?? realTimer;
  const onPageHide = options.onPageHide ?? windowPageHide;

  let live: Live | null = null;
  let nextId = 1;
  let crashes = 0;
  let unsupported: SttUnsupportedReason | null = null;
  let inFlight = false;
  let cancelIdle: (() => void) | null = null;

  function disabled(): boolean {
    return crashes >= CRASH_LIMIT;
  }

  function clearIdle(): void {
    cancelIdle?.();
    cancelIdle = null;
  }

  function armIdle(): void {
    clearIdle();
    if (live === null) return;
    cancelIdle = timer(IDLE_TERMINATE_MS, () => {
      cancelIdle = null;
      if (!inFlight) kill(null);
    });
  }

  /** Terminate the live worker. `end` names what the request in flight, if any, ends with; a
   *  `crashed` or `timeout` end counts toward the limit. */
  function kill(end: "crashed" | "timeout" | "aborted" | null): void {
    const current = live;
    if (current === null) return;
    live = null;
    clearIdle();
    current.dead = true;
    current.unsubscribePageHide();
    current.worker.terminate();
    if (end === "crashed" || end === "timeout") crashes += 1;
    current.settleProbe?.({ ok: false, reason: end === "crashed" || end === "timeout" ? "crashed" : "aborted" });
    current.settleProbe = null;
    const pending = current.pending;
    current.pending = null;
    if (pending !== null) {
      pending.cancelTimer();
      pending.settle({ kind: "end", code: end ?? "aborted" });
    }
  }

  function start(): Live {
    const worker = createWorker();
    let settleProbe: (probe: SttProbe) => void = ignoreProbe;
    const probe = new Promise<SttProbe>((resolve) => {
      settleProbe = resolve;
    });
    const current: Live = {
      worker,
      probe,
      loaded: false,
      dead: false,
      settleProbe,
      pending: null,
      unsubscribePageHide: () => {},
    };
    live = current;
    const cancelProbeTimer = timer(PROBE_DEADLINE_MS, () => {
      if (current.settleProbe !== null && live === current) kill("crashed");
    });

    worker.addEventListener("message", (event) => {
      if (current.dead) return;
      // SAFETY: `MessageEvent.data` is `any`, a structured clone from this engine's own worker.
      // SttPageInbound makes every field optional, and parseReply checks each one by its tag.
      const reply = parseReply(event.data as SttPageInbound | null);
      if (reply === null) return;
      if (reply.type === "ready" || reply.type === "unsupported") {
        if (current.settleProbe === null) return;
        cancelProbeTimer();
        const settle = current.settleProbe;
        current.settleProbe = null;
        if (reply.type === "ready") {
          settle({ ok: true });
          return;
        }
        // A fact about this browser, so it holds for the rest of the page session.
        unsupported = reply.reason;
        settle({ ok: false, reason: reply.reason });
        kill(null);
        return;
      }
      const pending = current.pending;
      // An answer to a request this engine stopped waiting for, or never sent: dropped.
      if (pending === null || reply.id !== pending.id) return;
      current.pending = null;
      pending.cancelTimer();
      pending.settle({ kind: "reply", reply });
    });
    const crashed = (): void => {
      if (current.dead) return;
      cancelProbeTimer();
      kill("crashed");
    };
    worker.addEventListener("error", crashed);
    worker.addEventListener("messageerror", crashed);
    current.unsubscribePageHide = onPageHide(() => kill("aborted"));
    return current;
  }

  /** Send one request and wait for its answer, the watchdog, or the worker's end. */
  function request(current: Live, message: SttWorkerRequest, transfer: Transferable[], deadlineMs: number): Promise<Settle> {
    return new Promise<Settle>((resolve) => {
      const cancelTimer = timer(deadlineMs, () => {
        if (current.pending?.id === message.id) kill("timeout");
      });
      current.pending = { id: message.id, settle: resolve, cancelTimer };
      current.worker.postMessage(message, transfer);
    });
  }

  function probeReason(): SttProbe | null {
    if (unsupported !== null) return { ok: false, reason: unsupported };
    if (disabled()) return { ok: false, reason: "disabled" };
    return null;
  }

  async function ensureProbed(): Promise<{ probe: SttProbe; current: Live | null }> {
    const refused = probeReason();
    if (refused !== null) return { probe: refused, current: null };
    const current = live ?? start();
    const probe = await current.probe;
    return { probe, current: probe.ok && !current.dead ? current : null };
  }

  /** The end of a request as an outcome, or `null` when the worker answered something to go on with.
   *  Any worker error recycles the worker: after an engine error its module is gone or unknown. */
  function endOf(settled: Settle): SttEngineOutcome | null {
    if (settled.kind === "end") return { ok: false, code: settled.code };
    if (settled.reply.type === "error") {
      kill(null);
      return { ok: false, code: settled.reply.code };
    }
    return null;
  }

  async function run(pcm: Float32Array, signal: AbortSignal | undefined): Promise<SttEngineOutcome> {
    const { probe, current } = await ensureProbed();
    if (signal?.aborted) return { ok: false, code: "aborted" };
    if (!probe.ok) return { ok: false, code: probeFailureCode(probe.reason) };
    // Ready, and gone before the clip could start: only an abort does that.
    if (current === null) return { ok: false, code: "aborted" };

    if (!current.loaded) {
      let bytes: SttEngineBytes;
      try {
        bytes = await options.getBytes();
      } catch {
        return { ok: false, code: "bytes-failed" };
      }
      if (current.dead) return { ok: false, code: "aborted" };
      const id = nextId++;
      const settled = await request(
        current,
        { type: "load", id, wasm: bytes.wasm, model: bytes.model },
        [bytes.wasm, bytes.model],
        LOAD_DEADLINE_MS,
      );
      const ended = endOf(settled);
      if (ended !== null) return ended;
      if (settled.kind !== "reply" || settled.reply.type !== "loaded") {
        kill(null);
        return { ok: false, code: "load-failed" };
      }
      current.loaded = true;
    }

    if (current.dead) return { ok: false, code: "aborted" };
    const id = nextId++;
    const settled = await request(current, { type: "transcribe", id, pcm }, [pcm.buffer], transcribeDeadlineMs(pcm.length));
    const ended = endOf(settled);
    if (ended !== null) return ended;
    if (settled.kind !== "reply" || settled.reply.type !== "result") {
      kill(null);
      return { ok: false, code: "transcribe-failed" };
    }
    return { ok: true, text: settled.reply.text, language: settled.reply.language };
  }

  return {
    async probe() {
      const { probe } = await ensureProbed();
      if (!inFlight) armIdle();
      return probe;
    },
    async transcribe(pcm, transcribeOptions) {
      const refused = probeReason();
      if (refused !== null) return { ok: false, code: disabled() && unsupported === null ? "disabled" : "unsupported" };
      if (inFlight) return { ok: false, code: "busy" };
      inFlight = true;
      clearIdle();
      const signal = transcribeOptions?.signal;
      const onAbort = (): void => kill("aborted");
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        return await run(pcm, signal);
      } finally {
        signal?.removeEventListener("abort", onAbort);
        inFlight = false;
        armIdle();
      }
    },
    disabled,
    dispose() {
      kill("aborted");
    },
  };
}
