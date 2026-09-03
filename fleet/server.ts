import type { FleetConfig } from "./config.ts";
import { createGatewayHandler, type GatewayOptions } from "./gateway.ts";

export type FleetGatewayServer = ReturnType<typeof Bun.serve>;

export function startGateway(options: GatewayOptions): FleetGatewayServer {
  const handler = createGatewayHandler(options);
  const config: FleetConfig = options.config;
  return Bun.serve({
    hostname: config.listen.host,
    port: config.listen.port,
    maxRequestBodySize: 10 * 1024 * 1024,
    fetch: (request, server) =>
      handler(request, { peerAddress: server.requestIP(request)?.address ?? "" }),
  });
}
