/**
 * WHEN A PUSH IS WITHHELD: only while the operator is looking at the very pane it is about.
 *
 * Collie withholds a pane's system notification whenever any of its windows reports itself visible,
 * because the in-app status line already says the same thing. On a desktop that reading is wrong in
 * both directions: a window buried under others still reports `visible` (the browser does not track
 * occlusion), and a window showing another pane is not showing this one. Focus is what the window
 * manager reports truthfully, and the URL says which pane the focused window shows.
 *
 * So a push is withheld exactly when some FOCUSED window's address is the address a tap on this
 * notification would open: same path, and the same host and session once normalised the way the app
 * normalises them. A push that opens no pane (a test, or a target that is not a pane) is never
 * withheld here. The URL comes from the same `notificationPath` the tap uses, so the two cannot
 * disagree about which pane a notification belongs to.
 */

import { normalizeScope, scopeFromUrl } from "@/lib/scope";

export interface FocusClient {
  readonly url: string;
  readonly focused: boolean;
}

/** Whether a focused window is showing `targetUrl`, which must be a pane's address to count. */
export function paneInFront(clients: readonly FocusClient[], targetUrl: string): boolean {
  const target = new URL(targetUrl);
  if (!/\/pane\/[^/]+$/.test(target.pathname)) return false;
  const want = normalizeScope(scopeFromUrl(target.href));
  return clients.some((client) => {
    if (!client.focused) return false;
    let at: URL;
    try {
      at = new URL(client.url);
    } catch {
      return false;
    }
    if (at.origin !== target.origin || at.pathname !== target.pathname) return false;
    const have = normalizeScope(scopeFromUrl(at.href));
    return have.host === want.host && have.session === want.session;
  });
}
