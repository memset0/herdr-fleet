// A recording to 16 kHz mono PCM, and the 16-bit WAV that carries it (ADR 0096).
//
// Both speech engines want the same audio: the phone engine takes a Float32Array, the host's
// `whistle` provider takes a WAV of the same samples. So the page decodes the recording once, after
// the clip stops, and the decoder and the resampler are the browser's own. Nothing here touches the
// network or the DOM beyond the Web Audio constructors, and those come in through `deps` so a test
// can fake them.
//
// THE BRIDGE MIRRORS THE HEADER RULES. `wavHeaderProblem` is the whole definition of "a WAV this
// pipeline accepts": RIFF/WAVE, PCM, one channel, 16 kHz, 16 bits. The bridge checks the same
// things before it starts a child process (bridge/stt), so keep the two in step.

/** Every clip is transcribed at this rate. */
export const PCM_SAMPLE_RATE = 16_000;

/**
 * The longest clip the host `whistle` provider takes: 16-bit mono at 16 kHz is 32 KB/s, so the
 * 8 MiB upload cap holds 4.3 minutes and the cap is set to 4.
 */
export const WHISTLE_HOST_MAX_DURATION_MS = 240_000;

const WAV_HEADER_BYTES = 44;

export type SttAudioErrorCode = "undecodable" | "empty" | "unsupported" | "bad-wav";

/** What went wrong with the audio, as a code a caller can branch on. */
export class SttAudioError extends Error {
  readonly code: SttAudioErrorCode;
  constructor(code: SttAudioErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SttAudioError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------
// Recording to PCM
// ---------------------------------------------------------------------------------------------

/** What the decode hands back: the one field this module reads, which `AudioBuffer` has. */
export interface PcmBuffer {
  readonly duration: number;
}

/** The slice of `AudioContext` this module uses. */
export interface PcmDecodeContext {
  decodeAudioData: (data: ArrayBuffer) => Promise<PcmBuffer>;
  close: () => Promise<void>;
}

/** The slice of an `AudioBufferSourceNode` this module uses. */
export interface PcmSource<Node> {
  buffer: PcmBuffer | null;
  connect: (destination: Node) => void;
  start: () => void;
}

/** The slice of `OfflineAudioContext` this module uses. */
export interface PcmRenderContext<Node> {
  readonly destination: Node;
  createBufferSource: () => PcmSource<Node>;
  startRendering: () => Promise<{ getChannelData: (channel: number) => Float32Array }>;
}

/** The two Web Audio constructors, injectable so a test needs no browser. */
export interface PcmDeps<Node = AudioNode> {
  createContext: () => PcmDecodeContext;
  createOfflineContext: (channels: number, length: number, sampleRate: number) => PcmRenderContext<Node>;
}

declare global {
  interface Window {
    /** Safari's legacy name for the same constructor; lib.dom does not declare it. */
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }
}

/** The browser's constructors, or Safari's older prefixed names; `null` when there are none. */
function browserDeps(): PcmDeps | null {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  const Offline = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
  if (!Context || !Offline) return null;
  return {
    createContext: () => new Context(),
    createOfflineContext: (channels, length, sampleRate) => new Offline(channels, length, sampleRate),
  };
}

/**
 * Decode a recording and return it as mono float samples at 16 kHz. The offline render does the
 * downmix and the resample in one step. Rejects with an `SttAudioError`: `undecodable` when the
 * browser cannot read the blob, `empty` when it holds no audio, `unsupported` when there is no Web
 * Audio. The decoding context is closed on every path.
 */
export async function toPcm16k<Node = AudioNode>(blob: Blob, deps?: PcmDeps<Node>): Promise<Float32Array> {
  if (deps !== undefined) return render(blob, deps);
  const browser = browserDeps();
  if (browser === null) throw new SttAudioError("unsupported", "This browser has no Web Audio.");
  return render(blob, browser);
}

async function render<Node>(blob: Blob, api: PcmDeps<Node>): Promise<Float32Array> {
  if (blob.size === 0) throw new SttAudioError("empty", "The recording is empty.");

  const context = api.createContext();
  try {
    const bytes = await blob.arrayBuffer();
    let decoded: PcmBuffer;
    try {
      decoded = await context.decodeAudioData(bytes);
    } catch (cause) {
      throw new SttAudioError("undecodable", "The browser could not read the recording.", { cause });
    }
    const frames = Math.ceil(decoded.duration * PCM_SAMPLE_RATE);
    if (!(frames > 0)) throw new SttAudioError("empty", "The recording holds no audio.");

    // One channel at the target rate: connecting a wider source to it downmixes, and the render
    // resamples.
    const offline = api.createOfflineContext(1, frames, PCM_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } finally {
    // A close that rejects (already closed) changes nothing the caller can use.
    await context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------
// WAV
// ---------------------------------------------------------------------------------------------

/** Samples to signed 16-bit: clamped to [-1, 1], negative scaled by 0x8000, positive by 0x7fff. */
function toInt16(sample: number): number {
  if (Number.isNaN(sample)) return 0;
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

/** Mono 16-bit little-endian PCM WAV with a 44-byte header. */
export function encodeWav16(pcm: Float32Array, sampleRate: number = PCM_SAMPLE_RATE): Blob {
  const dataBytes = pcm.length * 2;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // one channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  tag(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(WAV_HEADER_BYTES + i * 2, toInt16(pcm[i]!), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

type WavLayout = { problem: string } | { problem: null; view: DataView; dataOffset: number; dataBytes: number };

function viewOf(bytes: ArrayBuffer | Uint8Array): DataView {
  // isView, not instanceof: a Uint8Array from another realm (an iframe, jsdom) fails instanceof.
  return ArrayBuffer.isView(bytes)
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new DataView(bytes);
}

function fourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Walk the chunks. Does not assume the data chunk starts at byte 44. */
function layoutOf(bytes: ArrayBuffer | Uint8Array): WavLayout {
  const view = viewOf(bytes);
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
      if (view.getUint32(body + 4, true) !== PCM_SAMPLE_RATE) return { problem: "not 16000 Hz" };
      if (view.getUint16(body + 14, true) !== 16) return { problem: "not 16 bits per sample" };
      sawFormat = true;
    } else if (id === "data") {
      if (!sawFormat) return { problem: "the data chunk comes before the fmt chunk" };
      if (body + size > view.byteLength) return { problem: "the data chunk is cut short" };
      if (size === 0) return { problem: "the data chunk is empty" };
      if (size % 2 !== 0) return { problem: "the data chunk is not whole samples" };
      return { problem: null, view, dataOffset: body, dataBytes: size };
    }
    // Chunks are padded to an even size.
    offset = body + size + (size % 2);
  }
  return { problem: sawFormat ? "no data chunk" : "no fmt chunk" };
}

/**
 * Why these bytes are not a WAV this pipeline accepts (RIFF/WAVE, PCM, one channel, 16000 Hz,
 * 16 bits, a non-empty data chunk that fits in the file), or `null` when they are one.
 */
export function wavHeaderProblem(bytes: ArrayBuffer | Uint8Array): string | null {
  return layoutOf(bytes).problem;
}

/** The samples of an accepted WAV as floats in [-1, 1]. Throws `SttAudioError("bad-wav")` otherwise. */
export function decodeWav16(bytes: ArrayBuffer | Uint8Array): Float32Array {
  const layout = layoutOf(bytes);
  if (layout.problem !== null) throw new SttAudioError("bad-wav", `Not a usable WAV: ${layout.problem}.`);
  const out = new Float32Array(layout.dataBytes / 2);
  for (let i = 0; i < out.length; i++) {
    const sample = layout.view.getInt16(layout.dataOffset + i * 2, true);
    out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return out;
}
