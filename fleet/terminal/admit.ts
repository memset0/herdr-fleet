/**
 * Who may open a terminal, and what they are allowed to name.
 *
 * This is the whole admission decision as one pure function, deliberately: an upgrade is refused
 * *before* it completes, and the only way to be sure of that is for the decision to be a value the
 * route computes before it calls `upgrade` — not a series of checks scattered through a handler that
 * has already answered.
 *
 * Two properties the shape enforces rather than documents:
 *
 * - **A connection names a Pane, and nothing else.** The terminal id, the command, its arguments, the
 *   server's address and the account it runs as are resolved from that Pane by the side that owns it.
 *   An unknown parameter is therefore a *refusal*, not something to ignore: ignoring it would let a
 *   caller believe it had selected something, and the next reader of this code believe the ignoring
 *   was deliberate.
 * - **Refusals do not describe themselves to the caller.** `reason` is for the operator's diagnostics;
 *   the route answers every refusal identically, so that "this Pane does not exist" and "you are not
 *   signed in" are indistinguishable from outside.
 */

/** The Fleet-owned path a terminal connection upgrades at. One path, so nothing grows under it. */
export const TERMINAL_PATH = "/fleet/api/terminal";

/** The only parameters a connection may carry: the Pane, and the scope that Pane lives in. */
const PANE_PARAM = "pane";
/** Collie's own scope parameter names, so a terminal address is the address the app already builds. */
const HOST_PARAM = "h";
const SESSION_PARAM = "s";
const ALLOWED = new Set([PANE_PARAM, HOST_PARAM, SESSION_PARAM]);

/** A Pane the connection asked for, in the scope it asked for it. Nothing here selects a terminal. */
export interface TerminalTarget {
  readonly paneId: string;
  /** The pack member, or undefined for the lead. */
  readonly host?: string;
  /** The named multiplexer session, or undefined for that host's primary one. */
  readonly session?: string;
}

export type RefusalReason =
  | "no-session"
  | "wrong-host"
  | "wrong-origin"
  | "no-pane"
  | "malformed-pane"
  | "extra-selector";

/** The target while it is being assembled — the readonly contract's own mutable counterpart. */
type DraftTarget = { paneId: string; host?: string; session?: string };

export type Admission =
  | { readonly ok: true; readonly target: TerminalTarget }
  | { readonly ok: false; readonly reason: RefusalReason; readonly detail?: string };

export interface AdmissionInput {
  readonly url: URL;
  /** The request's `host` header, lower-cased by the caller. */
  readonly host: string;
  /** The request's `origin` header, or null when it sent none. */
  readonly origin: string | null;
  /** Whether the request carried a valid, unexpired, server-recognized session. */
  readonly authenticated: boolean;
}

export interface AdmissionConfig {
  readonly publicHost: string;
  readonly publicOrigin: string;
}

/**
 * A Pane id is Collie's own `w<space>:p<pane>` shape. Validated here rather than trusted, because
 * this value is about to be looked up on a machine: a Pane id is not a path, and the resolver must
 * never be the first thing to discover that.
 */
const PANE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}:[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The one shape a Pane id may have, shared with the member-side service.
 *
 * Shared rather than restated: both ends refuse the same strings, and two regular expressions that
 * were meant to agree are two regular expressions that will eventually not.
 */
export function isPaneId(value: string): boolean {
  return PANE_ID.test(value);
}
/** A scope value is an opaque identifier the app already round-trips; bound it the same way. */
const SCOPE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function admit(input: AdmissionInput, config: AdmissionConfig): Admission {
  // Host first: a request for another name is not this deployment's to answer, whatever it carries.
  if (input.host !== config.publicHost) return { ok: false, reason: "wrong-host" };

  // An upgrade is not subject to the browser's own cross-origin rules, so the origin is checked here
  // rather than relied upon. A missing origin is refused as firmly as a wrong one: a browser sends it
  // on every WebSocket handshake, so its absence means the caller is not one.
  if (input.origin !== config.publicOrigin) return { ok: false, reason: "wrong-origin" };

  if (!input.authenticated) return { ok: false, reason: "no-session" };

  for (const name of input.url.searchParams.keys()) {
    if (!ALLOWED.has(name)) return { ok: false, reason: "extra-selector", detail: name };
  }

  const paneId = input.url.searchParams.get(PANE_PARAM);
  if (paneId === null || paneId === "") return { ok: false, reason: "no-pane" };
  if (!PANE_ID.test(paneId)) return { ok: false, reason: "malformed-pane" };

  const host = input.url.searchParams.get(HOST_PARAM);
  if (host !== null && !SCOPE_VALUE.test(host)) return { ok: false, reason: "malformed-pane", detail: HOST_PARAM };
  const session = input.url.searchParams.get(SESSION_PARAM);
  if (session !== null && !SCOPE_VALUE.test(session)) {
    return { ok: false, reason: "malformed-pane", detail: SESSION_PARAM };
  }

  // Built by assignment rather than spread so an absent scope stays absent: `{host: undefined}` and
  // `{}` are the same object to a reader and different ones to a resolver that checks `in`.
  const target: DraftTarget = { paneId };
  if (host !== null) target.host = host;
  if (session !== null) target.session = session;
  return { ok: true, target };
}
