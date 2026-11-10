import { createConnection, type Socket } from "node:net";
import type { JsonValue } from "../../bridge/json.ts";
import { jsonNumberField, jsonRecord } from "../../bridge/stt/json.ts";
import { validPaneFitColumns, validPaneFitRows, type PaneFitSize } from "./controller.ts";
import type { PaneFitController } from "./local.ts";

/** Core frames: channel/u32, kind/u8, payload length/u32, then payload. */
function frame(channel: number, kind: number, payload = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(9);
  header.writeUInt32LE(channel, 0);
  header[4] = kind;
  header.writeUInt32LE(payload.length, 5);
  return Buffer.concat([header, payload]);
}

/** A retained framed connection; a fresh channel replaces its old viewer on an explicit fit. */
class CoreFitLease {
  readonly socket: Socket;
  private buffer = Buffer.alloc(0);
  private framed = false;
  private channel: number | null = null;
  private nextId = 1;
  private waiting: { id: number; resolve(): void; reject(error: Error): void } | null = null;
  private readonly ready: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private tail: Promise<void> = Promise.resolve();

  constructor(path: string, private readonly terminal: string, onClose: () => void) {
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    this.socket = createConnection(path);
    this.socket.setTimeout(5000);
    this.socket.on("connect", () => this.socket.write(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "hello", params: { generation: 1, framed: true } }) + "\n"));
    this.socket.on("data", (chunk: Buffer) => {
      try { this.receive(chunk); } catch { this.socket.destroy(new Error("Core fit protocol failed")); }
    });
    this.socket.on("timeout", () => this.socket.destroy(new Error("Core fit timed out")));
    this.socket.on("error", (error) => { this.readyReject(error); this.waiting?.reject(error); });
    this.socket.on("close", () => {
      const error = new Error("Core fit connection closed");
      this.readyReject(error);
      this.waiting?.reject(error);
      onClose();
    });
  }

  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.framed) {
      const end = this.buffer.indexOf(10);
      if (end < 0) { if (this.buffer.length > 65536) throw new Error("Oversized handshake"); return; }
      // SAFETY: JSON.parse returns JSON data; the shared field readers validate every used field.
      const hello = jsonRecord(JSON.parse(this.buffer.subarray(0, end).toString()) as JsonValue);
      if (hello === null || hello.error !== undefined) throw new Error("Core handshake refused");
      this.buffer = this.buffer.subarray(end + 1);
      this.framed = true;
      this.readyResolve();
    }
    while (this.buffer.length >= 9) {
      const size = this.buffer.readUInt32LE(5);
      if (size > 2 * 1024 * 1024) throw new Error("Oversized Core frame");
      if (this.buffer.length < 9 + size) return;
      const channel = this.buffer.readUInt32LE(0);
      const kind = this.buffer[4];
      const payload = this.buffer.subarray(9, 9 + size);
      this.buffer = this.buffer.subarray(9 + size);
      if (channel === 0 && kind === 0) {
        // SAFETY: the result remains JSON until validated by the shared field readers.
        const message = jsonRecord(JSON.parse(payload.toString()) as JsonValue);
        if (message === null || this.waiting === null || message.id !== this.waiting.id) continue;
        const result = jsonRecord(message.result);
        const next = result === null ? null : jsonNumberField(result.channel);
        if (message.error !== undefined || next === null || !Number.isInteger(next) || next <= 0) {
          this.waiting.reject(new Error("Core attachment refused"));
        } else {
          const previous = this.channel;
          this.channel = next;
          if (previous !== null) this.socket.write(frame(previous, 2));
          this.socket.setTimeout(0);
          this.waiting.resolve();
        }
        this.waiting = null;
      } else if (channel !== 0 && kind === 0) {
        const credit = Buffer.alloc(4);
        credit.writeUInt32LE(size);
        this.socket.write(frame(channel, 1, credit));
      } else if (channel === this.channel && kind === 2) {
        this.socket.destroy();
      }
    }
  }

  resize(size: PaneFitSize): Promise<void> {
    const next = this.tail.then(async () => {
      await this.ready;
      if (this.socket.destroyed) throw new Error("Core fit connection closed");
      this.socket.setTimeout(5000);
      await new Promise<void>((resolve, reject) => {
        const id = this.nextId++;
        this.waiting = { id, resolve, reject };
        const request = { jsonrpc: "2.0", id, method: "terminal.attach", params: { terminal: this.terminal, cols: size.cols, rows: size.rows } };
        this.socket.write(frame(0, 0, Buffer.from(JSON.stringify(request))));
      });
      return;
    });
    this.tail = next.catch(() => {});
    return next;
  }
}

export class CorePaneFitController implements PaneFitController {
  private readonly leases = new Map<string, CoreFitLease>();
  get activeCount(): number { return this.leases.size; }

  async resize(socket: string, terminal: string, size: PaneFitSize): Promise<void> {
    if (!/^t[0-9a-z]+$/.test(terminal) || !validPaneFitColumns(size.cols) || !validPaneFitRows(size.rows)) throw new Error("Invalid Core fit");
    const key = JSON.stringify([socket, terminal]);
    let lease = this.leases.get(key);
    if (lease === undefined) {
      const created = new CoreFitLease(socket, terminal, () => {
        if (this.leases.get(key) === created) this.leases.delete(key);
      });
      lease = created;
      this.leases.set(key, created);
    }
    try { await lease.resize(size); } catch (error) { lease.socket.destroy(); throw error; }
  }

  disposeAll(): void {
    for (const lease of this.leases.values()) lease.socket.destroy();
    this.leases.clear();
  }
}
