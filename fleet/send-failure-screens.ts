// A failed send's screens, kept on this machine for root-cause work (fleet-send-failure-screens).
//
// Collie's Send Protocol decides every refusal by comparing screen reads, and keeps none of them: the
// receipt under `<stateDir>/sends/` holds hashes and words, and the lab's examples are masked. When a
// send fails on a screen decision, this module keeps the reads that decision had, unredacted and as
// the multiplexer returned them (styling included), beside the settled receipt, so the operator can
// see later what Collie saw. Nothing here is served, shown or sent: the files stay in the owner-only
// state directory and the operator reads them on the machine.
//
// The protocol (bridge/surface/protocol.ts) knows only the `FailureScreenSink` port: it asks `wants`
// with the settled receipt and hands `keep` plain data. `keep` never waits and never throws; the write
// runs later on one serial chain, and its first error is logged once.
//
// The folder is fixed by the bridge (`<stateDir>/send-failures`, bridge/index.ts) and every file name
// is generated here: the request id is minted by the phone, so it is stored inside a record and never
// becomes a path (AGENTS.md, "The journal"). A folder that is a symbolic link or not a folder is
// refused, a record is opened with O_EXCL|O_NOFOLLOW as a temporary sibling and renamed into place, and
// the folder is pruned to a count and a byte total after every write.

import { randomBytes } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { REQUEST_ID, type SendOutcome, type SendReason, type SendReceipt } from "../web/src/lib/surface/send.ts";

/** One read a send's decision had, as the multiplexer returned it. */
export interface FailureScreen {
  /** Its role in the run: `s0`, `s1`, `s2`, `previous` or `last`. */
  readonly label: string;
  /** The step the read was made under (`s0`, `probe`, `s1`, …). */
  readonly step: string;
  /** The pane's content revision the read carried. */
  readonly revision: number;
  /** The read's text, unredacted, ANSI styling included. */
  readonly raw: string;
}

/** What the protocol hands over for one failed send. */
export interface SendFailureCapture {
  readonly receipt: SendReceipt;
  /** When the failure was settled, in ms since the epoch. */
  readonly at: number;
  readonly screens: readonly FailureScreen[];
}

/** The port the Send Protocol calls after a receipt settles. Neither method may change the send. */
export interface FailureScreenSink {
  wants(receipt: SendReceipt): boolean;
  keep(capture: SendFailureCapture): void;
}

/** The reasons a screen read decided, so the reads are what explains them. */
const SCREEN_REASONS: ReadonlySet<SendReason> = new Set<SendReason>([
  "draft_present",
  "not_free",
  "probe_failed",
  "unconfirmed",
  "mismatch",
  "changed",
  "modal_cue",
  "no_evidence",
  "dialog_after_enter",
]);

/** The outcomes that are failures: nothing went in, the text stayed in the box, or nobody can say. */
const FAILED: ReadonlySet<SendOutcome> = new Set<SendOutcome>(["refused", "typed_not_submitted", "unknown"]);

/**
 * Whether a settled receipt is a failure worth its screens: a failed outcome with a screen-decided
 * reason, or any failed outcome over a screen whose modal read unreadable or unknown. A blind send on a
 * pane with no profile read nothing, so it never is.
 */
export function wantsFailureScreens(receipt: SendReceipt): boolean {
  if (!FAILED.has(receipt.outcome)) return false;
  if (receipt.saw?.reason === "no-profile") return false;
  if (receipt.reason !== undefined && SCREEN_REASONS.has(receipt.reason)) return true;
  const modal = receipt.saw?.modal;
  return modal === "unreadable" || modal === "unknown";
}

/** The most records the folder keeps; the oldest go first. */
export const FAILURE_KEEP_FILES = 50;
/** The most bytes the folder's records may hold together; the oldest go first. */
export const FAILURE_KEEP_BYTES = 8 * 1024 * 1024;
/** The most characters one screen keeps; a longer read keeps its end, where the box is. */
export const FAILURE_SCREEN_CHARS = 256 * 1024;
/** The most screens one record keeps. */
export const FAILURE_SCREENS_MAX = 6;
/** The most writes that may wait; a capture past this is dropped. */
const QUEUE_MAX = 8;

/** A record's file name: a UTC timestamp that sorts by time, then eight random hex digits. */
export const RECORD_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}\.json$/;
/** A record's temporary sibling, left behind only by a write that died. */
const TEMP_NAME = /^\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}\.json\.tmp$/;

export interface SendFailureScreensOptions {
  readonly maxFiles?: number;
  readonly maxBytes?: number;
  readonly maxScreenChars?: number;
  /** Where the one warning goes; `console.warn` by default. */
  readonly warn?: (line: string) => void;
}

/** A record name for `at`, generated here and never from a request's own values. */
function recordName(at: number): string {
  return `${new Date(at).toISOString().replace(/[:.]/gu, "-")}-${randomBytes(4).toString("hex")}.json`;
}

/** The local store of failed sends' screens, one serial writer per bridge. */
export class SendFailureScreens implements FailureScreenSink {
  private readonly maxFiles: number;
  private readonly maxBytes: number;
  private readonly maxScreenChars: number;
  private readonly warn: (line: string) => void;
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private warned = false;

  constructor(
    private readonly dir: string,
    options: SendFailureScreensOptions = {},
  ) {
    this.maxFiles = options.maxFiles ?? FAILURE_KEEP_FILES;
    this.maxBytes = options.maxBytes ?? FAILURE_KEEP_BYTES;
    this.maxScreenChars = options.maxScreenChars ?? FAILURE_SCREEN_CHARS;
    this.warn = options.warn ?? ((line) => console.warn(line));
  }

  wants(receipt: SendReceipt): boolean {
    return wantsFailureScreens(receipt);
  }

  /** Queue one record. Returns at once, never throws, and drops the capture when the queue is full. */
  keep(capture: SendFailureCapture): void {
    if (capture.screens.length === 0 || this.pending >= QUEUE_MAX) return;
    this.pending++;
    this.chain = this.chain.then(() => this.run(capture));
  }

  /** One queued write; its error is swallowed, and the first one is logged. */
  private async run(capture: SendFailureCapture): Promise<void> {
    try {
      await this.write(capture);
    } catch (err) {
      this.warnOnce(err instanceof Error ? err.message : String(err));
    } finally {
      this.pending--;
    }
  }

  /** Resolves once every queued write has ended. */
  idle(): Promise<void> {
    return this.chain;
  }

  private warnOnce(message: string): void {
    if (this.warned) return;
    this.warned = true;
    this.warn(`[send-failures] a failed send's screens were not kept: ${message} (further errors are not logged)`);
  }

  /** The folder, made owner-only; a symbolic link or anything but a folder is refused. */
  private async ensureDir(): Promise<void> {
    let stat: Stats | null = null;
    try {
      stat = await lstat(this.dir);
    } catch (err) {
      if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) throw err;
    }
    if (stat === null) {
      try {
        await mkdir(this.dir, { mode: 0o700 });
      } catch (err) {
        if (!(err instanceof Error && "code" in err && err.code === "EEXIST")) throw err;
      }
      stat = await lstat(this.dir);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("the send-failures folder is not a plain folder, so nothing is written there");
    if ((stat.mode & 0o777) !== 0o700) await chmod(this.dir, 0o700);
  }

  private body(capture: SendFailureCapture): string {
    const { receipt } = capture;
    const screens = capture.screens.slice(0, FAILURE_SCREENS_MAX).map((screen) => {
      const truncated = screen.raw.length > this.maxScreenChars;
      return { label: screen.label, step: screen.step, revision: screen.revision, truncated, raw: truncated ? screen.raw.slice(-this.maxScreenChars) : screen.raw };
    });
    return `${JSON.stringify({
      format: "herdr-fleet.send-failure/1",
      keptAt: new Date(capture.at).toISOString(),
      requestId: REQUEST_ID.test(receipt.requestId) ? receipt.requestId : null,
      harness: receipt.harness,
      version: receipt.version,
      profileId: receipt.profileId,
      outcome: receipt.outcome,
      reason: receipt.reason ?? null,
      receipt,
      screens,
    })}\n`;
  }

  private async write(capture: SendFailureCapture): Promise<void> {
    await this.ensureDir();
    const name = recordName(capture.at);
    const target = join(this.dir, name);
    const temp = join(this.dir, `.${name}.tmp`);
    const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(this.body(capture));
    } finally {
      await handle.close();
    }
    try {
      await rename(temp, target);
    } catch (err) {
      await unlink(temp).catch(() => undefined);
      throw err;
    }
    await this.prune();
  }

  /** Keep the newest records inside the count and byte bounds; remove dead temporary files. */
  private async prune(): Promise<void> {
    const kept: { name: string; size: number }[] = [];
    for (const name of await readdir(this.dir)) {
      if (TEMP_NAME.test(name)) {
        await unlink(join(this.dir, name)).catch(() => undefined);
        continue;
      }
      if (!RECORD_NAME.test(name)) continue;
      const stat = await lstat(join(this.dir, name)).catch(() => null);
      if (stat?.isFile() === true) kept.push({ name, size: stat.size });
    }
    kept.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
    let count = 0;
    let bytes = 0;
    let full = false;
    for (const record of kept) {
      if (!full && count < this.maxFiles && (count === 0 || bytes + record.size <= this.maxBytes)) {
        count++;
        bytes += record.size;
        continue;
      }
      // Once one record does not fit, it and every older one go: the oldest go first.
      full = true;
      await unlink(join(this.dir, record.name)).catch(() => undefined);
    }
  }
}
