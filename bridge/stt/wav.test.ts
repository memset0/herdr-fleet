import { describe, expect, test } from "bun:test";
import { decodeWav16, encodeWav16, wavHeaderProblem } from "./wav.ts";

/** A header-only WAV with the given fmt fields and a data chunk of `dataBytes`. */
function wav(fields: { format?: number; channels?: number; rate?: number; bits?: number; dataBytes?: number } = {}) {
  const bytes = encodeWav16(new Float32Array((fields.dataBytes ?? 4) / 2));
  const view = new DataView(bytes.buffer);
  if (fields.format !== undefined) view.setUint16(20, fields.format, true);
  if (fields.channels !== undefined) view.setUint16(22, fields.channels, true);
  if (fields.rate !== undefined) view.setUint32(24, fields.rate, true);
  if (fields.bits !== undefined) view.setUint16(34, fields.bits, true);
  return bytes;
}

describe("wavHeaderProblem — the one WAV shape the Whistle engine takes", () => {
  test("a 16 kHz mono 16-bit PCM file passes", () => {
    expect(wavHeaderProblem(wav())).toBeNull();
  });

  test("every field the engine depends on is checked", () => {
    expect(wavHeaderProblem(wav({ format: 3 }))).toBe("not PCM");
    expect(wavHeaderProblem(wav({ channels: 2 }))).toBe("not one channel");
    expect(wavHeaderProblem(wav({ rate: 44_100 }))).toBe("not 16000 Hz");
    expect(wavHeaderProblem(wav({ bits: 24 }))).toBe("not 16 bits per sample");
  });

  test("not RIFF, too short, or a webm is refused", () => {
    expect(wavHeaderProblem(new Uint8Array(4))).toBe("not a RIFF/WAVE file");
    expect(wavHeaderProblem(new TextEncoder().encode("RIFF....AVI LIST"))).toBe("not a RIFF/WAVE file");
    expect(wavHeaderProblem(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("not a RIFF/WAVE file");
  });

  test("the data chunk must fit, be non-empty and hold whole samples", () => {
    const empty = encodeWav16(new Float32Array(0));
    expect(wavHeaderProblem(empty)).toBe("the data chunk is empty");

    const streamed = wav();
    new DataView(streamed.buffer).setUint32(40, 0xffffffff, true);
    expect(wavHeaderProblem(streamed)).toBe("the data chunk is cut short");

    const odd = new Uint8Array(wav({ dataBytes: 4 }).buffer.slice(0, 47));
    new DataView(odd.buffer).setUint32(40, 3, true);
    expect(wavHeaderProblem(odd)).toBe("the data chunk is not whole samples");
  });

  test("chunks are walked with their padding, and data before fmt is refused", () => {
    // RIFF WAVE, then a 3-byte LIST chunk (padded to 4), then fmt, then data.
    const base = wav({ dataBytes: 4 });
    const extra = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 3, 0, 0, 0, 1, 2, 3, 0]);
    const walked = new Uint8Array(base.byteLength + extra.byteLength);
    walked.set(base.subarray(0, 12), 0);
    walked.set(extra, 12);
    walked.set(base.subarray(12), 12 + extra.byteLength);
    expect(wavHeaderProblem(walked)).toBeNull();

    const swapped = new Uint8Array(base.byteLength);
    swapped.set(base.subarray(0, 12), 0);
    swapped.set(base.subarray(36), 12);
    swapped.set(base.subarray(12, 36), 12 + base.byteLength - 36);
    expect(wavHeaderProblem(swapped)).toBe("the data chunk comes before the fmt chunk");

    expect(wavHeaderProblem(base.subarray(0, 36))).toBe("no data chunk");
    expect(wavHeaderProblem(base.subarray(0, 12))).toBe("no fmt chunk");
  });

  test("decode is the inverse of encode within one step of 16-bit rounding", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
    const back = decodeWav16(encodeWav16(samples));
    expect(back.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i++) expect(Math.abs(back[i]! - samples[i]!)).toBeLessThan(1 / 0x7fff + 1e-6);
    expect(() => decodeWav16(wav({ channels: 2 }))).toThrow("not one channel");
  });
});
