/**
 * Fitting a Pane on the machine it lives on.
 *
 * One core, used by the lead's Gateway for its own Panes and by a member's terminal service for that
 * member's Panes, so the two machines cannot disagree about bounds, rows or failure reasons. Nothing
 * here reads a row count, a socket or a command from its caller: the Pane is matched against a
 * snapshot this machine's own multiplexer produced, the rows come from that snapshot, and the socket
 * is the one this process was started beside.
 */

import type { SnapshotSource } from "../terminal/resolve.ts";
import {
  ManualPaneFitControllerError,
  validPaneFitColumns,
  validPaneFitRows,
  type PaneFitSize,
} from "./controller.ts";

export type PaneFitFailure = "unsupported" | "geometry" | "conflict" | "failed";

/** The wire answer, on the Gateway and on a member's service alike. */
export type PaneFitResult =
  | { readonly ok: true; readonly cols: number; readonly rows: number }
  | { readonly ok: false; readonly error: string; readonly reason: PaneFitFailure };

const ERRORS = {
  unsupported: "Pane resize is not available for this Host",
  geometry: "Pane geometry is not available yet",
  conflict: "Pane already has another controller",
  failed: "Pane resize failed",
} satisfies Record<PaneFitFailure, string>;

export function paneFitFailure(reason: PaneFitFailure): PaneFitResult {
  return { ok: false, error: ERRORS[reason], reason };
}

/** The controller surface this core needs; the real one is `ManualPaneFitControllerManager`. */
export interface PaneFitController {
  resize(socketPath: string, paneId: string, size: PaneFitSize): Promise<void>;
  readonly activeCount: number;
  disposeAll(): void;
}

export interface LocalPaneFitDeps {
  readonly source: SnapshotSource;
  readonly socketPath: string;
  readonly controller: PaneFitController;
}

export interface LocalPaneFit {
  resize(paneId: string, cols: number): Promise<PaneFitResult>;
  /** Retained controllers, so a member's service can tell held from idle. */
  held(): number;
  dispose(): void;
}

export function createLocalPaneFit(deps: LocalPaneFitDeps): LocalPaneFit {
  return {
    async resize(paneId, cols) {
      if (!validPaneFitColumns(cols)) return paneFitFailure("failed");
      let rows: number | undefined;
      try {
        const snapshot = await deps.source();
        // Exactly one live match, as the terminal resolver requires. No fallback to a neighbour: a
        // fit is a write to a shared PTY, and the wrong one is somebody else's terminal.
        const matches = snapshot.panes.filter((pane) => pane.pane_id === paneId);
        if (matches.length !== 1) return paneFitFailure("failed");
        rows = matches[0]!.scroll?.viewport_rows;
      } catch {
        return paneFitFailure("failed");
      }
      if (!validPaneFitRows(rows)) return paneFitFailure("geometry");
      try {
        await deps.controller.resize(deps.socketPath, paneId, { cols, rows });
      } catch (cause) {
        return paneFitFailure(
          cause instanceof ManualPaneFitControllerError && cause.failure === "conflict" ? "conflict" : "failed",
        );
      }
      return { ok: true, cols, rows };
    },
    held: () => deps.controller.activeCount,
    dispose: () => deps.controller.disposeAll(),
  };
}
