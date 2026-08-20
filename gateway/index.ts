#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createGatewayHandler } from "./server.ts";
import { loadGatewayConfig } from "./config.ts";
import { FleetDiscordNotifier, PingmeDiscordSender } from "./discord-notifications.ts";
import { FleetCollector } from "./fleet.ts";
import { CollieFleetHistoryReader } from "./history.ts";
import { TransportRegistry } from "./transports.ts";

const configPath = process.argv[2];
if (!configPath) throw new Error("usage: gateway/index.ts /absolute/path/to/gateway.json");

const pluginVersion = (
  JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as { version: string }
).version;

const config = await loadGatewayConfig(configPath);
const transports = new TransportRegistry(config.nodes);
transports.start();
const discordConfig = config.discordNotifications?.enabled ? config.discordNotifications : null;
const discordNotifier = discordConfig
  ? new FleetDiscordNotifier(config.public.fleetHost, new PingmeDiscordSender(discordConfig), {
      history: new CollieFleetHistoryReader(config, transports),
    })
  : null;
const collector = new FleetCollector(config, transports, fetch, Date.now, {
  ...(discordNotifier ? { onCycle: (state) => discordNotifier.observe(state) } : {}),
});
const handler = createGatewayHandler({ config, collector, transports, pluginVersion });

const server = Bun.serve({
  hostname: config.listen.host,
  port: config.listen.port,
  maxRequestBodySize: 16 * 1024 * 1024,
  fetch: handler,
});

process.stdout.write(
  `[gateway] listening on http://${server.hostname}:${server.port} for ${config.public.fleetHost} + ${config.nodes.filter((node) => node.enabled).length} node(s)\n`,
);
if (discordConfig) {
  process.stdout.write(`[gateway] Discord Agent alerts enabled for channel ${discordConfig.channel}\n`);
  collector.startBackgroundRefresh();
}

let stopping = false;
const shutdown = async (signal: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`[gateway] shutting down (${signal})\n`);
  collector.stopBackgroundRefresh();
  transports.stop();
  await server.stop();
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
