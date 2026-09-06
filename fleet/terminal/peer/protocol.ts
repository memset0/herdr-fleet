/**
 * What a member's terminal service will answer, and the exact shape it must be asked in.
 *
 * Three operations, and the grammar is closed around them: request a Pane's terminal, close a Pane's
 * terminal, report the service's own state. Everything a terminal needs beyond the Pane id — the
 * terminal itself, the executable, its arguments, the socket, the account it runs as — comes from
 * this member's own configuration and its own multiplexer server, so there is nowhere in this shape
 * for a caller to put one.
 *
 * A refusal names the field it refused. That is safe here in a way it is not on the Gateway's own
 * boundary: the only thing that can reach this service is the lead, over a loopback projection the
 * operator's own SSH published, and a diagnostic it cannot read is a diagnostic nobody reads.
 */

import { isPaneId } from "../admit.ts";
import type { JsonValue } from "../../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../../bridge/stt/json.ts";

export const ATTACH_PATH = "/terminal/attach";
export const CLOSE_PATH = "/terminal/close";
export const STATE_PATH = "/terminal/state";

export type PeerOperation =
  | { readonly kind: "attach"; readonly paneId: string }
  | { readonly kind: "close"; readonly paneId: string }
  | { readonly kind: "state" };

export interface PeerRefusal {
  /** The field or aspect that was refused, in the request's own terms. */
  readonly at: string;
  readonly message: string;
}

export type PeerRequestResult =
  | { readonly ok: true; readonly operation: PeerOperation }
  | { readonly ok: false; readonly refusal: PeerRefusal };

function refuse(at: string, message: string): PeerRequestResult {
  return { ok: false, refusal: { at, message } };
}

/** The only parameter an attach may carry. A second one is a refusal, not something to ignore. */
const ATTACH_PARAMS = new Set(["pane"]);

/** The only field a close body may carry. */
const CLOSE_FIELDS = new Set(["pane"]);

export interface PeerRequestInput {
  readonly method: string;
  readonly url: URL;
  /** Whether the request asked to become a stream. Only `attach` may. */
  readonly upgrade: boolean;
  /** The parsed JSON body, where there is one. */
  readonly body?: JsonValue | undefined;
}

export function readPeerRequest(input: PeerRequestInput): PeerRequestResult {
  const path = input.url.pathname;
  if (path === ATTACH_PATH) {
    if (input.method !== "GET") return refuse("method", "attach is a stream, opened with GET");
    if (!input.upgrade) return refuse("upgrade", "attach is a stream and must ask to become one");
    for (const name of input.url.searchParams.keys()) {
      if (!ATTACH_PARAMS.has(name)) return refuse(name, "attach names a Pane and nothing else");
    }
    const paneId = input.url.searchParams.get("pane") ?? "";
    if (!isPaneId(paneId)) return refuse("pane", "pane must be a Pane id");
    return { ok: true, operation: { kind: "attach", paneId } };
  }

  if (path === CLOSE_PATH) {
    if (input.method !== "POST") return refuse("method", "close is a POST");
    if (input.upgrade) return refuse("upgrade", "close is not a stream");
    if (input.url.searchParams.size > 0) return refuse("query", "close carries its Pane in its body");
    const body = jsonRecord(input.body);
    if (body === null) return refuse("body", "close takes one JSON object");
    const extra = Object.keys(body).find((key) => !CLOSE_FIELDS.has(key));
    if (extra !== undefined) return refuse(extra, "close names a Pane and nothing else");
    const paneId = jsonStringField(body.pane) ?? "";
    if (!isPaneId(paneId)) return refuse("pane", "pane must be a Pane id");
    return { ok: true, operation: { kind: "close", paneId } };
  }

  if (path === STATE_PATH) {
    if (input.method !== "GET") return refuse("method", "state is a GET");
    if (input.upgrade) return refuse("upgrade", "state is not a stream");
    if (input.url.searchParams.size > 0) return refuse("query", "state takes no parameters");
    return { ok: true, operation: { kind: "state" } };
  }

  return refuse("path", "this service answers three operations");
}

/** What `state` reports. Counts and timing only: never a Pane, a terminal, or anything on one. */
export interface PeerState {
  readonly held: number;
  readonly idleSeconds: number;
  readonly maxServers: number;
}
