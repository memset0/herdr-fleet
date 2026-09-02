import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
  type FleetShortcutConfiguration,
} from "../shared/fleet-commands.ts";

export interface LocalTransportConfig {
  type: "local";
  url: string;
}

export interface SshJumpConfig {
  host: string;
  user: string;
  port: number;
  identityFile: string;
  knownHostsFile: string;
}

export interface SshTransportConfig {
  type: "ssh";
  host: string;
  user: string;
  port: number;
  identityFile: string;
  knownHostsFile: string;
  localPort: number;
  remoteHost: "127.0.0.1" | "::1";
  remotePort: number;
  jump?: SshJumpConfig;
}

export type NodeTransportConfig = LocalTransportConfig | SshTransportConfig;

export interface NodeConfig {
  id: string;
  name: string;
  publicHost: string;
  enabled: boolean;
  labels: string[];
  transport: NodeTransportConfig;
}

export type DiscordNotificationConfig =
  | {
      enabled: false;
      executable?: string;
      channel?: string;
      template?: string;
    }
  | {
      enabled: true;
      executable: string;
      channel: string;
      template?: string;
    };

export interface FleetUiConfig {
  iframeCacheSize: number;
  shortcuts: FleetShortcutConfiguration;
  shortcutsFile?: string;
}

export interface GatewayConfig {
  listen: { host: "127.0.0.1" | "::1"; port: number };
  public: {
    scheme: "https";
    fleetHost: string;
    baseDomain: string;
    cookieName: string;
    sessionTtlSeconds: number;
  };
  auth: { username: string; passwordHash: string; sessionSecret: string };
  pollIntervalMs: number;
  fleetUi: FleetUiConfig;
  discordNotifications?: DiscordNotificationConfig;
  nodes: NodeConfig[];
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function keys(value: JsonObject, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} contains unknown field(s): ${extra.join(", ")}`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value as number;
}

export function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  const value = raw.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end >= 0 ? value.slice(1, end) : "";
  }
  return value.split(":", 1)[0] ?? "";
}

function hostname(value: unknown, label: string): string {
  const host = string(value, label).toLowerCase().replace(/\.$/, "");
  if (host.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) {
    throw new Error(`${label} is not a valid DNS hostname`);
  }
  return host;
}

function absolutePath(value: unknown, label: string): string {
  const path = string(value, label);
  if (!isAbsolute(path)) throw new Error(`${label} must be absolute`);
  return path;
}

function optionalSelector(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  const selector = string(value, label);
  if (selector.length > max || /[\u0000-\u001f\u007f]/.test(selector)) {
    throw new Error(`${label} is invalid`);
  }
  return selector;
}

function parseDiscordNotifications(value: unknown): DiscordNotificationConfig | undefined {
  if (value === undefined) return undefined;
  const raw = object(value, "discordNotifications");
  keys(raw, ["enabled", "executable", "channel", "template"], "discordNotifications");
  if (typeof raw.enabled !== "boolean") throw new Error("discordNotifications.enabled must be a boolean");

  const executable = raw.executable === undefined ? undefined : absolutePath(raw.executable, "discordNotifications.executable");
  const channel = optionalSelector(raw.channel, "discordNotifications.channel", 128);
  const template = optionalSelector(raw.template, "discordNotifications.template", 4_096);
  if (channel && !/^(?:[0-9]{1,32}|(?=[A-Za-z0-9_-]{1,64}$)(?=.*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_-]*)$/.test(channel)) {
    throw new Error("discordNotifications.channel must be a numeric id or configured alias");
  }
  if (raw.enabled && (!executable || !channel)) {
    throw new Error("enabled discordNotifications require executable and channel");
  }
  return raw.enabled
    ? { enabled: true, executable: executable!, channel: channel!, ...(template ? { template } : {}) }
    : {
        enabled: false,
        ...(executable ? { executable } : {}),
        ...(channel ? { channel } : {}),
        ...(template ? { template } : {}),
      };
}

function parseFleetUi(value: unknown): FleetUiConfig {
  const shortcuts = parseFleetShortcutDocument(publicFleetShortcutDocument(), { requireComplete: true });
  if (value === undefined) return { iframeCacheSize: 1, shortcuts };
  const raw = object(value, "fleetUi");
  keys(raw, ["iframeCacheSize", "shortcutsFile"], "fleetUi");
  const shortcutsFile = raw.shortcutsFile === undefined
    ? undefined
    : absolutePath(raw.shortcutsFile, "fleetUi.shortcutsFile");
  return {
    iframeCacheSize: integer(raw.iframeCacheSize ?? 1, "fleetUi.iframeCacheSize", 1, 10),
    shortcuts,
    ...(shortcutsFile ? { shortcutsFile } : {}),
  };
}

function parseLocalTransport(raw: JsonObject, label: string): LocalTransportConfig {
  keys(raw, ["type", "url"], label);
  const url = new URL(string(raw.url, `${label}.url`));
  if (url.protocol !== "http:" || !["127.0.0.1", "::1", "localhost"].includes(url.hostname)) {
    throw new Error(`${label}.url must be an http loopback URL`);
  }
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new Error(`${label}.url must contain only scheme, loopback host, and port`);
  }
  if (!url.port) throw new Error(`${label}.url must include an explicit port`);
  return { type: "local", url: url.origin };
}

function sshEndpoint(raw: JsonObject, label: string, validateKeys = true): SshJumpConfig {
  if (validateKeys) keys(raw, ["host", "user", "port", "identityFile", "knownHostsFile"], label);
  const host = hostname(raw.host, `${label}.host`);
  if (host.startsWith("-")) throw new Error(`${label}.host must not start with '-'`);
  const user = string(raw.user, `${label}.user`);
  if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(user)) throw new Error(`${label}.user is invalid`);
  return {
    host,
    user,
    port: integer(raw.port ?? 22, `${label}.port`, 1, 65535),
    identityFile: absolutePath(raw.identityFile, `${label}.identityFile`),
    knownHostsFile: absolutePath(raw.knownHostsFile, `${label}.knownHostsFile`),
  };
}

function parseSshTransport(raw: JsonObject, label: string): SshTransportConfig {
  keys(
    raw,
    ["type", "host", "user", "port", "identityFile", "knownHostsFile", "localPort", "remoteHost", "remotePort", "jump"],
    label,
  );
  const target = sshEndpoint(raw, label, false);
  const jump = raw.jump === undefined ? undefined : sshEndpoint(object(raw.jump, `${label}.jump`), `${label}.jump`);
  if (jump?.identityFile === target.identityFile) {
    throw new Error(`${label}.jump.identityFile must differ from the target identity`);
  }
  const remoteHost = string(raw.remoteHost, `${label}.remoteHost`);
  if (remoteHost !== "127.0.0.1" && remoteHost !== "::1") {
    throw new Error(`${label}.remoteHost must be 127.0.0.1 or ::1`);
  }
  return {
    type: "ssh",
    ...target,
    localPort: integer(raw.localPort, `${label}.localPort`, 1, 65535),
    remoteHost,
    remotePort: integer(raw.remotePort, `${label}.remotePort`, 1, 65535),
    ...(jump ? { jump } : {}),
  };
}

function parseNode(value: unknown, index: number, baseDomain: string): NodeConfig {
  const label = `nodes[${index}]`;
  const raw = object(value, label);
  keys(raw, ["id", "name", "publicHost", "enabled", "labels", "transport"], label);
  const id = string(raw.id, `${label}.id`);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(id)) throw new Error(`${label}.id is invalid`);
  const publicHost = hostname(raw.publicHost, `${label}.publicHost`);
  if (publicHost === baseDomain || !publicHost.endsWith(`.${baseDomain}`)) {
    throw new Error(`${label}.publicHost must be a subdomain of ${baseDomain}`);
  }
  const rawLabels = raw.labels ?? [];
  if (!Array.isArray(rawLabels) || rawLabels.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label}.labels must be an array of non-empty strings`);
  }
  const transportObject = object(raw.transport, `${label}.transport`);
  const type = string(transportObject.type, `${label}.transport.type`);
  const transport =
    type === "local"
      ? parseLocalTransport(transportObject, `${label}.transport`)
      : type === "ssh"
        ? parseSshTransport(transportObject, `${label}.transport`)
        : (() => {
            throw new Error(`${label}.transport.type must be local or ssh`);
          })();
  return {
    id,
    name: string(raw.name, `${label}.name`),
    publicHost,
    enabled:
      raw.enabled === undefined
        ? true
        : typeof raw.enabled === "boolean"
          ? raw.enabled
          : (() => {
              throw new Error(`${label}.enabled must be a boolean`);
            })(),
    labels: rawLabels.map((entry) => (entry as string).trim()),
    transport,
  };
}

export function parseGatewayConfig(value: unknown): GatewayConfig {
  const raw = object(value, "config");
  keys(raw, ["listen", "public", "auth", "pollIntervalMs", "fleetUi", "discordNotifications", "nodes"], "config");

  const listen = object(raw.listen, "listen");
  keys(listen, ["host", "port"], "listen");
  const listenHost = string(listen.host, "listen.host");
  if (listenHost !== "127.0.0.1" && listenHost !== "::1") throw new Error("listen.host must be loopback");
  const listenPort = integer(listen.port, "listen.port", 1, 65535);

  const publicConfig = object(raw.public, "public");
  keys(publicConfig, ["scheme", "fleetHost", "baseDomain", "cookieName", "sessionTtlSeconds"], "public");
  if (publicConfig.scheme !== "https") throw new Error("public.scheme must be https");
  const baseDomain = hostname(publicConfig.baseDomain, "public.baseDomain");
  const fleetHost = hostname(publicConfig.fleetHost, "public.fleetHost");
  if (fleetHost !== baseDomain && !fleetHost.endsWith(`.${baseDomain}`)) {
    throw new Error("public.fleetHost must equal or be below public.baseDomain");
  }
  const cookieName =
    publicConfig.cookieName === undefined
      ? "__Secure-herdr_web_session"
      : string(publicConfig.cookieName, "public.cookieName");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) throw new Error("public.cookieName is invalid");

  const auth = object(raw.auth, "auth");
  keys(auth, ["username", "passwordHash", "sessionSecret"], "auth");
  const username = string(auth.username, "auth.username");
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) throw new Error("auth.username is invalid");
  const passwordHash = string(auth.passwordHash, "auth.passwordHash");
  if (!passwordHash.startsWith("$argon2id$")) throw new Error("auth.passwordHash must be Argon2id");
  const sessionSecret = string(auth.sessionSecret, "auth.sessionSecret");
  if (!/^[A-Za-z0-9_-]+$/.test(sessionSecret) || Buffer.from(sessionSecret, "base64url").length < 32) {
    throw new Error("auth.sessionSecret must be at least 32 random base64url bytes");
  }

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) throw new Error("nodes must contain at least one instance");
  const nodes = raw.nodes.map((node, index) => parseNode(node, index, baseDomain));
  if (!nodes.some((node) => node.enabled)) throw new Error("nodes must contain at least one enabled instance");
  const ids = new Set<string>();
  const hosts = new Set<string>();
  const localPorts = new Set<number>([listenPort]);
  const sshIdentityPaths = new Map<string, string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    if (hosts.has(node.publicHost) || node.publicHost === fleetHost) throw new Error(`duplicate public host: ${node.publicHost}`);
    ids.add(node.id);
    hosts.add(node.publicHost);
    if (node.transport.type === "ssh") {
      if (node.enabled) {
        const existingNode = sshIdentityPaths.get(node.transport.identityFile);
        if (existingNode) {
          throw new Error(`duplicate SSH identity path: ${node.transport.identityFile} (${existingNode}, ${node.id})`);
        }
        sshIdentityPaths.set(node.transport.identityFile, node.id);
      }
      if (localPorts.has(node.transport.localPort)) throw new Error(`duplicate local listener port: ${node.transport.localPort}`);
      localPorts.add(node.transport.localPort);
    } else {
      const upstreamPort = Number(new URL(node.transport.url).port);
      if (localPorts.has(upstreamPort)) throw new Error(`duplicate local listener port: ${upstreamPort}`);
      localPorts.add(upstreamPort);
    }
  }

  const discordNotifications = parseDiscordNotifications(raw.discordNotifications);
  return {
    listen: { host: listenHost, port: listenPort },
    public: {
      scheme: "https",
      fleetHost,
      baseDomain,
      cookieName,
      sessionTtlSeconds: integer(publicConfig.sessionTtlSeconds ?? 604_800, "public.sessionTtlSeconds", 300, 2_592_000),
    },
    auth: { username, passwordHash, sessionSecret },
    pollIntervalMs: integer(raw.pollIntervalMs ?? 5_000, "pollIntervalMs", 1_000, 300_000),
    fleetUi: parseFleetUi(raw.fleetUi),
    ...(discordNotifications ? { discordNotifications } : {}),
    nodes,
  };
}

export async function loadGatewayConfig(path: string, enforcePermissions = process.platform !== "win32"): Promise<GatewayConfig> {
  if (!isAbsolute(path)) throw new Error("gateway config path must be absolute");
  if (enforcePermissions) {
    const info = await stat(path);
    if ((info.mode & 0o077) !== 0) throw new Error("gateway config must not be accessible by group or other users (chmod 600)");
  }
  let config = parseGatewayConfig(JSON.parse(await Bun.file(path).text()) as unknown);
  const shortcutSource = config.fleetUi.shortcutsFile
    ? Bun.file(config.fleetUi.shortcutsFile)
    : Bun.file(new URL("./shortcuts.default.json", import.meta.url));
  const shortcutInfo = await shortcutSource.stat().catch(() => null);
  if (!shortcutInfo?.isFile()) {
    throw new Error(config.fleetUi.shortcutsFile
      ? "fleetUi.shortcutsFile is unavailable or is not a regular file"
      : "packaged Fleet shortcut defaults are unavailable");
  }
  if (shortcutInfo.size > 1_048_576) throw new Error("Fleet shortcut config exceeds 1 MiB");
  let shortcutValue: unknown;
  try {
    shortcutValue = JSON.parse(await shortcutSource.text()) as unknown;
  } catch (error) {
    throw new Error(`Fleet shortcut config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const shortcuts = parseFleetShortcutDocument(shortcutValue);
  config = { ...config, fleetUi: { ...config.fleetUi, shortcuts } };
  if (config.discordNotifications?.enabled) {
    const executable = await stat(config.discordNotifications.executable).catch(() => null);
    if (!executable) throw new Error("discordNotifications.executable is unavailable");
    if (!executable.isFile() || (executable.mode & 0o111) === 0) {
      throw new Error("discordNotifications.executable must be a regular executable file");
    }
  }
  const sshIdentityDigests = new Map<string, string>();
  const jumpIdentityDigests = new Map<string, string>();

  async function identityDigest(identityPath: string, knownHostsPath: string, label: string): Promise<string> {
    const identity = await stat(identityPath);
    const knownHosts = await stat(knownHostsPath);
    if (!identity.isFile()) throw new Error(`${label} identity must be a regular file`);
    if (!knownHosts.isFile()) throw new Error(`${label} known-hosts path must be a regular file`);
    if (enforcePermissions && (identity.mode & 0o077) !== 0) {
      throw new Error(`${label} identity must not be accessible by group or other users (chmod 600)`);
    }
    return createHash("sha256").update(await readFile(identityPath)).digest("base64url");
  }

  for (const node of config.nodes) {
    if (node.transport.type !== "ssh") continue;
    const digest = await identityDigest(
      node.transport.identityFile,
      node.transport.knownHostsFile,
      `${node.id} SSH`,
    );
    if (node.enabled) {
      const existingNode = sshIdentityDigests.get(digest);
      if (existingNode) throw new Error(`${node.id} reuses the SSH private identity assigned to ${existingNode}`);
      sshIdentityDigests.set(digest, node.id);
    }
    if (node.transport.jump) {
      const jumpDigest = await identityDigest(
        node.transport.jump.identityFile,
        node.transport.jump.knownHostsFile,
        `${node.id} SSH jump`,
      );
      if (jumpDigest === digest) throw new Error(`${node.id} SSH jump reuses its target private identity`);
      if (node.enabled) jumpIdentityDigests.set(jumpDigest, node.id);
    }
  }
  for (const [digest, jumpNode] of jumpIdentityDigests) {
    const targetNode = sshIdentityDigests.get(digest);
    if (targetNode) {
      throw new Error(`${jumpNode} SSH jump reuses the target private identity assigned to ${targetNode}`);
    }
  }
  return config;
}

export function upstreamFor(node: NodeConfig): string {
  return node.transport.type === "local"
    ? node.transport.url
    : `http://127.0.0.1:${node.transport.localPort}`;
}
