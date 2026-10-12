import { describe, expect, it } from "vitest";

import type { JsonObject } from "@/lib/json";
import type { SttWorkerRequest } from "@/stt/protocol";
import {
  CRASH_LIMIT,
  IDLE_TERMINATE_MS,
  LOAD_DEADLINE_MS,
  PROBE_DEADLINE_MS,
  createSttEngine,
  transcribeDeadlineMs,
  type SttEngineBytes,
  type SttWorkerLike,
} from "./stt-engine";

/** A worker that records what the page sends and answers only when the test says so. */
class FakeWorker implements SttWorkerLike {
  sent: { message: SttWorkerRequest; transfer: Transferable[] }[] = [];
  terminated = false;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  postMessage(message: SttWorkerRequest, transfer: Transferable[]): void {
    this.sent.push({ message, transfer });
  }
  terminate(): void {
    this.terminated = true;
  }
  addEventListener(type: "message" | "error" | "messageerror", listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  /** Post from the worker: what a structured clone can carry, including what the protocol refuses. */
  emit(data: JsonObject): void {
    for (const listener of this.listeners.get("message") ?? []) listener(new MessageEvent("message", { data }));
  }
  fire(type: "error" | "messageerror"): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type));
  }
  last(): SttWorkerRequest {
    const entry = this.sent.at(-1);
    if (entry === undefined) throw new Error("nothing sent");
    return entry.message;
  }
}

/** A clock the test turns by hand, behind the engine's timer seam. */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    timer(ms: number, fn: () => void): () => void {
      seq += 1;
      const id = seq;
      timers.set(id, { at: now + ms, fn });
      return () => timers.delete(id);
    },
    advance(ms: number): void {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | null = null;
        for (const entry of timers) if (entry[1].at <= end && (next === null || entry[1].at < next[1].at)) next = entry;
        if (next === null) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(options: { getBytes?: () => Promise<SttEngineBytes> } = {}) {
  const workers: FakeWorker[] = [];
  const clock = fakeClock();
  let pageHide: (() => void) | null = null;
  let bytesAsked = 0;
  const engine = createSttEngine({
    getBytes:
      options.getBytes ??
      (() => {
        bytesAsked += 1;
        return Promise.resolve({ wasm: new ArrayBuffer(4), model: new ArrayBuffer(8) });
      }),
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    timer: (ms, fn) => clock.timer(ms, fn),
    onPageHide: (fn) => {
      pageHide = fn;
      return () => {
        if (pageHide === fn) pageHide = null;
      };
    },
  });
  const worker = (index = workers.length - 1): FakeWorker => {
    const found = workers[index];
    if (found === undefined) throw new Error(`no worker ${String(index)}`);
    return found;
  };
  return {
    engine,
    workers,
    worker,
    clock,
    hidePage: () => pageHide?.(),
    bytesAsked: () => bytesAsked,
  };
}

/** Drive one clip through boot, load and transcribe, answering each step. */
async function fullClip(t: ReturnType<typeof setup>, text = "hello") {
  const outcome = t.engine.transcribe(new Float32Array(16_000));
  await flush();
  t.worker().emit({ type: "ready" });
  await flush();
  const load = t.worker().last();
  t.worker().emit({ type: "loaded", id: load.id });
  await flush();
  const run = t.worker().last();
  t.worker().emit({ type: "result", id: run.id, text, language: "en" });
  return outcome;
}

describe("transcribeDeadlineMs", () => {
  it("is half the clip, at least a minute, at most three", () => {
    expect(transcribeDeadlineMs(10 * 16_000)).toBe(60_000);
    expect(transcribeDeadlineMs(200 * 16_000)).toBe(100_000);
    expect(transcribeDeadlineMs(400 * 16_000)).toBe(180_000);
  });
});

describe("the protocol", () => {
  it("boots, loads once with both buffers transferred, then transcribes with the PCM transferred", async () => {
    const t = setup();
    const pcm = new Float32Array(16_000);
    const outcome = t.engine.transcribe(pcm);
    await flush();
    expect(t.workers).toHaveLength(1);
    expect(t.worker().sent).toHaveLength(0);
    t.worker().emit({ type: "ready" });
    await flush();

    const load = t.worker().sent[0];
    expect(load?.message.type).toBe("load");
    if (load?.message.type !== "load") throw new Error("expected load");
    expect(load.transfer).toEqual([load.message.wasm, load.message.model]);
    t.worker().emit({ type: "loaded", id: load.message.id });
    await flush();

    const run = t.worker().sent[1];
    if (run?.message.type !== "transcribe") throw new Error("expected transcribe");
    expect(run.message.pcm).toBe(pcm);
    expect(run.transfer).toEqual([pcm.buffer]);
    expect(run.message.id).not.toBe(load.message.id);
    t.worker().emit({ type: "result", id: run.message.id, text: "hello", language: "en" });
    await expect(outcome).resolves.toEqual({ ok: true, text: "hello", language: "en" });

    // The same worker, already loaded: no second load and no second ask for the bytes.
    const second = t.engine.transcribe(new Float32Array(8));
    await flush();
    expect(t.worker().last().type).toBe("transcribe");
    t.worker().emit({ type: "result", id: t.worker().last().id, text: "again", language: "de" });
    await expect(second).resolves.toEqual({ ok: true, text: "again", language: "de" });
    expect(t.bytesAsked()).toBe(1);
    expect(t.workers).toHaveLength(1);
  });

  it("probes once, and remembers an unsupported browser without making another worker", async () => {
    const t = setup();
    const probe = t.engine.probe();
    await flush();
    t.worker().emit({ type: "unsupported", reason: "wasm-csp" });
    await expect(probe).resolves.toEqual({ ok: false, reason: "wasm-csp" });
    expect(t.worker().terminated).toBe(true);
    await expect(t.engine.transcribe(new Float32Array(8))).resolves.toEqual({ ok: false, code: "unsupported" });
    await expect(t.engine.probe()).resolves.toEqual({ ok: false, reason: "wasm-csp" });
    expect(t.workers).toHaveLength(1);
  });

  it("passes a worker's error code through and recycles the worker, without counting a crash", async () => {
    const t = setup();
    for (let round = 0; round < CRASH_LIMIT + 1; round++) {
      const outcome = t.engine.transcribe(new Float32Array(8));
      await flush();
      t.worker().emit({ type: "ready" });
      await flush();
      t.worker().emit({ type: "error", id: t.worker().last().id, code: "model-hash" });
      await expect(outcome).resolves.toEqual({ ok: false, code: "model-hash" });
      expect(t.worker().terminated).toBe(true);
    }
    expect(t.workers).toHaveLength(CRASH_LIMIT + 1);
  });

  it("answers bytes-failed when the caller cannot hand the bytes in", async () => {
    const t = setup({ getBytes: () => Promise.reject(new Error("no model")) });
    const outcome = t.engine.transcribe(new Float32Array(8));
    await flush();
    t.worker().emit({ type: "ready" });
    await expect(outcome).resolves.toEqual({ ok: false, code: "bytes-failed" });
  });

  it("drops an answer with a stale or unknown id, and a reply that is not the protocol", async () => {
    const t = setup();
    const outcome = t.engine.transcribe(new Float32Array(8));
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    const load = t.worker().last();
    t.worker().emit({ type: "loaded", id: load.id + 100 });
    t.worker().emit({ type: "loaded" });
    t.worker().emit({ type: "error", id: load.id, code: "rm -rf" });
    await flush();
    expect(t.worker().sent).toHaveLength(1);
    t.worker().emit({ type: "loaded", id: load.id });
    await flush();
    const run = t.worker().last();
    t.worker().emit({ type: "result", id: load.id, text: "stale", language: "en" });
    t.worker().emit({ type: "result", id: run.id, text: 42, language: "en" });
    t.worker().emit({ type: "result", id: run.id, text: "fresh", language: "en" });
    await expect(outcome).resolves.toEqual({ ok: true, text: "fresh", language: "en" });
  });

  it("answers busy to a second clip while one is in flight", async () => {
    const t = setup();
    const first = t.engine.transcribe(new Float32Array(8));
    await expect(t.engine.transcribe(new Float32Array(8))).resolves.toEqual({ ok: false, code: "busy" });
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    t.worker().emit({ type: "loaded", id: t.worker().last().id });
    await flush();
    t.worker().emit({ type: "result", id: t.worker().last().id, text: "one", language: "en" });
    await expect(first).resolves.toEqual({ ok: true, text: "one", language: "en" });
  });
});

describe("the watchdog", () => {
  it("terminates the worker when a clip runs past its deadline, and a late answer is dropped", async () => {
    const t = setup();
    const outcome = t.engine.transcribe(new Float32Array(10 * 16_000));
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    t.worker().emit({ type: "loaded", id: t.worker().last().id });
    await flush();
    const run = t.worker().last();
    t.clock.advance(59_999);
    expect(t.worker().terminated).toBe(false);
    t.clock.advance(1);
    expect(t.worker().terminated).toBe(true);
    await expect(outcome).resolves.toEqual({ ok: false, code: "timeout" });
    t.worker().emit({ type: "result", id: run.id, text: "late", language: "en" });
    await flush();
  });

  it("gives the load its own deadline", async () => {
    const t = setup();
    const outcome = t.engine.transcribe(new Float32Array(8));
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    t.clock.advance(LOAD_DEADLINE_MS);
    await expect(outcome).resolves.toEqual({ ok: false, code: "timeout" });
    expect(t.worker().terminated).toBe(true);
  });

  it("counts a worker that never answers its boot as a crash", async () => {
    const t = setup();
    const probe = t.engine.probe();
    await flush();
    t.clock.advance(PROBE_DEADLINE_MS);
    await expect(probe).resolves.toEqual({ ok: false, reason: "crashed" });
    expect(t.worker().terminated).toBe(true);
  });
});

describe("crashes", () => {
  it("turns the engine off for the page session after two", async () => {
    const t = setup();
    const first = t.engine.transcribe(new Float32Array(8));
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    t.worker().fire("error");
    await expect(first).resolves.toEqual({ ok: false, code: "crashed" });
    expect(t.worker().terminated).toBe(true);
    expect(t.engine.disabled()).toBe(false);

    const second = t.engine.transcribe(new Float32Array(8));
    await flush();
    expect(t.workers).toHaveLength(2);
    t.worker().fire("messageerror");
    await expect(second).resolves.toEqual({ ok: false, code: "crashed" });
    expect(t.engine.disabled()).toBe(true);

    await expect(t.engine.transcribe(new Float32Array(8))).resolves.toEqual({ ok: false, code: "disabled" });
    await expect(t.engine.probe()).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(t.workers).toHaveLength(2);
  });

  it("counts a timeout toward the limit", async () => {
    const t = setup();
    for (let round = 0; round < CRASH_LIMIT; round++) {
      const outcome = t.engine.transcribe(new Float32Array(8));
      await flush();
      t.worker().emit({ type: "ready" });
      await flush();
      t.clock.advance(LOAD_DEADLINE_MS);
      await expect(outcome).resolves.toEqual({ ok: false, code: "timeout" });
    }
    await expect(t.engine.transcribe(new Float32Array(8))).resolves.toEqual({ ok: false, code: "disabled" });
  });
});

describe("terminate on idle, on pagehide, on abort", () => {
  it("terminates after a minute of idle, and the next clip starts and loads a new worker", async () => {
    const t = setup();
    await expect(fullClip(t)).resolves.toEqual({ ok: true, text: "hello", language: "en" });
    t.clock.advance(IDLE_TERMINATE_MS - 1);
    expect(t.worker(0).terminated).toBe(false);
    t.clock.advance(1);
    expect(t.worker(0).terminated).toBe(true);

    await expect(fullClip(t, "again")).resolves.toEqual({ ok: true, text: "again", language: "en" });
    expect(t.workers).toHaveLength(2);
    expect(t.bytesAsked()).toBe(2);
  });

  it("terminates an idle worker after a probe too", async () => {
    const t = setup();
    const probe = t.engine.probe();
    await flush();
    t.worker().emit({ type: "ready" });
    await expect(probe).resolves.toEqual({ ok: true });
    t.clock.advance(IDLE_TERMINATE_MS);
    expect(t.worker().terminated).toBe(true);
  });

  it("terminates on pagehide, ends the clip as aborted, and does not count it as a crash", async () => {
    const t = setup();
    for (let round = 0; round < CRASH_LIMIT + 1; round++) {
      const outcome = t.engine.transcribe(new Float32Array(8));
      await flush();
      t.worker().emit({ type: "ready" });
      await flush();
      t.hidePage();
      await expect(outcome).resolves.toEqual({ ok: false, code: "aborted" });
      expect(t.worker().terminated).toBe(true);
    }
    expect(t.workers).toHaveLength(CRASH_LIMIT + 1);
  });

  it("terminates when the caller's signal aborts", async () => {
    const t = setup();
    const controller = new AbortController();
    const outcome = t.engine.transcribe(new Float32Array(8), { signal: controller.signal });
    await flush();
    t.worker().emit({ type: "ready" });
    await flush();
    t.worker().emit({ type: "loaded", id: t.worker().last().id });
    await flush();
    controller.abort();
    await expect(outcome).resolves.toEqual({ ok: false, code: "aborted" });
    expect(t.worker().terminated).toBe(true);
  });

  it("dispose terminates the worker", async () => {
    const t = setup();
    void t.engine.probe();
    await flush();
    t.engine.dispose();
    expect(t.worker().terminated).toBe(true);
  });
});
