/**
 * Mark several panes seen at once, through Collie's own per-pane signal.
 *
 * Collie keeps no "seen" flag: the bridge stamps a pane's `seenAt` when the page reads it with the
 * `x-collie-seen` header (bridge/server.ts `marksPaneSeen`), and `isUnseen` (lib/triage.ts) compares
 * that stamp with the pane's last activity. `fetchPane` sets the header on every read that is the
 * operator looking at a pane, so marking a pane seen IS one such read — nothing here adds a route, a
 * batch endpoint or a client-side overlay, and a peer's pane is stamped on the peer, because the
 * read is addressed by the pane's own scope and the crew forwarder carries the header across.
 *
 * Each read asks for one line, the smallest read the bridge serves. The ETag cache entry it leaves
 * is validated by the body's hash, so the pane page's next full read cannot 304 into a one-line
 * mirror. A read that fails (a closed pane, an unreachable peer) leaves that pane unseen, which the
 * next snapshot reports honestly.
 */

import { fetchPane } from "@/lib/api";
import type { Scope } from "@/lib/scope";
import type { AgentView } from "@/lib/types";

/** How many seen reads may be in flight at once — enough to be quick, few enough to be polite. */
export const MARK_SEEN_CONCURRENCY = 4;

export type SeenRead = (paneId: string, scope: Scope) => Promise<void>;

const seenRead: SeenRead = async (paneId, scope) => {
  await fetchPane(paneId, 1, scope);
};

/**
 * Send one seen read for each of `panes`, each addressed by `scopeOf(pane)`, at most
 * {@link MARK_SEEN_CONCURRENCY} at a time. Resolves once every read has settled, with the number
 * that succeeded; it never rejects.
 */
export async function markPanesSeen(
  panes: readonly AgentView[],
  scopeOf: (pane: AgentView) => Scope,
  read: SeenRead = seenRead,
): Promise<number> {
  let next = 0;
  let marked = 0;
  const worker = async () => {
    while (next < panes.length) {
      const pane = panes[next]!;
      next += 1;
      try {
        await read(pane.paneId, scopeOf(pane));
        marked += 1;
      } catch {
        // The pane stays unseen; the next snapshot says so.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MARK_SEEN_CONCURRENCY, panes.length) }, worker));
  return marked;
}
