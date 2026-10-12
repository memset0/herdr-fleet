import {
  SttAudioError,
  WHISTLE_HOST_MAX_DURATION_MS,
  decodeWav16,
  encodeWav16,
  toPcm16k,
  wavHeaderProblem,
  type PcmBuffer,
  type PcmDeps,
} from "./stt-pcm";

// The module turns a recording into the audio both speech engines take, and writes and reads the WAV
// the host provider takes. The WAV half is checked byte by byte, because the bridge mirrors those
// rules; the Web Audio half is checked against fakes, because jsdom has no AudioContext.

/** The error a promise rejects with; fails the test when it resolves or rejects with anything else. */
async function rejection(promise: Promise<unknown>): Promise<SttAudioError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SttAudioError) return error;
    throw error;
  }
  throw new Error("expected the promise to reject");
}

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

/** A 16 kHz mono WAV by hand, so a test does not lean on the encoder it checks. */
function wav(opts: {
  format?: number;
  channels?: number;
  rate?: number;
  bits?: number;
  samples?: number[];
  extraBefore?: Uint8Array[];
  riff?: string;
}): Uint8Array {
  const { format = 1, channels = 1, rate = 16000, bits = 16, samples = [0, 1000] } = opts;
  const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  const u16 = (n: number) => Uint8Array.of(n & 255, (n >> 8) & 255);
  const u32 = (n: number) => Uint8Array.of(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  const data = new Uint8Array(samples.length * 2);
  const dv = new DataView(data.buffer);
  samples.forEach((s, i) => dv.setInt16(i * 2, s, true));
  const fmt = [u16(format), u16(channels), u32(rate), u32(rate * channels * (bits / 8)), u16(channels * (bits / 8)), u16(bits)];
  const parts = [
    text("fmt "),
    u32(16),
    ...fmt,
    ...(opts.extraBefore ?? []),
    text("data"),
    u32(data.length),
    data,
  ];
  const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    body.set(p, at);
    at += p.length;
  }
  const out = new Uint8Array(12 + body.length);
  out.set(text(opts.riff ?? "RIFF"), 0);
  out.set(u32(4 + body.length), 4);
  out.set(text("WAVE"), 8);
  out.set(body, 12);
  return out;
}

describe("encodeWav16", () => {
  it("writes the exact 44-byte header and little-endian samples for a known input", async () => {
    const blob = encodeWav16(Float32Array.of(0, 1, -1));
    expect(blob.type).toBe("audio/wav");
    const bytes = await bytesOf(blob);
    const expected = [
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      42, 0, 0, 0, // 36 + 6
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      16, 0, 0, 0,
      1, 0, // PCM
      1, 0, // one channel
      0x80, 0x3e, 0, 0, // 16000
      0x00, 0x7d, 0, 0, // byte rate 32000
      2, 0, // block align
      16, 0, // bits
      0x64, 0x61, 0x74, 0x61, // "data"
      6, 0, 0, 0,
      0x00, 0x00, // 0
      0xff, 0x7f, // 32767
      0x00, 0x80, // -32768
    ];
    expect(Array.from(bytes)).toEqual(expected);
  });

  it("clamps out-of-range and non-finite samples", async () => {
    const bytes = await bytesOf(encodeWav16(Float32Array.of(2.5, -3, Number.NaN, Infinity, -Infinity)));
    const view = new DataView(bytes.buffer);
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 0, 32767, -32768]);
  });

  it("records the given sample rate", async () => {
    const bytes = await bytesOf(encodeWav16(new Float32Array(1), 8000));
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(8000);
  });
});

describe("decodeWav16", () => {
  it("round-trips within one 16-bit step", async () => {
    const pcm = new Float32Array(1000);
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i / 7) * 0.9;
    pcm[10] = 1;
    pcm[11] = -1;
    const back = decodeWav16(await bytesOf(encodeWav16(pcm)));
    expect(back.length).toBe(pcm.length);
    for (let i = 0; i < pcm.length; i++) expect(Math.abs(back[i]! - pcm[i]!)).toBeLessThanOrEqual(1 / 32768);
  });

  it("accepts an ArrayBuffer and a Uint8Array view with an offset", async () => {
    const bytes = await bytesOf(encodeWav16(Float32Array.of(0.5, -0.5)));
    const padded = new Uint8Array(bytes.length + 5);
    padded.set(bytes, 5);
    expect(decodeWav16(padded.subarray(5)).length).toBe(2);
    const copy = new ArrayBuffer(bytes.length);
    new Uint8Array(copy).set(bytes);
    expect(decodeWav16(copy).length).toBe(2);
  });

  it("finds the data chunk past an extra LIST chunk, including an odd-sized one", () => {
    const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
    // LIST, size 3, plus the pad byte RIFF requires after an odd-sized chunk.
    const list = [text("LIST"), Uint8Array.of(3, 0, 0, 0), Uint8Array.of(1, 2, 3, 0)];
    const out = decodeWav16(wav({ samples: [32767, -32768, 0], extraBefore: list }));
    expect(Array.from(out)).toEqual([1, -1, 0]);
  });

  it.each([
    ["stereo", { channels: 2 }, "not one channel"],
    ["44.1 kHz", { rate: 44100 }, "not 16000 Hz"],
    ["8-bit", { bits: 8 }, "not 16 bits per sample"],
    ["float PCM", { format: 3 }, "not PCM"],
    ["a RIFX file", { riff: "RIFX" }, "not a RIFF/WAVE file"],
    ["no samples", { samples: [] }, "the data chunk is empty"],
  ])("rejects %s", (_name, opts, problem) => {
    const bytes = wav(opts);
    expect(wavHeaderProblem(bytes)).toBe(problem);
    expect(() => decodeWav16(bytes)).toThrow(SttAudioError);
    expect(() => decodeWav16(bytes)).toThrow(expect.objectContaining({ code: "bad-wav" }));
  });

  it("rejects text, a short buffer and a data chunk that runs past the end", () => {
    expect(wavHeaderProblem(new TextEncoder().encode("not a wav at all"))).toBe("not a RIFF/WAVE file");
    expect(wavHeaderProblem(new Uint8Array(4))).toBe("not a RIFF/WAVE file");
    const good = wav({ samples: [1, 2, 3, 4] });
    expect(wavHeaderProblem(good)).toBeNull();
    expect(wavHeaderProblem(good.subarray(0, good.length - 2))).toBe("the data chunk is cut short");
    expect(wavHeaderProblem(good.subarray(0, 30))).toBe("the fmt chunk is too short");
    expect(wavHeaderProblem(good.subarray(0, 36))).toBe("no data chunk");
  });

  it("rejects data before fmt", () => {
    const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
    const bytes = new Uint8Array([...text("RIFF"), 20, 0, 0, 0, ...text("WAVE"), ...text("data"), 2, 0, 0, 0, 1, 0]);
    expect(wavHeaderProblem(bytes)).toBe("the data chunk comes before the fmt chunk");
  });
});

interface FakeLog {
  closed: number;
  decoded: ArrayBuffer[];
  offline: { channels: number; length: number; sampleRate: number } | null;
  sourceBuffer: PcmBuffer | null;
  started: boolean;
  connected: boolean;
}

/** Stands in for the offline context's destination node. */
interface FakeNode {
  readonly kind: "destination";
}

describe("toPcm16k", () => {
  /** Fakes that record what the module asked for. */
  function fakes(options: { duration?: number; decodeFails?: boolean; renderFails?: boolean } = {}) {
    const { duration = 1.5, decodeFails = false, renderFails = false } = options;
    const log: FakeLog = {
      closed: 0,
      decoded: [],
      offline: null,
      sourceBuffer: null,
      started: false,
      connected: false,
    };
    const channel = new Float32Array([0.1, 0.2, 0.3]);
    const decodedBuffer = { duration };
    const deps: PcmDeps<FakeNode> = {
      createContext: () => ({
        decodeAudioData: async (data) => {
          log.decoded.push(data);
          if (decodeFails) throw new DOMException("bad", "EncodingError");
          return decodedBuffer;
        },
        close: async () => {
          log.closed++;
        },
      }),
      createOfflineContext: (channels, length, sampleRate) => {
        log.offline = { channels, length, sampleRate };
        return {
          destination: { kind: "destination" },
          createBufferSource: () => ({
            set buffer(value: PcmBuffer | null) {
              log.sourceBuffer = value;
            },
            connect: () => {
              log.connected = true;
            },
            start: () => {
              log.started = true;
            },
          }),
          startRendering: async () => {
            if (renderFails) throw new Error("render failed");
            return { getChannelData: (i) => (i === 0 ? channel : new Float32Array()) };
          },
        };
      },
    };
    return { deps, log, channel, decodedBuffer };
  }

  it("renders one channel at 16 kHz for ceil(duration * 16000) frames and returns channel 0", async () => {
    const { deps, log, channel, decodedBuffer } = fakes({ duration: 1.00003 });
    const out = await toPcm16k(new Blob([Uint8Array.of(1, 2, 3, 4)]), deps);
    expect(out).toBe(channel);
    expect(log.offline).toEqual({ channels: 1, length: Math.ceil(1.00003 * 16000), sampleRate: 16000 });
    expect(log.offline!.length).toBe(16001);
    expect(new Uint8Array(log.decoded[0]!)).toEqual(Uint8Array.of(1, 2, 3, 4));
    expect(log.sourceBuffer).toBe(decodedBuffer);
    expect(log.connected && log.started).toBe(true);
    expect(log.closed).toBe(1);
  });

  it("rejects an undecodable blob with a typed error and still closes the context", async () => {
    const { deps, log } = fakes({ decodeFails: true });
    const error = await rejection(toPcm16k(new Blob([Uint8Array.of(9)]), deps));
    expect(error.code).toBe("undecodable");
    expect(log.offline).toBeNull();
    expect(log.closed).toBe(1);
  });

  it("closes the context when the render fails", async () => {
    const { deps, log } = fakes({ renderFails: true });
    await expect(toPcm16k(new Blob([Uint8Array.of(9)]), deps)).rejects.toThrow("render failed");
    expect(log.closed).toBe(1);
  });

  it("rejects empty audio, both an empty blob and a zero-length decode", async () => {
    const empty = fakes();
    expect((await rejection(toPcm16k(new Blob([]), empty.deps))).code).toBe("empty");

    const silent = fakes({ duration: 0 });
    expect((await rejection(toPcm16k(new Blob([Uint8Array.of(1)]), silent.deps))).code).toBe("empty");
    expect(silent.log.closed).toBe(1);
  });

  it("is unsupported without Web Audio", async () => {
    expect((await rejection(toPcm16k(new Blob([Uint8Array.of(1)])))).code).toBe("unsupported");
  });
});

describe("WHISTLE_HOST_MAX_DURATION_MS", () => {
  it("fits the 8 MiB upload cap at 32 KB/s", () => {
    expect((WHISTLE_HOST_MAX_DURATION_MS / 1000) * 32_000 + 44).toBeLessThan(8 * 1024 * 1024);
  });
});
