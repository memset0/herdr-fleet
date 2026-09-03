import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { jsonNumberField, jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonObject, JsonValue } from "../bridge/json.ts";

export const FLEET_CONFIG_FILENAME = "fleet.toml";
export const FLEET_CONFIG_ENV = "HERDR_FLEET_CONFIG";

export interface FleetRateLimitConfig {
  readonly maxFailures: number;
  readonly windowSeconds: number;
  readonly blockSeconds: number;
  readonly maxSources: number;
  readonly aggregateMaxFailures: number;
  readonly aggregateWindowSeconds: number;
  readonly aggregateBlockSeconds: number;
}

export interface FleetConfig {
  readonly schemaVersion: 1;
  readonly role: "lead";
  readonly listen: { readonly host: "127.0.0.1" | "::1"; readonly port: number };
  readonly public: FleetPublicConfig;
  readonly collie: { readonly host: "127.0.0.1" | "::1"; readonly port: number };
  readonly auth: {
    readonly username: string;
    readonly passwordHash: string;
    readonly sessionSecret: string;
    readonly sessionTtlSeconds: number;
    readonly rateLimit: FleetRateLimitConfig;
  };
  readonly proxy: { readonly clientIpHeader: string };
}

export interface FleetPublicConfig {
  readonly origin: string;
  readonly host: string;
}

function table(value: JsonValue | undefined, label: string): JsonObject {
  const found = jsonRecord(value);
  if (found === null) throw new Error(`${label} must be a table`);
  return found;
}

function exactKeys(value: JsonObject, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) throw new Error(`${label} contains unknown field ${extra[0]}`);
}

function text(value: JsonValue | undefined, label: string): string {
  const found = jsonStringField(value);
  if (found === null || found === "" || found.trim() !== found) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return found;
}

function integer(value: JsonValue | undefined, label: string, minimum: number, maximum: number): number {
  const found = jsonNumberField(value);
  if (found === null || !Number.isSafeInteger(found) || found < minimum || found > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return found;
}

function loopbackHost(value: JsonValue | undefined, label: string): "127.0.0.1" | "::1" {
  const host = text(value, label);
  if (host !== "127.0.0.1" && host !== "::1") throw new Error(`${label} must be a loopback address`);
  return host;
}

function publicOrigin(value: JsonValue | undefined): FleetPublicConfig {
  const raw = text(value, "public.origin");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("public.origin must be an HTTPS origin");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.hostname === ""
  ) {
    throw new Error("public.origin must be an HTTPS origin");
  }
  return { origin: url.origin, host: url.host };
}

function passwordHash(value: JsonValue | undefined): string {
  const hash = text(value, "auth.password_hash");
  const parameters = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash);
  if (
    parameters === null ||
    Number(parameters[1]) < 19_456 ||
    Number(parameters[2]) < 2 ||
    Number(parameters[3]) < 1
  ) {
    throw new Error("auth.password_hash must be an Argon2id hash with approved work factors");
  }
  return hash;
}

function sessionSecret(value: JsonValue | undefined): string {
  const secret = text(value, "auth.session_secret");
  if (!/^[A-Za-z0-9_-]+$/.test(secret) || Buffer.from(secret, "base64url").length < 32) {
    throw new Error("auth.session_secret must contain at least 32 random base64url bytes");
  }
  return secret;
}

function rateLimit(value: JsonValue | undefined): FleetRateLimitConfig {
  const raw = value === undefined ? {} : table(value, "auth.rate_limit");
  exactKeys(
    raw,
    [
      "max_failures",
      "window_seconds",
      "block_seconds",
      "max_sources",
      "aggregate_max_failures",
      "aggregate_window_seconds",
      "aggregate_block_seconds",
    ],
    "auth.rate_limit",
  );
  return {
    maxFailures: integer(raw.max_failures ?? 5, "auth.rate_limit.max_failures", 1, 100),
    windowSeconds: integer(raw.window_seconds ?? 600, "auth.rate_limit.window_seconds", 1, 86_400),
    blockSeconds: integer(raw.block_seconds ?? 900, "auth.rate_limit.block_seconds", 1, 86_400),
    maxSources: integer(raw.max_sources ?? 10_000, "auth.rate_limit.max_sources", 1, 100_000),
    aggregateMaxFailures: integer(
      raw.aggregate_max_failures ?? 50,
      "auth.rate_limit.aggregate_max_failures",
      1,
      10_000,
    ),
    aggregateWindowSeconds: integer(
      raw.aggregate_window_seconds ?? 60,
      "auth.rate_limit.aggregate_window_seconds",
      1,
      86_400,
    ),
    aggregateBlockSeconds: integer(
      raw.aggregate_block_seconds ?? 60,
      "auth.rate_limit.aggregate_block_seconds",
      1,
      86_400,
    ),
  };
}

function proxyConfig(value: JsonValue | undefined): FleetConfig["proxy"] {
  const raw = value === undefined ? {} : table(value, "proxy");
  exactKeys(raw, ["client_ip_header"], "proxy");
  const header = text(raw.client_ip_header ?? "X-Forwarded-For", "proxy.client_ip_header");
  if (!/^[A-Za-z0-9-]{1,64}$/.test(header)) {
    throw new Error("proxy.client_ip_header must be an HTTP header name");
  }
  const forbidden = new Set(["authorization", "cookie", "host", "origin", "tailscale-user-login"]);
  if (forbidden.has(header.toLowerCase())) throw new Error("proxy.client_ip_header is reserved");
  return { clientIpHeader: header };
}

export function parseFleetConfig(value: JsonValue): FleetConfig {
  const root = table(value, "fleet.toml");
  exactKeys(root, ["schema_version", "role", "listen", "public", "collie", "auth", "proxy"], "fleet.toml");
  if (root.schema_version !== 1) throw new Error("schema_version must be 1");
  if (root.role !== "lead") {
    throw new Error(root.role === "peer" ? "role peer is not supported in schema version 1" : "role must be lead");
  }

  const listen = table(root.listen, "listen");
  exactKeys(listen, ["host", "port"], "listen");
  const collie = table(root.collie, "collie");
  exactKeys(collie, ["host", "port"], "collie");
  const publicTable = table(root.public, "public");
  exactKeys(publicTable, ["origin"], "public");
  const auth = table(root.auth, "auth");
  exactKeys(auth, ["username", "password_hash", "session_secret", "session_ttl_seconds", "rate_limit"], "auth");

  const normalized: FleetConfig = {
    schemaVersion: 1,
    role: "lead",
    listen: {
      host: loopbackHost(listen.host, "listen.host"),
      port: integer(listen.port, "listen.port", 1, 65_535),
    },
    public: publicOrigin(publicTable.origin),
    collie: {
      host: loopbackHost(collie.host, "collie.host"),
      port: integer(collie.port, "collie.port", 1, 65_535),
    },
    auth: {
      username: text(auth.username, "auth.username"),
      passwordHash: passwordHash(auth.password_hash),
      sessionSecret: sessionSecret(auth.session_secret),
      sessionTtlSeconds: integer(auth.session_ttl_seconds ?? 86_400, "auth.session_ttl_seconds", 300, 2_592_000),
      rateLimit: rateLimit(auth.rate_limit),
    },
    proxy: proxyConfig(root.proxy),
  };
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(normalized.auth.username)) {
    throw new Error("auth.username must be 3 to 64 safe characters");
  }
  if (normalized.listen.host === normalized.collie.host && normalized.listen.port === normalized.collie.port) {
    throw new Error("listen and collie must use distinct loopback endpoints");
  }
  return normalized;
}

export function parseFleetToml(source: string): FleetConfig {
  let parsed: JsonValue;
  try {
    // SAFETY: Bun's TOML parser returns recursively structured primitives. This schema admits only
    // the JSON-shaped subset, and every field is narrowed again before use; TOML dates fail those
    // readers rather than reaching a domain value.
    parsed = Bun.TOML.parse(source) as JsonValue;
  } catch {
    throw new Error("fleet.toml is not valid TOML");
  }
  return parseFleetConfig(parsed);
}

export function resolveFleetConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env[FLEET_CONFIG_ENV]?.trim();
  if (explicit !== undefined && explicit !== "") {
    if (!isAbsolute(explicit)) throw new Error(`${FLEET_CONFIG_ENV} must be an absolute path`);
    return resolve(explicit);
  }
  const configDir = env.HERDR_PLUGIN_CONFIG_DIR?.trim();
  if (configDir === undefined || configDir === "") {
    throw new Error(`${FLEET_CONFIG_ENV} or HERDR_PLUGIN_CONFIG_DIR is required`);
  }
  if (!isAbsolute(configDir)) throw new Error("HERDR_PLUGIN_CONFIG_DIR must be an absolute path");
  return join(resolve(configDir), FLEET_CONFIG_FILENAME);
}

export async function loadFleetConfig(path: string): Promise<FleetConfig> {
  if (!isAbsolute(path)) throw new Error("fleet.toml path must be absolute");
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new Error("fleet.toml is unavailable");
  }
  if (!info.isFile()) throw new Error("fleet.toml must be a regular file");
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error("fleet.toml must not be accessible by group or other users (chmod 600)");
  }
  return parseFleetToml(await readFile(path, "utf8"));
}
