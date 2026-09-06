/**
 * Turning a Pane into the terminal behind it.
 *
 * This is the step the browser is not allowed to take. It runs beside a real multiplexer server, on
 * the machine that owns the Pane, and it is the only place a terminal id comes into existence for a
 * connection.
 *
 * It has to live here rather than anywhere more convenient because Collie drops `terminal_id` when it
 * builds its own Pane model, so no Collie surface — and nothing the lead receives about a peer's
 * Panes — carries it. On the lead that is a small inconvenience: read the local server's snapshot.
 * For a peer it is the reason a peer-side service has to exist at all.
 *
 * Nothing here reads a path, a command or an account from its input. The Pane id is matched against
 * a snapshot the server produced; everything else about the terminal comes from that snapshot.
 */

import { defaultSocketPath } from "../../bridge/config.ts";
import { HerdrClient } from "../../bridge/mux/herdr/client.ts";
import type { TerminalTarget } from "./admit.ts";

/** The single Pane fact this module needs, named structurally so a test needs no wire fixture. */
export interface SnapshotPane {
  readonly pane_id: string;
  readonly terminal_id?: string | null;
}

export interface TerminalSnapshot {
  readonly panes: readonly SnapshotPane[];
}

export type ResolutionFailure =
  /** The target named a member; the lead does not resolve another machine's Panes. */
  | "not-local"
  | "pane-absent"
  | "pane-ambiguous"
  | "no-terminal"
  | "snapshot-unavailable";

export type Resolution =
  | { readonly ok: true; readonly terminalId: string }
  | { readonly ok: false; readonly reason: ResolutionFailure };

/**
 * A terminal id, as the multiplexer writes them. Validated on the way *out* of the snapshot, not on
 * the way in from a caller — a caller never supplies one — because the value is about to become a
 * command argument, and a malformed id from an unexpected server version should stop here rather
 * than be executed.
 */
const TERMINAL_ID = /^term_[A-Za-z0-9]{1,64}$/;

/**
 * Resolve one Pane against one snapshot.
 *
 * Exactly one live match is required. There is deliberately no fallback to a focused, first or
 * neighbouring Pane: every one of those would connect an operator to a terminal they did not ask
 * for, which on this surface means typing into it.
 */
export function resolveInSnapshot(target: TerminalTarget, snapshot: TerminalSnapshot): Resolution {
  if (target.host !== undefined) return { ok: false, reason: "not-local" };
  const matches = snapshot.panes.filter((pane) => pane.pane_id === target.paneId);
  if (matches.length === 0) return { ok: false, reason: "pane-absent" };
  if (matches.length > 1) return { ok: false, reason: "pane-ambiguous" };
  // `?? ""` rather than a representation check: the field's own type already says string | null |
  // undefined, and an empty string fails the shape below exactly as a missing one should.
  const terminalId = matches[0]!.terminal_id ?? "";
  if (!TERMINAL_ID.test(terminalId)) return { ok: false, reason: "no-terminal" };
  return { ok: true, terminalId };
}

export type SnapshotSource = () => Promise<TerminalSnapshot>;

/**
 * The lead's own source: the local multiplexer server, through the client Collie already maintains.
 *
 * Reused rather than reimplemented — that client owns the socket's framing, its one-shot request
 * discipline and its timeouts, and a second implementation of those would be a second thing to be
 * wrong about them.
 */
export function localSnapshotSource(
  socketPath: string = process.env.HERDR_SOCKET_PATH ?? defaultSocketPath(),
): SnapshotSource {
  const client = new HerdrClient(socketPath);
  return async () => await client.sessionSnapshot();
}

/** Resolve against a live source, turning its failure into a refusal rather than an exception. */
export async function resolveTerminal(
  target: TerminalTarget,
  source: SnapshotSource,
): Promise<Resolution> {
  if (target.host !== undefined) return { ok: false, reason: "not-local" };
  let snapshot: TerminalSnapshot;
  try {
    snapshot = await source();
  } catch {
    return { ok: false, reason: "snapshot-unavailable" };
  }
  return resolveInSnapshot(target, snapshot);
}
