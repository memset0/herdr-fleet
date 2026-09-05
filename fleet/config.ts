import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { jsonNumberField, jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonObject, JsonValue } from "../bridge/json.ts";
import { isMemberId } from "../bridge/pack/identity.ts";

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

export interface FleetPublicConfig {
  readonly origin: string;
  readonly host: string;
}

export interface FleetAuthConfig {
  readonly username: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
  readonly rateLimit: FleetRateLimitConfig;
}

/**
 * The lead's own pack timing, handed to Collie as the two variables it already reads.
 *
 * Not invented here: `COLLIE_POLL_MS` and `COLLIE_PACK_TIMEOUT_MS` are upstream's, and upstream
 * clamps the budget to a fraction of the poll interval. This is the place to STATE them, because a
 * plugin the Herdr runtime launches has no per-plugin environment and there was nowhere else.
 */
export interface FleetPackTimingConfig {
  readonly pollMs?: number;
  readonly timeoutMs?: number;
}

export interface FleetGatewayConfig {
  readonly listen: { readonly host: "127.0.0.1" | "::1"; readonly port: number };
  readonly public: FleetPublicConfig;
  readonly auth: FleetAuthConfig;
  readonly proxy: { readonly clientIpHeader: string };
  /** Absent unless the configuration states it; an omitted section leaves Collie's defaults alone. */
  readonly pack?: FleetPackTimingConfig;
}

export interface FleetSchema1LeadConfig extends FleetGatewayConfig {
  readonly schemaVersion: 1;
  readonly role: "lead";
  readonly collie: FleetLoopbackEndpoint;
}

export interface FleetNativePackLifecycle {
  readonly mode: "native-pack";
  readonly packState: "collie";
}

export interface FleetLoopbackEndpoint {
  readonly host: "127.0.0.1" | "::1";
  readonly port: number;
}

/**
 * One member id projected onto the loopback endpoint the Lead dials it at. It is a projection of the
 * membership Collie's trust store already owns, never a source of it, so it carries no certificate,
 * secret, key, account or command.
 */
export interface FleetReachabilityEntry extends FleetLoopbackEndpoint {
  readonly memberId: string;
}

/**
 * The Peer's single outbound link. `leadBind` is where the Lead dials this Peer; the endpoint behind
 * it is the Peer's own `collie` table rather than a second copy of that fact. `peerBind` is this
 * Peer's local projection of `leadCollie`.
 */
export interface FleetTransportConfig {
  readonly mode: "ssh-reverse";
  readonly sshHost: string;
  readonly sshPort: number;
  readonly sshUser: string;
  readonly identityFile: string;
  readonly knownHostsFile: string;
  readonly leadBind: FleetLoopbackEndpoint;
  readonly peerBind: FleetLoopbackEndpoint;
  readonly leadCollie: FleetLoopbackEndpoint;
  readonly retryMaxSeconds: number;
}

export interface FleetSchema2LeadConfig extends FleetGatewayConfig {
  readonly schemaVersion: 2;
  readonly role: "lead";
  readonly lifecycle: FleetNativePackLifecycle;
  readonly collie: FleetLoopbackEndpoint;
  readonly reachability: readonly FleetReachabilityEntry[];
}

export interface FleetSchema2PeerConfig {
  readonly schemaVersion: 2;
  readonly role: "peer";
  readonly lifecycle: FleetNativePackLifecycle;
  readonly collie: FleetLoopbackEndpoint;
  readonly transport: FleetTransportConfig;
}

export type FleetLeadConfig = FleetSchema1LeadConfig | FleetSchema2LeadConfig;
export type FleetNativePackConfig = FleetSchema2LeadConfig | FleetSchema2PeerConfig;
export type FleetConfig = FleetSchema1LeadConfig | FleetNativePackConfig;

export function isFleetLeadConfig(config: FleetConfig): config is FleetLeadConfig {
  return config.role === "lead";
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

/**
 * The optional `[pack]` section.
 *
 * Both bounds are the ones upstream itself enforces, restated here so a typo fails at load rather
 * than at the first sweep. A budget larger than the poll interval allows is NOT rejected: upstream's
 * own clamp decides what is granted and says so in its log, and refusing it here would hide the
 * operator's intent behind a second opinion about the same arithmetic.
 */
function packTimingConfig(value: JsonValue | undefined): FleetPackTimingConfig | undefined {
  if (value === undefined) return undefined;
  const raw = table(value, "pack");
  exactKeys(raw, ["poll_ms", "timeout_ms"], "pack");
  const pollMs = raw.poll_ms === undefined ? undefined : integer(raw.poll_ms, "pack.poll_ms", 250, 600_000);
  const timeoutMs =
    raw.timeout_ms === undefined ? undefined : integer(raw.timeout_ms, "pack.timeout_ms", 1, 600_000);
  if (pollMs === undefined && timeoutMs === undefined) throw new Error("pack states neither poll_ms nor timeout_ms");
  const timing: FleetPackTimingConfig = {
    ...(pollMs === undefined ? undefined : { pollMs }),
    ...(timeoutMs === undefined ? undefined : { timeoutMs }),
  };
  return timing;
}

function proxyConfig(value: JsonValue | undefined): FleetGatewayConfig["proxy"] {
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

function collieConfig(value: JsonValue | undefined): FleetLoopbackEndpoint {
  const raw = table(value, "collie");
  exactKeys(raw, ["host", "port"], "collie");
  return {
    host: loopbackHost(raw.host, "collie.host"),
    port: integer(raw.port, "collie.port", 1, 65_535),
  };
}

/**
 * A loopback endpoint spelled as two sibling fields inside a larger table. Every projection endpoint
 * this schema admits goes through `loopbackHost`, so a wildcard, any-address or empty bind is
 * refused here rather than by the SSH client after a connection has already been attempted.
 */
function loopbackEndpoint(raw: JsonObject, prefix: string, label: string): FleetLoopbackEndpoint {
  return {
    host: loopbackHost(raw[`${prefix}_host`], `${label}.${prefix}_host`),
    port: integer(raw[`${prefix}_port`], `${label}.${prefix}_port`, 1, 65_535),
  };
}

function sameEndpoint(left: FleetLoopbackEndpoint, right: FleetLoopbackEndpoint): boolean {
  return left.host === right.host && left.port === right.port;
}

function absolutePath(value: JsonValue | undefined, label: string): string {
  const path = text(value, label);
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path`);
  return path;
}

function transportConfig(value: JsonValue | undefined, collie: FleetLoopbackEndpoint): FleetTransportConfig {
  const raw = table(value, "transport");
  exactKeys(
    raw,
    [
      "mode",
      "ssh_host",
      "ssh_port",
      "ssh_user",
      "identity_file",
      "known_hosts_file",
      "lead_bind_host",
      "lead_bind_port",
      "peer_bind_host",
      "peer_bind_port",
      "lead_collie_host",
      "lead_collie_port",
      "retry_max_seconds",
    ],
    "transport",
  );
  // One mode literal, and only the one with a runtime behind it. A second literal accepted here
  // would read as supported while nothing consumes it.
  if (raw.mode !== "ssh-reverse") throw new Error("transport.mode must be ssh-reverse");
  const sshHost = text(raw.ssh_host, "transport.ssh_host");
  if (!/^[A-Za-z0-9._:-]{1,253}$/.test(sshHost)) {
    throw new Error("transport.ssh_host must be a hostname or address");
  }
  const sshUser = text(raw.ssh_user, "transport.ssh_user");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(sshUser)) {
    throw new Error("transport.ssh_user must be 1 to 64 safe characters");
  }
  const leadBind = loopbackEndpoint(raw, "lead_bind", "transport");
  const peerBind = loopbackEndpoint(raw, "peer_bind", "transport");
  const leadCollie = loopbackEndpoint(raw, "lead_collie", "transport");
  // Both Lead-side endpoints live on one machine, so a collision would have the reverse projection
  // fight the Lead's own Collie listener for the port.
  if (sameEndpoint(leadBind, leadCollie)) {
    throw new Error("transport.lead_bind and transport.lead_collie must use distinct endpoints");
  }
  // Both Peer-side endpoints live on this machine, and the local projection must not shadow the
  // Collie listener the reverse projection publishes.
  if (sameEndpoint(peerBind, collie)) {
    throw new Error("transport.peer_bind and collie must use distinct endpoints");
  }
  return {
    mode: "ssh-reverse",
    sshHost,
    sshPort: integer(raw.ssh_port ?? 22, "transport.ssh_port", 1, 65_535),
    sshUser,
    identityFile: absolutePath(raw.identity_file, "transport.identity_file"),
    knownHostsFile: absolutePath(raw.known_hosts_file, "transport.known_hosts_file"),
    leadBind,
    peerBind,
    leadCollie,
    retryMaxSeconds: integer(raw.retry_max_seconds ?? 60, "transport.retry_max_seconds", 1, 3_600),
  };
}

function reachabilityList(value: JsonValue | undefined): readonly FleetReachabilityEntry[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("reachability must be a list of tables");
  const entries: FleetReachabilityEntry[] = [];
  for (const [index, item] of value.entries()) {
    const label = `reachability[${index}]`;
    const raw = table(item, label);
    exactKeys(raw, ["member_id", "host", "port"], label);
    const memberId = text(raw.member_id, `${label}.member_id`);
    if (!isMemberId(memberId)) throw new Error(`${label}.member_id must be a Pack member id`);
    const entry: FleetReachabilityEntry = {
      memberId,
      host: loopbackHost(raw.host, `${label}.host`),
      port: integer(raw.port, `${label}.port`, 1, 65_535),
    };
    if (entries.some((seen) => seen.memberId === entry.memberId)) {
      throw new Error(`${label}.member_id is already mapped`);
    }
    if (entries.some((seen) => sameEndpoint(seen, entry))) {
      throw new Error(`${label} reuses an endpoint already mapped to another member`);
    }
    entries.push(entry);
  }
  return entries;
}

function gatewayConfig(root: JsonObject): FleetGatewayConfig {
  const listen = table(root.listen, "listen");
  exactKeys(listen, ["host", "port"], "listen");
  const publicTable = table(root.public, "public");
  exactKeys(publicTable, ["origin"], "public");
  const auth = table(root.auth, "auth");
  exactKeys(auth, ["username", "password_hash", "session_secret", "session_ttl_seconds", "rate_limit"], "auth");
  const normalized: FleetGatewayConfig = {
    listen: {
      host: loopbackHost(listen.host, "listen.host"),
      port: integer(listen.port, "listen.port", 1, 65_535),
    },
    public: publicOrigin(publicTable.origin),
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
  const pack = packTimingConfig(root.pack);
  if (pack === undefined) return normalized;
  return { ...normalized, pack };
}

function assertDistinctEndpoints(config: FleetLeadConfig): void {
  if (config.listen.host === config.collie.host && config.listen.port === config.collie.port) {
    throw new Error("listen and collie must use distinct loopback endpoints");
  }
}

function parseSchema1(root: JsonObject): FleetSchema1LeadConfig {
  exactKeys(root, ["schema_version", "role", "listen", "public", "collie", "auth", "proxy", "pack"], "fleet.toml");
  if (root.role !== "lead") {
    throw new Error(root.role === "peer" ? "role peer is not supported in schema version 1" : "role must be lead");
  }
  const normalized: FleetSchema1LeadConfig = {
    schemaVersion: 1,
    role: "lead",
    ...gatewayConfig(root),
    collie: collieConfig(root.collie),
  };
  assertDistinctEndpoints(normalized);
  return normalized;
}

function nativePackLifecycle(value: JsonValue | undefined): FleetNativePackLifecycle {
  const raw = table(value, "lifecycle");
  exactKeys(raw, ["mode", "pack_state"], "lifecycle");
  if (raw.mode !== "native-pack") throw new Error("lifecycle.mode must be native-pack");
  if (raw.pack_state !== "collie") throw new Error("lifecycle.pack_state must be collie");
  return { mode: "native-pack", packState: "collie" };
}

function parseSchema2(root: JsonObject): FleetNativePackConfig {
  if (root.role !== "lead" && root.role !== "peer") throw new Error("role must be lead or peer");
  if (root.role === "peer") {
    exactKeys(root, ["schema_version", "role", "lifecycle", "collie", "transport"], "fleet.toml");
    const collie = collieConfig(root.collie);
    return {
      schemaVersion: 2,
      role: "peer",
      lifecycle: nativePackLifecycle(root.lifecycle),
      collie,
      transport: transportConfig(root.transport, collie),
    };
  }
  exactKeys(
    root,
    [
      "schema_version",
      "role",
      "lifecycle",
      "listen",
      "public",
      "collie",
      "auth",
      "proxy",
      "reachability",
      "pack",
    ],
    "fleet.toml",
  );
  const normalized: FleetSchema2LeadConfig = {
    schemaVersion: 2,
    role: "lead",
    lifecycle: nativePackLifecycle(root.lifecycle),
    collie: collieConfig(root.collie),
    reachability: reachabilityList(root.reachability),
    ...gatewayConfig(root),
  };
  assertDistinctEndpoints(normalized);
  return normalized;
}

export function parseFleetConfig(value: JsonValue): FleetConfig {
  const root = table(value, "fleet.toml");
  if (root.schema_version === 1) return parseSchema1(root);
  if (root.schema_version === 2) return parseSchema2(root);
  throw new Error("schema_version must be 1 or 2");
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
