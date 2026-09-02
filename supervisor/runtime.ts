import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { chmod, mkdir, readFile, stat } from "node:fs/promises";
import { homedir, hostname, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_ID = "memset0.web-remote";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JOB_ENV_KEYS = [
  "SLURM_JOB_ID",
  "PBS_JOBID",
  "LSB_JOBID",
  "JOB_ID",
] as const;

export interface RuntimePaths {
  pluginRoot: string;
  configDir: string;
  stateDir: string;
  runtimeDir: string;
  socketPath: string;
  lockDir: string;
  generation: string;
}

export interface HostGateResult {
  allowed: boolean;
  reason: string | null;
}

export interface TerminalRoleConfig {
  python: string;
  nodeConfig: string;
  ingress: null | {
    inventory: string;
    gatewayConfig: string;
    liveRoot: string;
    socketPath: string;
    socketGid: number;
  };
}

export function parseEnvFile(source: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`invalid .env line: ${rawLine}`);
    const key = match[1]!;
    let value = match[2]!.trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0]!;
      let closing = -1;
      for (let index = 1; index < value.length; index += 1) {
        if (value[index] === quote && (quote === "'" || value[index - 1] !== "\\")) {
          closing = index;
          break;
        }
      }
      if (closing < 0) throw new Error(`unterminated quoted value in .env line: ${rawLine}`);
      const trailing = value.slice(closing + 1).trim();
      if (trailing && !trailing.startsWith("#")) throw new Error(`invalid text after quoted .env value: ${rawLine}`);
      value = value.slice(1, closing);
      if (quote === '"') {
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    } else {
      const comment = value.search(/\s+#/);
      if (comment >= 0) value = value.slice(0, comment).trimEnd();
    }
    parsed[key] = value;
  }
  return parsed;
}

export async function loadPluginEnv(
  configDir: string,
  inherited: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const envPath = join(configDir, ".env");
  let fromFile: Record<string, string> = {};
  try {
    const info = await stat(envPath);
    if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
      throw new Error("plugin .env must not be accessible by group or other users (chmod 600)");
    }
    fromFile = parseEnvFile(await readFile(envPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { ...fromFile, ...inherited };
}

function productionTypeScriptFiles(root: string, relative: string): string[] {
  const absolute = join(root, relative);
  if (!existsSync(absolute)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(relative, entry.name);
    if (entry.isDirectory()) files.push(...productionTypeScriptFiles(root, child));
    else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && entry.name !== "test-helpers.ts") {
      files.push(child);
    }
  }
  return files.sort();
}

export function computeGeneration(pluginRoot: string): string {
  const hash = createHash("sha256");
  for (const relative of [
    "package.json",
    ...productionTypeScriptFiles(pluginRoot, "bridge"),
    ...productionTypeScriptFiles(pluginRoot, "gateway"),
    ...productionTypeScriptFiles(pluginRoot, "supervisor"),
    ...(existsSync(join(pluginRoot, "services", "ttyd-fallback"))
      ? readdirSync(join(pluginRoot, "services", "ttyd-fallback"), { withFileTypes: true })
        .filter((entry) => entry.isFile() && (entry.name.endsWith(".py") || ["VERSION", "SHA256SUMS"].includes(entry.name)))
        .map((entry) => join("services", "ttyd-fallback", entry.name))
        .sort()
      : []),
  ]) {
    const path = join(pluginRoot, relative);
    hash.update(relative);
    hash.update(existsSync(path) ? readFileSync(path) : "missing");
  }
  return hash.digest("hex").slice(0, 16);
}

function requiredAbsoluteEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value || !isAbsolute(value)) throw new Error(`${key} must be an absolute path`);
  return resolve(value);
}

export function resolveTerminalRoles(_paths: RuntimePaths, env: NodeJS.ProcessEnv): TerminalRoleConfig {
  const nodeConfig = requiredAbsoluteEnv(env, "HERDR_WEB_TERMINAL_NODE_CONFIG");
  const gatewayConfig = env.HERDR_WEB_GATEWAY_CONFIG?.trim();
  const inventory = env.HERDR_WEB_TERMINAL_FLEET_CONFIG?.trim();
  if (Boolean(gatewayConfig) !== Boolean(inventory)) {
    throw new Error("HERDR_WEB_GATEWAY_CONFIG and HERDR_WEB_TERMINAL_FLEET_CONFIG must be configured together");
  }
  if (gatewayConfig && (!isAbsolute(gatewayConfig) || !isAbsolute(inventory!))) {
    throw new Error("terminal Fleet and Gateway configs must use absolute paths");
  }
  const liveRoot = gatewayConfig
    ? requiredAbsoluteEnv(env, "HERDR_WEB_TERMINAL_LIVE_ROOT")
    : null;
  const ingressSocket = env.HERDR_WEB_TERMINAL_INGRESS_SOCKET?.trim();
  const ingressGid = env.HERDR_WEB_TERMINAL_INGRESS_GID?.trim();
  if (Boolean(gatewayConfig) !== Boolean(ingressSocket) || Boolean(gatewayConfig) !== Boolean(ingressGid)) {
    throw new Error("central terminal configuration requires ingress socket and GID together");
  }
  if (ingressSocket && !isAbsolute(ingressSocket)) {
    throw new Error("HERDR_WEB_TERMINAL_INGRESS_SOCKET must be an absolute path");
  }
  const socketGid = ingressGid && /^(0|[1-9][0-9]{0,9})$/.test(ingressGid)
    ? Number(ingressGid)
    : null;
  if (ingressGid && (socketGid === null || !Number.isSafeInteger(socketGid) || socketGid > 2_147_483_647)) {
    throw new Error("HERDR_WEB_TERMINAL_INGRESS_GID must be a bounded numeric GID");
  }
  return {
    python: env.HERDR_WEB_TERMINAL_PYTHON?.trim() || "python3",
    nodeConfig,
    ingress: gatewayConfig && inventory ? {
      inventory: resolve(inventory),
      gatewayConfig: resolve(gatewayConfig),
      liveRoot: liveRoot!,
      socketPath: resolve(ingressSocket!),
      socketGid: socketGid!,
    } : null,
  };
}

export function resolveRuntimePaths(
  env: NodeJS.ProcessEnv = process.env,
  uid = typeof process.getuid === "function" ? process.getuid() : 0,
): RuntimePaths {
  const pluginRoot = resolve(env.HERDR_PLUGIN_ROOT ?? MODULE_ROOT);
  const configDir = resolve(
    env.HERDR_PLUGIN_CONFIG_DIR ?? join(homedir(), ".config", "herdr", "plugins", "config", PLUGIN_ID),
  );
  const stateDir = resolve(
    env.HERDR_PLUGIN_STATE_DIR ?? join(homedir(), ".local", "state", "herdr-web-remote"),
  );
  const configuredRuntime = env.HERDR_WEB_RUNTIME_DIR?.trim();
  const runtimeBase = configuredRuntime
    ? resolve(configuredRuntime)
    : env.XDG_RUNTIME_DIR && isAbsolute(env.XDG_RUNTIME_DIR)
      ? env.XDG_RUNTIME_DIR
      : tmpdir();
  const runtimeDir = join(runtimeBase, `herdr-web-remote-${uid}`);
  return {
    pluginRoot,
    configDir,
    stateDir,
    runtimeDir,
    socketPath: join(runtimeDir, "supervisor.sock"),
    lockDir: join(runtimeDir, "launch.lock"),
    generation: env.HERDR_WEB_GENERATION?.trim() || computeGeneration(pluginRoot),
  };
}

export async function ensurePrivateDirs(paths: RuntimePaths): Promise<void> {
  await mkdir(paths.runtimeDir, { recursive: true, mode: 0o700 });
  await chmod(paths.runtimeDir, 0o700);
  await mkdir(paths.stateDir, { recursive: true, mode: 0o700 });
  await chmod(paths.stateDir, 0o700);
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

export function evaluateHostGate(
  env: NodeJS.ProcessEnv,
  currentHostname = hostname(),
): HostGateResult {
  const prefix = env.HERDR_WEB_HOST_PREFIX?.trim();
  if (prefix && !currentHostname.startsWith(prefix)) {
    return { allowed: false, reason: `host ${currentHostname} does not match designated prefix ${prefix}` };
  }
  if (boolEnv(env.HERDR_WEB_DISALLOW_JOBS, true)) {
    const activeKey = JOB_ENV_KEYS.find((key) => Boolean(env[key]?.trim()));
    if (activeKey) return { allowed: false, reason: `scheduler context ${activeKey} is active` };
  }
  return { allowed: true, reason: null };
}

export function positiveIntEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum = 1,
): number {
  const raw = env[key]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum ? value : fallback;
}

export function sanitizedDaemonEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized = { ...env };
  for (const key of [
    "HERDR_PLUGIN_ACTION_ID",
    "HERDR_PLUGIN_CLICKED_URL",
    "HERDR_PLUGIN_CONTEXT_JSON",
    "HERDR_PLUGIN_EVENT",
    "HERDR_PLUGIN_EVENT_JSON",
    "HERDR_PLUGIN_LINK_HANDLER_ID",
    "HERDR_PANE_ID",
    "HERDR_TAB_ID",
    "HERDR_WORKSPACE_ID",
  ]) {
    delete sanitized[key];
  }
  return sanitized;
}
