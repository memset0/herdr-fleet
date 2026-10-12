// ── THE ONE WAV SHAPE THE WHISTLE ENGINE TAKES ───────────────────────────────────────────────
//
// The phone turns a recording into 16 kHz mono PCM for its own engine, and sends the same samples
// to the host as a 16-bit little-endian WAV when the host provider is `whistle` (ADR 0096 Decision
// 4). The child that runs the engine has no decoder, so the bridge accepts exactly that shape and
// nothing else, and checks it before a child is started.
//
// The rules mirror `web/src/lib/stt-pcm.ts` (`layoutOf`) one for one, so a file the phone made is a
// file the bridge takes: RIFF/WAVE; chunks walked with their even padding; a `fmt ` chunk of at
// least 16 bytes saying PCM (1), one channel, 16000 Hz, 16 bits; a `data` chunk after it that is not
// empty, holds whole samples and fits inside the file. A streamed size of 0xFFFFFFFF does not fit,
// so it is refused like any other length the file does not have.
//
// Pure: bytes in, an answer out. Both the route (`bridge/stt/http.ts`) and the hidden verb
// (`cli/whistle-transcribe.ts`) read through it.

/** The one sample rate the engine takes. */
export const WAV_SAMPLE_RATE = 16_000;

/** Where the samples are, once a header has been accepted. */
export type WavLayout =
  | { problem: null; dataOffset: number; dataBytes: number }
  | { problem: string };

function fourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Walk the header. `problem` is a short English reason for the host's own log, never a path. */
export function wavLayout(bytes: Uint8Array): WavLayout {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 12 || fourCC(view, 0) !== "RIFF" || fourCC(view, 8) !== "WAVE") {
    return { problem: "not a RIFF/WAVE file" };
  }
  let sawFormat = false;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > view.byteLength) return { problem: "the fmt chunk is too short" };
      if (view.getUint16(body, true) !== 1) return { problem: "not PCM" };
      if (view.getUint16(body + 2, true) !== 1) return { problem: "not one channel" };
      if (view.getUint32(body + 4, true) !== WAV_SAMPLE_RATE) return { problem: "not 16000 Hz" };
      if (view.getUint16(body + 14, true) !== 16) return { problem: "not 16 bits per sample" };
      sawFormat = true;
    } else if (id === "data") {
      if (!sawFormat) return { problem: "the data chunk comes before the fmt chunk" };
      if (body + size > view.byteLength) return { problem: "the data chunk is cut short" };
      if (size === 0) return { problem: "the data chunk is empty" };
      if (size % 2 !== 0) return { problem: "the data chunk is not whole samples" };
      return { problem: null, dataOffset: body, dataBytes: size };
    }
    // Chunks are padded to an even size.
    offset = body + size + (size % 2);
  }
  return { problem: sawFormat ? "no data chunk" : "no fmt chunk" };
}

/** Why these bytes are not a WAV the engine takes, or null when they are one. */
export function wavHeaderProblem(bytes: Uint8Array): string | null {
  return wavLayout(bytes).problem;
}

/**
 * The samples of an accepted WAV as floats in [-1, 1], the scale `web/src/lib/stt-pcm.ts` decodes
 * to. Throws with the header's problem otherwise.
 */
export function decodeWav16(bytes: Uint8Array): Float32Array {
  const layout = wavLayout(bytes);
  if (layout.problem !== null) throw new Error(`not a usable WAV: ${layout.problem}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(layout.dataBytes / 2);
  for (let i = 0; i < out.length; i++) {
    const sample = view.getInt16(layout.dataOffset + i * 2, true);
    out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return out;
}

/** A 16 kHz mono 16-bit WAV of `samples`, with the plain 44-byte header. For tests and probes. */
export function encodeWav16(samples: Float32Array): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}
