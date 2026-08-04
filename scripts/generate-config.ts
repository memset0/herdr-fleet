#!/usr/bin/env bun

import { randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

interface Options {
  configDir: string;
  fleetHost: string;
  baseDomain: string;
  nodeHost: string;
  nodeId: string;
  nodeName: string;
  gatewayPort: number;
  colliePort: number;
}

function usage(): never {
  throw new Error(
    "usage: generate-config.ts --config-dir /absolute/path --fleet-host herdr.example.com " +
      "--base-domain herdr.example.com --node-host local.herdr.example.com [--node-id local] [--node-name Local] " +
      "[--gateway-port 18787] [--collie-port 18788]",
  );
}

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) usage();
    values.set(key.slice(2), value);
  }
  const required = (key: string): string => values.get(key)?.trim() || usage();
  const port = (key: string, fallback: number): number => {
    const raw = values.get(key) ?? String(fallback);
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) usage();
    return parsed;
  };
  const configDir = resolve(required("config-dir"));
  if (!isAbsolute(configDir)) usage();
  return {
    configDir,
    fleetHost: required("fleet-host").toLowerCase(),
    baseDomain: required("base-domain").toLowerCase(),
    nodeHost: required("node-host").toLowerCase(),
    nodeId: values.get("node-id")?.trim() || "local",
    nodeName: values.get("node-name")?.trim() || "Local",
    gatewayPort: port("gateway-port", 18787),
    colliePort: port("collie-port", 18788),
  };
}

const options = parseArgs(process.argv.slice(2));
const username = `herdr-${randomBytes(5).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id", memoryCost: 65_536, timeCost: 3 });
const sessionSecret = randomBytes(48).toString("base64url");
const gatewayPath = join(options.configDir, "gateway.json");
const envPath = join(options.configDir, ".env");

const gateway = {
  listen: { host: "127.0.0.1", port: options.gatewayPort },
  public: {
    scheme: "https",
    fleetHost: options.fleetHost,
    baseDomain: options.baseDomain,
    cookieName: "__Secure-herdr_web_session",
    sessionTtlSeconds: 604_800,
  },
  auth: { username, passwordHash, sessionSecret },
  pollIntervalMs: 5_000,
  nodes: [
    {
      id: options.nodeId,
      name: options.nodeName,
      publicHost: options.nodeHost,
      enabled: true,
      labels: ["local"],
      transport: { type: "local", url: `http://127.0.0.1:${options.colliePort}` },
    },
  ],
};
const env = [
  "COLLIE_HOST=127.0.0.1",
  `COLLIE_PORT=${options.colliePort}`,
  "COLLIE_SKIP_SERVE=1",
  `COLLIE_PUBLIC_HOSTS=${options.nodeHost}`,
  `COLLIE_ALLOWED_ORIGINS=https://${options.nodeHost}`,
  "COLLIE_MULTI_SESSION=1",
  `HERDR_WEB_GATEWAY_CONFIG=${gatewayPath}`,
  "HERDR_WEB_DISALLOW_JOBS=1",
  "",
].join("\n");

await mkdir(options.configDir, { recursive: true, mode: 0o700 });
await chmod(options.configDir, 0o700);
await writeFile(gatewayPath, `${JSON.stringify(gateway, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
try {
  await writeFile(envPath, env, { encoding: "utf8", mode: 0o600, flag: "wx" });
} catch (error) {
  await Bun.file(gatewayPath).delete();
  throw error;
}
await chmod(gatewayPath, 0o600);
await chmod(envPath, 0o600);
process.stdout.write(`${JSON.stringify({ username, password, gatewayPath, envPath })}\n`);
