import type { FleetLeadConfig } from "./config.ts";
import { createGatewayHandler, type GatewayOptions, type TerminalUpgrade } from "./gateway.ts";
import { NOTICE, type BrowserSocket, type TerminalConnection } from "./terminal/connection.ts";
import type { TerminalService } from "./terminal/service.ts";

export type FleetGatewayServer = ReturnType<typeof Bun.serve>;

/**
 * What rides on an upgraded socket: the admission the handler already made, and the connection once
 * the socket is open. The connection cannot be built during `fetch` — there is no socket yet — so
 * this is the one mutable field in the request path, and it is written exactly once.
 */
interface TerminalSocketData {
  readonly upgrade: TerminalUpgrade;
  connection: TerminalConnection | null;
}

export interface FleetServerOptions extends GatewayOptions {
  /**
   * Absent means this deployment serves no terminals: the route then answers as it does for any
   * capability the Gateway does not have, rather than upgrading and failing afterwards.
   */
  readonly terminal?: TerminalService | undefined;
}

/** A frame in a buffer the socket owns the whole of. */
function wire(frame: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(frame.byteLength);
  new Uint8Array(copy).set(frame);
  return copy;
}

export function startGateway(options: FleetServerOptions): FleetGatewayServer {
  const handler = createGatewayHandler(options);
  const config: FleetLeadConfig = options.config;
  const terminal = options.terminal;
  return Bun.serve<TerminalSocketData>({
    hostname: config.listen.host,
    port: config.listen.port,
    maxRequestBodySize: 10 * 1024 * 1024,
    fetch: (request, server) =>
      handler(request, {
        peerAddress: server.requestIP(request)?.address ?? "",
        upgrade:
          terminal === undefined
            ? undefined
            : (upgradeRequest: Request, data: TerminalUpgrade) =>
                server.upgrade(upgradeRequest, { data: { upgrade: data, connection: null } }),
      }),
    websocket: {
      open(ws) {
        const socket: BrowserSocket = {
          send: (frame) => {
            ws.send(wire(frame));
          },
          close: () => {
            ws.close();
          },
        };
        ws.data.connection = terminal?.open(ws.data.upgrade, socket) ?? null;
      },
      message(ws, message) {
        const connection = ws.data.connection;
        if (connection === null) return;
        // This grammar is binary. A text frame is not a message with a missing byte, it is a client
        // speaking something else, and the connection ends rather than guessing at it.
        if (!ArrayBuffer.isView(message)) {
          connection.end(NOTICE.protocol);
          return;
        }
        connection.message(new Uint8Array(message.buffer, message.byteOffset, message.byteLength));
      },
      close(ws) {
        const connection = ws.data.connection;
        if (connection === null) return;
        ws.data.connection = null;
        terminal?.closed(connection);
      },
    },
  });
}
