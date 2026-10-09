/**
 * The Gateway's manual Pane fit surface.
 *
 * Two routes, both Fleet's own and both below the Gateway's session gate:
 *
 * - `GET /fleet/api/pane-fit` answers which Hosts can fit at all: the lead when it can run the
 *   multiplexer's own command, and each member the lead's validated configuration gives a terminal
 *   endpoint. That is Fleet's answer, not Collie's capability table: a member running Herdr says
 *   nothing about whether the lead can reach its terminal service.
 * - `POST /fleet/api/pane/:id/resize` fits one Pane. A lead Pane is fitted here; a member's Pane is
 *   fitted by that member's own terminal service over the projection the lead already dials. Nothing
 *   crosses the crew link and no multiplexer socket is dialled across a machine.
 *
 * The browser names a Pane, its scope and a column count. It never names rows, a socket, a terminal
 * or a command, and any field or parameter beyond those is a refusal rather than something ignored.
 */

import type { JsonValue } from "../../bridge/json.ts";
import { jsonNumberField, jsonRecord } from "../../bridge/stt/json.ts";
import { isPaneId, isScopeValue } from "../terminal/admit.ts";
import { PEER_RESIZE_PATH, peerControlUrl } from "../terminal/peer-start.ts";
import type { MemberTerminalEndpoint } from "../terminal/resolve.ts";
import { validPaneFitColumns } from "./controller.ts";
import { paneFitFailure, type LocalPaneFit, type PaneFitFailure, type PaneFitResult } from "./local.ts";

export const PANE_FIT_PATH = "/fleet/api/pane-fit";
const RESIZE_ROUTE = /^\/fleet\/api\/pane\/([^/]+)\/resize$/;
const SCOPE_PARAMS = new Set(["h", "s"]);
const MEMBER_TIMEOUT_MS = 10_000;

/** Whether a path is this module's, so the Gateway answers it with 401 rather than a login page. */
export function isPaneFitPath(pathname: string): boolean {
  return pathname === PANE_FIT_PATH || RESIZE_ROUTE.test(pathname);
}

export interface PaneFitRouteDeps {
  /** The lead's own fit, or null when this machine cannot run the multiplexer command. */
  readonly local: LocalPaneFit | null;
  /** The validated reachability list; a member without `terminal` cannot fit. */
  readonly members: () => readonly MemberTerminalEndpoint[];
  /** Injected so a member's answer can be driven in a test without a listener. */
  readonly post?: ((url: string, body: string, signal: AbortSignal) => Promise<Response>) | undefined;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

export interface PaneFitAnswer {
  readonly status: number;
  readonly body: JsonValue;
}

const invalid: PaneFitAnswer = { status: 400, body: { error: "invalid request" } };

/** Read the one body shape a resize may have: `{cols}` and nothing else. */
export function readResizeBody(value: JsonValue): number | null {
  const record = jsonRecord(value);
  if (record === null) return null;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "cols") return null;
  const cols = jsonNumberField(record.cols);
  return cols !== null && validPaneFitColumns(cols) ? cols : null;
}

const FAILURES: readonly PaneFitFailure[] = ["unsupported", "geometry", "conflict", "failed"];

/** A member's answer, narrowed. Anything that is not exactly a result is a failed resize. */
export function readMemberAnswer(status: number, value: JsonValue): PaneFitResult {
  const record = jsonRecord(value);
  if (status !== 200 || record === null) return paneFitFailure("failed");
  if (record.ok === true) {
    const cols = jsonNumberField(record.cols);
    const rows = jsonNumberField(record.rows);
    if (cols !== null && rows !== null && Number.isInteger(cols) && Number.isInteger(rows) && rows > 0) {
      return { ok: true, cols, rows };
    }
    return paneFitFailure("failed");
  }
  const reason = FAILURES.find((failure) => failure === record.reason);
  return paneFitFailure(reason ?? "failed");
}

function availability(deps: PaneFitRouteDeps): JsonValue {
  return {
    lead: deps.local !== null,
    members: deps.members().filter((member) => member.terminal !== undefined).map((member) => member.memberId),
  };
}

async function askMember(
  deps: PaneFitRouteDeps,
  member: MemberTerminalEndpoint,
  paneId: string,
  cols: number,
): Promise<PaneFitResult> {
  const endpoint = member.terminal;
  if (endpoint === undefined) return paneFitFailure("unsupported");
  const post =
    deps.post ??
    ((url: string, body: string, signal: AbortSignal) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal }));
  try {
    const response = await post(
      peerControlUrl(endpoint, PEER_RESIZE_PATH),
      JSON.stringify({ pane: paneId, cols }),
      AbortSignal.timeout(MEMBER_TIMEOUT_MS),
    );
    let value: JsonValue = null;
    try {
      // SAFETY: Response.json() yields the JSON representation; readMemberAnswer narrows every field.
      value = (await response.json()) as JsonValue;
    } catch {
      value = null;
    }
    return readMemberAnswer(response.status, value);
  } catch {
    // An unreachable or silent member is an ordinary failed resize, never a claim that one happened.
    return paneFitFailure("failed");
  }
}

/**
 * Answer a request on this module's paths, or null when the path is not one of them.
 *
 * The caller has already required a session and applied the unsafe-method origin rule.
 */
export async function paneFitResponse(
  request: Request,
  url: URL,
  deps: PaneFitRouteDeps,
): Promise<PaneFitAnswer | null> {
  if (url.pathname === PANE_FIT_PATH) {
    if (request.method !== "GET") return { status: 405, body: { error: "method not allowed" } };
    if (url.searchParams.size > 0) return invalid;
    return { status: 200, body: availability(deps) };
  }
  const match = url.pathname.match(RESIZE_ROUTE);
  if (match === null) return null;
  if (request.method !== "POST") return { status: 405, body: { error: "method not allowed" } };

  let paneId: string;
  try {
    paneId = decodeURIComponent(match[1]!);
  } catch {
    return invalid;
  }
  if (!isPaneId(paneId)) return invalid;
  for (const name of url.searchParams.keys()) if (!SCOPE_PARAMS.has(name)) return invalid;
  const host = url.searchParams.get("h");
  const session = url.searchParams.get("s");
  if ((host !== null && !isScopeValue(host)) || (session !== null && !isScopeValue(session))) return invalid;

  let body: JsonValue;
  try {
    // SAFETY: Request.json() yields the JSON representation; readResizeBody closes it to `{cols}`.
    body = (await request.json()) as JsonValue;
  } catch {
    return invalid;
  }
  const cols = readResizeBody(body);
  if (cols === null) return invalid;

  let result: PaneFitResult;
  if (host === null) {
    result = deps.local === null ? paneFitFailure("unsupported") : await deps.local.resize(paneId, cols);
  } else {
    const member = deps.members().find((entry) => entry.memberId === host);
    result = member === undefined ? paneFitFailure("unsupported") : await askMember(deps, member, paneId, cols);
  }

  // One line per attempt: the Pane, its Host, the request and the outcome. Never a terminal id, a
  // session id or anything read off the terminal.
  const where = { pane: paneId, host: host ?? "lead", cols };
  deps.log?.(
    "pane-fit.resize",
    result.ok ? { ...where, outcome: "resized", rows: result.rows } : { ...where, outcome: result.reason },
  );
  return { status: 200, body: result };
}
