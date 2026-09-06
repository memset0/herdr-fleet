import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collieChildEnv } from "./collie-env.ts";
import { FLEET_TERMINAL_ENV, isFleetLeadConfig, type FleetConfig } from "./config.ts";
import { sshLinkCommand } from "./pack-reachability.ts";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface RuntimePaths {
  readonly pluginRoot: string;
  readonly configPath: string;
  readonly configDir: string;
  readonly stateDir: string;
  readonly collieStateDir: string;
  readonly runtimeDir: string;
  readonly socketPath: string;
  readonly lockDir: string;
  readonly sessionStatePath: string;
  readonly generation: string;
}

export interface ChildSpec {
  readonly name: "collie" | "gateway" | "link" | "terminal";
  readonly command: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly logPath: string;
  /** The link child's recovery ceiling; omitted children keep the supervisor's own default. */
  readonly maxBackoffMs?: number;
  /** Exit codes that mean this child finished on purpose. Only the terminal service has any. */
  readonly idleExitCodes?: readonly number[];
}

function productionFiles(root: string, relative: string): string[] {
  const path = join(root, relative);
  if (!existsSync(path)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(relative, entry.name);
    if (entry.isDirectory()) result.push(...productionFiles(root, child));
    else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && entry.name !== "test-helpers.ts") {
      result.push(child);
    }
  }
  return result.toSorted();
}

export function computeGeneration(root: string): string {
  const hash = createHash("sha256");
  for (const relative of ["FORK.toml", "herdr-plugin.toml", "package.json", ...productionFiles(root, "fleet")]) {
    hash.update(relative);
    hash.update(existsSync(join(root, relative)) ? readFileSync(join(root, relative)) : "missing");
  }
  return hash.digest("hex").slice(0, 16);
}

function absoluteEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (value === undefined || value === "" || !isAbsolute(value)) throw new Error(`${key} must be an absolute path`);
  return resolve(value);
}

export function resolveRuntimePaths(env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const pluginRoot = env.HERDR_PLUGIN_ROOT?.trim() ? absoluteEnv(env, "HERDR_PLUGIN_ROOT") : MODULE_ROOT;
  const configPath = absoluteEnv(env, "HERDR_FLEET_CONFIG");
  const configDir = dirname(configPath);
  const stateDir = absoluteEnv(env, "HERDR_PLUGIN_STATE_DIR");
  const runtimeBase = env.XDG_RUNTIME_DIR?.trim();
  const base = runtimeBase !== undefined && runtimeBase !== "" && isAbsolute(runtimeBase) ? resolve(runtimeBase) : tmpdir();
  const uid = process.getuid?.() ?? 0;
  const runtimeDir = join(base, `herdr-fleet-${uid}`);
  const generation = env.HERDR_FLEET_GENERATION?.trim() || computeGeneration(pluginRoot);
  return {
    pluginRoot,
    configPath,
    configDir,
    stateDir,
    collieStateDir: join(stateDir, "collie"),
    runtimeDir,
    socketPath: join(runtimeDir, "supervisor.sock"),
    lockDir: join(runtimeDir, "launch.lock"),
    sessionStatePath: join(stateDir, "sessions.json"),
    generation,
  };
}

export async function ensurePrivateRuntime(paths: RuntimePaths): Promise<void> {
  for (const path of [paths.runtimeDir, paths.stateDir, paths.collieStateDir]) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await chmod(path, 0o700);
  }
}

export function sanitizedDaemonEnv(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...inherited };
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
    delete env[key];
  }
  return env;
}

export function childSpecs(config: FleetConfig, paths: RuntimePaths, inherited: NodeJS.ProcessEnv): ChildSpec[] {
  const shared = {
    ...inherited,
    HERDR_FLEET_CONFIG: paths.configPath,
    HERDR_FLEET_GENERATION: paths.generation,
    HERDR_PLUGIN_CONFIG_DIR: paths.configDir,
    HERDR_PLUGIN_ROOT: paths.pluginRoot,
    HERDR_PLUGIN_STATE_DIR: paths.stateDir,
  };
  const collieEnv = collieChildEnv(config, {
    ...shared,
    HERDR_PLUGIN_STATE_DIR: paths.collieStateDir,
  });
  const children: ChildSpec[] = [
    {
      name: "collie",
      command: [join(paths.pluginRoot, "bin", "collie"), "_exec-bridge"],
      cwd: paths.pluginRoot,
      env: collieEnv,
      logPath: join(paths.stateDir, "collie.log"),
    },
  ];
  if (isFleetLeadConfig(config)) {
    children.push({
      name: "gateway",
      command: [process.execPath, "run", join(paths.pluginRoot, "fleet", "gateway-main.ts")],
      cwd: paths.pluginRoot,
      env: { ...shared, HERDR_FLEET_SESSION_STATE: paths.sessionStatePath },
      logPath: join(paths.stateDir, "gateway.log"),
    });
  } else {
    // The link runs the platform SSH client, so it receives the ambient environment and none of
    // Fleet's own: no configuration path, no session state, no Collie state directory.
    const linkEnv = { ...inherited };
    for (const key of ["HERDR_FLEET_CONFIG", "HERDR_FLEET_SESSION_STATE", "HERDR_PLUGIN_STATE_DIR"]) {
      delete linkEnv[key];
    }
    children.push({
      name: "link",
      command: sshLinkCommand(config),
      cwd: paths.pluginRoot,
      env: linkEnv,
      logPath: join(paths.stateDir, "link.log"),
      maxBackoffMs: config.transport.retryMaxSeconds * 1_000,
    });
    if (config.terminal !== undefined) {
      // The terminal service gets the terminal table and nothing else of Fleet's: not the
      // configuration path, not the session state, not the Collie state directory. What it needs
      // beyond that table is the multiplexer socket, which is ambient on this machine anyway.
      const terminalEnv: NodeJS.ProcessEnv = { ...inherited };
      for (const key of ["HERDR_FLEET_CONFIG", "HERDR_FLEET_SESSION_STATE", "HERDR_PLUGIN_CONFIG_DIR", "HERDR_PLUGIN_STATE_DIR"]) {
        delete terminalEnv[key];
      }
      terminalEnv[FLEET_TERMINAL_ENV] = JSON.stringify(config.terminal);
      children.push({
        name: "terminal",
        command: [process.execPath, "run", join(paths.pluginRoot, "fleet", "terminal", "peer-main.ts")],
        cwd: paths.pluginRoot,
        env: terminalEnv,
        logPath: join(paths.stateDir, "terminal.log"),
        // Standing itself down is this child's ordinary outcome, not a failure.
        idleExitCodes: [0],
      });
    }
  }
  return children;
}
