#!/usr/bin/env bun

import { createGatewayHandler } from "./server.ts";
import { loadGatewayConfig } from "./config.ts";
import { FleetCollector } from "./fleet.ts";
import { TransportRegistry } from "./transports.ts";

const configPath = process.argv[2];
if (!configPath) throw new Error("usage: gateway/index.ts /absolute/path/to/gateway.json");

const config = await loadGatewayConfig(configPath);
const transports = new TransportRegistry(config.nodes);
transports.start();
const collector = new FleetCollector(config, transports);
await collector.start();
const handler = createGatewayHandler({ config, collector, transports });

const server = Bun.serve({
  hostname: config.listen.host,
  port: config.listen.port,
  maxRequestBodySize: 16 * 1024 * 1024,
  fetch: handler,
});

process.stdout.write(
  `[gateway] listening on http://${server.hostname}:${server.port} for ${config.public.fleetHost} + ${config.nodes.filter((node) => node.enabled).length} node(s)\n`,
);

let stopping = false;
const shutdown = async (signal: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`[gateway] shutting down (${signal})\n`);
  collector.stop();
  transports.stop();
  await server.stop();
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
