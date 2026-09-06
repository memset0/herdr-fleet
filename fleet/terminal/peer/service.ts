/**
 * A member's terminal service: the one thing only that member can do.
 *
 * It turns one of its own Pane ids into that Pane's real terminal and serves it. Everything else it
 * deliberately cannot do. It reads no Pack membership, holds no identity, and is handed no browser
 * material; reaching it proves only that something came over the loopback endpoint the operator's
 * own SSH projects, and that fact asserts nothing about who.
 *
 * It also holds nothing when nobody is using it. Not at startup, not when the link comes up, not
 * when configuration is installed — and after a bounded idle interval it stands itself down, which
 * is what makes "a device nobody has touched since yesterday runs no terminal machinery" a property
 * over time rather than a claim about a fresh boot.
 */

import type { FleetTerminalConfig } from "../../config.ts";
import type { Resolution } from "../resolve.ts";
import type { StartServer, TerminalServer, TimerHandle } from "../session.ts";
import type { PeerState } from "./protocol.ts";

export type AttachFailure =
  | "pane-absent"
  | "pane-ambiguous"
  | "no-terminal"
  | "snapshot-unavailable"
  | "executable-unverified"
  | "at-capacity"
  | "server-unavailable";

export type AttachResult =
  | { readonly ok: true; readonly endpoint: string }
  | { readonly ok: false; readonly reason: AttachFailure };

export interface PeerTerminalDeps {
  readonly config: FleetTerminalConfig;
  /** Resolve a Pane against THIS machine's own multiplexer server. */
  readonly resolve: (paneId: string) => Promise<Resolution>;
  /** True when the configured executable is present and is the one the configuration named. */
  readonly verifyExecutable: () => Promise<boolean>;
  readonly startServer: StartServer;
  /** Called when the idle interval expires with nothing held. The process ends; nothing else does. */
  readonly standDown: () => void;
  readonly now?: (() => number) | undefined;
  readonly setTimer?: ((fn: () => void, ms: number) => TimerHandle) | undefined;
  readonly clearTimer?: ((handle: TimerHandle) => void) | undefined;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

interface HeldServer {
  readonly paneId: string;
  readonly server: TerminalServer;
}

export class PeerTerminalService {
  private readonly servers = new Map<string, HeldServer>();
  private idleHandle: TimerHandle | null = null;
  private stopped = false;

  constructor(private readonly deps: PeerTerminalDeps) {
    this.armIdle();
  }

  held(): number {
    return this.servers.size;
  }

  state(): PeerState {
    return {
      held: this.servers.size,
      idleSeconds: this.deps.config.idleSeconds,
      maxServers: this.deps.config.maxServers,
    };
  }

  /**
   * Serve a Pane's terminal, starting one if this Pane has none held.
   *
   * The Pane is re-resolved every time. A Pane that has closed since the lead last saw it refuses
   * here rather than resolving to whatever now answers to its id, which is the whole reason the lead
   * is not allowed to remember a terminal id for this machine.
   */
  async attach(paneId: string): Promise<AttachResult> {
    if (this.stopped) return { ok: false, reason: "server-unavailable" };
    this.touch();
    const existing = this.servers.get(paneId);
    if (existing !== undefined) return { ok: true, endpoint: existing.server.endpoint };

    const resolution = await this.deps.resolve(paneId);
    if (!resolution.ok) {
      // `not-local` and `no-terminal-endpoint` cannot arise here: this resolver is handed a Pane id
      // with no host, and it reads this machine's own server.
      const reason: AttachFailure =
        resolution.reason === "pane-absent" ||
        resolution.reason === "pane-ambiguous" ||
        resolution.reason === "snapshot-unavailable"
          ? resolution.reason
          : "no-terminal";
      this.deps.log?.("peer-terminal.unresolved", { reason });
      return { ok: false, reason };
    }
    if (this.servers.size >= this.deps.config.maxServers) {
      this.deps.log?.("peer-terminal.at-capacity", { held: this.servers.size });
      return { ok: false, reason: "at-capacity" };
    }
    // Before a process, not after: the configuration names an executable and an identity, and what
    // is about to be started has a terminal on the other end of it.
    if (!(await this.deps.verifyExecutable())) {
      this.deps.log?.("peer-terminal.executable-unverified", { paneId });
      return { ok: false, reason: "executable-unverified" };
    }
    let server: TerminalServer;
    try {
      server = await this.deps.startServer(resolution.placement, {
        // The lead states the real geometry in its own first frame; this is only the size the
        // terminal is started at, before that frame arrives.
        columns: 80,
        rows: 24,
      });
    } catch {
      return { ok: false, reason: "server-unavailable" };
    }
    this.servers.set(paneId, { paneId, server });
    this.deps.log?.("peer-terminal.started", { held: this.servers.size });
    this.touch();
    return { ok: true, endpoint: server.endpoint };
  }

  /** Stop one Pane's terminal server. Everything else on this machine keeps running. */
  close(paneId: string): boolean {
    this.touch();
    const held = this.servers.get(paneId);
    if (held === undefined) return false;
    this.servers.delete(paneId);
    held.server.stop();
    this.deps.log?.("peer-terminal.closed", { held: this.servers.size });
    return true;
  }

  /** Stop everything this service started. Collie, the multiplexer server and the link are not its. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelIdle();
    for (const held of Array.from(this.servers.values())) held.server.stop();
    this.servers.clear();
  }

  /** A request happened. The idle clock starts again from here. */
  touch(): void {
    if (this.stopped) return;
    this.armIdle();
  }

  private armIdle(): void {
    this.cancelIdle();
    const set = this.deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.idleHandle = set(() => {
      this.idleHandle = null;
      // Holding a terminal is not idle, however long ago it was asked for: somebody is attached to
      // it, and the lead is the one that decides when that ends.
      if (this.servers.size > 0) {
        this.armIdle();
        return;
      }
      this.deps.log?.("peer-terminal.stood-down", { held: 0 });
      this.deps.standDown();
    }, this.deps.config.idleSeconds * 1_000);
  }

  private cancelIdle(): void {
    if (this.idleHandle === null) return;
    const clear = this.deps.clearTimer ?? ((handle: TimerHandle) => clearTimeout(handle));
    clear(this.idleHandle);
    this.idleHandle = null;
  }
}
