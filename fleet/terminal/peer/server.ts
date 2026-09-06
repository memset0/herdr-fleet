/**
 * The member's terminal service as a listener.
 *
 * Thin on purpose: the grammar is in `protocol.ts`, the lifecycle is in `service.ts`, and what is
 * left here is a socket, a loopback check, and a pipe. The pipe is the interesting part — this
 * service does not speak a protocol of its own over the stream, it forwards the terminal server's
 * own frames byte for byte, which is why the lead's client is the same client it uses for a local
 * terminal and why nothing about the wire has to agree across the link twice.
 */

import type { JsonValue } from "../../../bridge/json.ts";
import type { FleetTerminalConfig } from "../../config.ts";
import { readPeerRequest, type PeerRefusal } from "./protocol.ts";
import type { PeerTerminalService } from "./service.ts";

const SERVER_WS_PROTOCOL = "tty";

/** What travels with an upgraded stream: which Pane it is for, and the socket it will be piped to. */
interface StreamData {
  readonly paneId: string;
  readonly endpoint: string;
  upstream: WebSocket | null;
  readonly pending: ArrayBuffer[];
}

function refusal(at: string, message: string, status = 400): Response {
  return Response.json({ error: "refused", at, message }, { status });
}

function isLoopback(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export interface PeerServerDeps {
  readonly service: PeerTerminalService;
  readonly config: FleetTerminalConfig;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

export function startPeerTerminalServer(deps: PeerServerDeps): ReturnType<typeof Bun.serve> {
  const { service, config } = deps;
  return Bun.serve<StreamData>({
    hostname: config.bind.host,
    port: config.bind.port,
    // Nothing here has a body worth the name: the one POST carries a Pane id.
    maxRequestBodySize: 4 * 1024,
    async fetch(request, server) {
      // Before the Pane, before the grammar, before anything: this service answers on one loopback
      // endpoint the operator's own SSH projects, and a connection from anywhere else is not it.
      const address = server.requestIP(request)?.address ?? "";
      if (!isLoopback(address)) {
        deps.log?.("peer-terminal.off-projection", { at: "peer" });
        return new Response("not found\n", { status: 404 });
      }
      const url = new URL(request.url);
      const upgrade = (request.headers.get("upgrade") ?? "").toLowerCase() === "websocket";
      let body: JsonValue | undefined;
      if (request.method === "POST") {
        try {
          // SAFETY: `request.json()` yields the JSON representation of the body; every field
          // `readPeerRequest` reads is narrowed there before it becomes a Pane id.
          body = (await request.json()) as JsonValue;
        } catch {
          return refusal("body", "close takes one JSON object");
        }
      }
      const read = readPeerRequest({ method: request.method, url, upgrade, body });
      if (!read.ok) {
        const { at, message }: PeerRefusal = read.refusal;
        return refusal(at, message);
      }
      const operation = read.operation;

      if (operation.kind === "state") return Response.json(service.state());
      if (operation.kind === "close") {
        service.close(operation.paneId);
        return Response.json({ ok: true });
      }

      const attached = await service.attach(operation.paneId);
      if (!attached.ok) return refusal("pane", attached.reason, 409);
      const upgraded = server.upgrade(request, {
        data: { paneId: operation.paneId, endpoint: attached.endpoint, upstream: null, pending: [] },
      });
      return upgraded ? undefined : refusal("upgrade", "the stream could not be opened");
    },
    websocket: {
      open(ws) {
        const upstream = new WebSocket(ws.data.endpoint, SERVER_WS_PROTOCOL);
        upstream.binaryType = "arraybuffer";
        ws.data.upstream = upstream;
        upstream.addEventListener("open", () => {
          // Anything the lead said while the terminal server was still opening is forwarded in
          // order: the first of those frames is the lead's own handshake, and it must arrive first.
          for (const frame of ws.data.pending.splice(0)) upstream.send(frame);
        });
        upstream.addEventListener("message", (event) => {
          const { data } = event;
          if (data instanceof ArrayBuffer) ws.send(data);
        });
        upstream.addEventListener("close", () => ws.close());
        upstream.addEventListener("error", () => ws.close());
      },
      message(ws, message) {
        // A byte pipe: this service does not read the terminal's wire and must not learn to.
        if (!ArrayBuffer.isView(message)) return;
        const frame = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength);
        const upstream = ws.data.upstream;
        if (upstream === null || upstream.readyState !== WebSocket.OPEN) {
          ws.data.pending.push(frame);
          return;
        }
        upstream.send(frame);
      },
      close(ws) {
        // The lead left. Its own `close` operation is what stops the terminal server; a dropped
        // stream is not that, because the lead may be holding this session through a grace period.
        ws.data.upstream?.close();
      },
    },
  });
}
