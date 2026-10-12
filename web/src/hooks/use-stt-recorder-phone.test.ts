import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SttResult } from "@/lib/api";
import { t } from "@/lib/i18n";
import { __resetSttEngine, sttProbeState, type PhoneTranscript } from "@/lib/stt";
import type { SttCapability } from "@/lib/types";
import { FakeMediaRecorder, installFakeMediaRecorder, uninstallFakeMediaRecorder } from "@/test/media-recorder";

import { useSttRecorder, type SttRecorder } from "./use-stt-recorder";

// ADR 0096: the recorder's second engine, the WAV upload to a `whistle` host, the recording caps, the
// "Send to host" action and the two-crash rule. The phone engine and the PCM conversion are doubles;
// what is pinned here is the wiring around them.

const api = vi.hoisted(() => ({ uploads: new Array<Blob>() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  transcribeAudio: (clip: Blob): Promise<SttResult> => {
    api.uploads.push(clip);
    return Promise.resolve({ ok: true, text: "from the host" });
  },
}));

const pcm = vi.hoisted(() => ({ toPcm16k: vi.fn(), encodeWav16: vi.fn() }));
vi.mock("@/lib/stt-pcm", () => pcm);

const phone = vi.hoisted(() => ({ transcribeOnPhone: vi.fn() }));
vi.mock("@/lib/stt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stt")>()),
  transcribeOnPhone: phone.transcribeOnPhone,
}));

vi.mock("@/lib/audio-meter", () => ({ createAudioMeter: () => null }));

const HOST: SttCapability = { provider: "openai-compatible", available: true };
const WHISTLE: SttCapability = {
  provider: "whistle",
  available: true,
  input: "wav-16k",
  maxDurationMs: 240_000,
};
const WAV = new Blob(["wav"], { type: "audio/wav" });
const SAMPLES = new Float32Array(8);

interface Options {
  engine: "host" | "phone";
  host: SttCapability | null;
  enabled: boolean;
}

function setup(initial: Partial<Options> = {}) {
  const onTranscript = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(
    (props: Options) =>
      useSttRecorder({
        enabled: props.enabled,
        engine: props.engine,
        host: props.host,
        paneKey: "a",
        suspended: false,
        onTranscript,
        onError,
      }),
    { initialProps: { engine: "phone", host: HOST, enabled: true, ...initial } },
  );
  return { ...hook, onTranscript, onError };
}

async function record(result: { current: SttRecorder }) {
  act(() => result.current.start());
  await waitFor(() => expect(result.current.phase).toBe("recording"));
  const recorder = FakeMediaRecorder.instances.at(-1)!;
  act(() => recorder.finish());
  return recorder;
}

const failedClip = (message = "The speech engine stopped."): PhoneTranscript => ({ ok: false, message });

beforeEach(() => {
  installFakeMediaRecorder();
  api.uploads = [];
  pcm.toPcm16k.mockReset().mockResolvedValue(SAMPLES);
  pcm.encodeWav16.mockReset().mockReturnValue(WAV);
  phone.transcribeOnPhone.mockReset();
  __resetSttEngine();
});
afterEach(() => {
  uninstallFakeMediaRecorder();
  vi.restoreAllMocks();
});

describe("the phone engine", () => {
  it("decodes the clip, transcribes it on the phone, and never calls the host", async () => {
    phone.transcribeOnPhone.mockResolvedValue({ ok: true, text: "  hello there  " });
    const { result, onTranscript, onError } = setup();
    await record(result);
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("hello there"));
    expect(pcm.toPcm16k).toHaveBeenCalledTimes(1);
    expect(phone.transcribeOnPhone).toHaveBeenCalledWith(SAMPLES, expect.any(AbortSignal));
    expect(api.uploads).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("says the clip runs on this phone while it transcribes, and keeps the engine for that clip", async () => {
    let finish: (value: PhoneTranscript) => void = () => {};
    phone.transcribeOnPhone.mockReturnValue(new Promise<PhoneTranscript>((resolve) => (finish = resolve)));
    const { result, rerender } = setup();
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("transcribing"));
    expect(result.current.engine).toBe("phone");
    // A change of preference mid-clip does not move the clip.
    rerender({ engine: "host", host: HOST, enabled: true });
    expect(result.current.engine).toBe("phone");
    await act(async () => finish({ ok: true, text: "x" }));
  });

  it("answers an empty transcript with the 'nothing heard' message", async () => {
    phone.transcribeOnPhone.mockResolvedValue({ ok: true, text: "   " });
    const { result, onTranscript, onError } = setup();
    await record(result);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(t("stt.error.noSpeechHeard")));
    expect(onTranscript).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("records for five minutes on the phone, whatever the host provider's cap", async () => {
    const delays = vi.spyOn(globalThis, "setTimeout");
    const { result } = setup({ host: WHISTLE });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.phase).toBe("recording"));
    expect(delays.mock.calls.map(([, ms]) => ms)).toContain(300_000);
    expect(delays.mock.calls.map(([, ms]) => ms)).not.toContain(240_000);
  });

  it("keeps the takeover open with the sentence when the phone cannot read the recording", async () => {
    pcm.toPcm16k.mockRejectedValue(new Error("undecodable"));
    const { result, onError } = setup();
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.failure).toBe(t("stt.error.phone.undecodable"));
    expect(phone.transcribeOnPhone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(api.uploads).toHaveLength(0);
  });
});

describe("a failed phone clip and Send to host", () => {
  it("stays failed, uploads nothing by itself, and offers the host only when it can serve", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    const { result } = setup({ host: HOST });
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.failure).toBe("The speech engine stopped.");
    expect(result.current.canSendToHost).toBe(true);
    await act(async () => {});
    expect(api.uploads).toHaveLength(0);
  });

  it("offers no host when the provider is absent or unavailable, and sendToHost does nothing", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    for (const host of [null, { ...HOST, available: false, reason: "no key" }]) {
      const { result, unmount } = setup({ host });
      await record(result);
      await waitFor(() => expect(result.current.phase).toBe("failed"));
      expect(result.current.canSendToHost).toBe(false);
      act(() => result.current.sendToHost());
      expect(result.current.phase).toBe("failed");
      expect(api.uploads).toHaveLength(0);
      unmount();
    }
  });

  it("uploads the original recording once, and hands the transcript over like any other", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    const { result, onTranscript } = setup({ host: HOST });
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));

    act(() => result.current.sendToHost());
    act(() => result.current.sendToHost());
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("from the host"));
    expect(api.uploads).toHaveLength(1);
    expect(api.uploads[0]?.type).toMatch(/^audio\/webm/);
    expect(pcm.encodeWav16).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("uploads a WAV when the host provider is whistle", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    const { result, onTranscript } = setup({ host: WHISTLE });
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    pcm.toPcm16k.mockClear();

    act(() => result.current.sendToHost());
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("from the host"));
    expect(pcm.toPcm16k).toHaveBeenCalledTimes(1);
    expect(pcm.encodeWav16).toHaveBeenCalledWith(SAMPLES);
    expect(api.uploads).toEqual([WAV]);
  });

  it("refuses to send a phone clip longer than the whistle cap, without an upload", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    const { result, onError } = setup({ host: WHISTLE });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.phase).toBe("recording"));
    const started = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(started + 280_000);
    act(() => FakeMediaRecorder.instances.at(-1)!.finish());
    now.mockRestore();
    await waitFor(() => expect(result.current.phase).toBe("failed"));

    act(() => result.current.sendToHost());
    await waitFor(() => expect(onError).toHaveBeenCalledWith(t("stt.error.tooLong")));
    expect(api.uploads).toHaveLength(0);
    expect(result.current.phase).toBe("idle");
  });

  it("drops the clip when the person throws it away", async () => {
    phone.transcribeOnPhone.mockResolvedValue(failedClip());
    const { result } = setup({ host: HOST });
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    act(() => result.current.discard());
    expect(result.current.phase).toBe("idle");
    expect(result.current.failure).toBeNull();
    act(() => result.current.sendToHost());
    expect(api.uploads).toHaveLength(0);
  });
});

describe("two crashes in a page session", () => {
  it("note the probe after the sentence is up, and the sentence survives the engine going off", async () => {
    phone.transcribeOnPhone.mockResolvedValue({
      ok: false,
      message: t("stt.error.phone.disabled"),
      probe: { ok: false, reason: "disabled" },
    });
    const { result, rerender } = setup({ host: null });
    await record(result);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(sttProbeState()).toBe("crashed");
    expect(result.current.failure).toBe(t("stt.error.phone.disabled"));

    // The composer reacts to that by turning the microphone off. The sentence stays.
    rerender({ engine: "host", host: null, enabled: false });
    await act(async () => {});
    expect(result.current.phase).toBe("failed");
    expect(result.current.failure).toBe(t("stt.error.phone.disabled"));
  });
});

describe("the host engine with a whistle provider", () => {
  it("uploads a 16 kHz WAV instead of the recording, built with toPcm16k and encodeWav16", async () => {
    const { result, onTranscript } = setup({ engine: "host", host: WHISTLE });
    await record(result);
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("from the host"));
    expect(pcm.toPcm16k).toHaveBeenCalledTimes(1);
    expect(pcm.encodeWav16).toHaveBeenCalledWith(SAMPLES);
    expect(api.uploads).toHaveLength(1);
    expect(api.uploads[0]).toBe(WAV);
    expect(api.uploads[0]?.type).toBe("audio/wav");
    expect(phone.transcribeOnPhone).not.toHaveBeenCalled();
  });

  it("says so, and uploads nothing, when the recording cannot be converted", async () => {
    pcm.toPcm16k.mockRejectedValue(new Error("undecodable"));
    const { result, onError } = setup({ engine: "host", host: WHISTLE });
    await record(result);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(t("stt.error.phone.undecodable")));
    expect(api.uploads).toHaveLength(0);
  });

  it("records for four minutes", async () => {
    const delays = vi.spyOn(globalThis, "setTimeout");
    const { result } = setup({ engine: "host", host: WHISTLE });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.phase).toBe("recording"));
    expect(delays.mock.calls.map(([, ms]) => ms)).toContain(240_000);
  });

  it("uploads the recording unchanged for any other provider, and records for five minutes", async () => {
    const delays = vi.spyOn(globalThis, "setTimeout");
    const { result, onTranscript } = setup({ engine: "host", host: HOST });
    await record(result);
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("from the host"));
    expect(pcm.toPcm16k).not.toHaveBeenCalled();
    expect(pcm.encodeWav16).not.toHaveBeenCalled();
    expect(api.uploads[0]?.type).toMatch(/^audio\/webm/);
    expect(delays.mock.calls.map(([, ms]) => ms)).toContain(300_000);
  });
});
