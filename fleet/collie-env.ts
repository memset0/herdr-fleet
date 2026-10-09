import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { resolveConfigDir } from "../bridge/config.ts";
import {
  CONFIG_SECTIONS,
  settingByEnv,
  settingByKey,
  type ConfigSetting,
} from "../bridge/config-schema.ts";
import {
  configFilePaths,
  readConfigFilesSync,
  type ConfigFileReader,
  type ConfigLayerName,
} from "../bridge/config-source.ts";
import { isFleetLeadConfig, type FleetConfig } from "./config.ts";

/**
 * Every Collie setting Fleet owns: reset in the child's environment, and set below where Fleet
 * decides it. A name left unset here on purpose keeps Collie's default — which is exactly the gap a
 * Collie `config.toml` could otherwise fill, so {@link assertCollieConfigFilesCede} refuses a file
 * that names any of these.
 */
export const FLEET_OWNED_COLLIE_SETTINGS = [
  // Collie's Cloudflare Access gate (ADR 0081). The Gateway is the authentication front door, and it
  // forwards with `x-forwarded-host` and no Access token, so a gate turned on beneath it would refuse
  // every request it proxies. Neither name is ever set; both are reset and refused in a config file.
  "COLLIE_ACCESS_AUD",
  "COLLIE_ACCESS_TEAM",
  "COLLIE_ALLOWED_ORIGINS",
  "COLLIE_ALLOW_ANY_HOST",
  "COLLIE_ALLOW_NON_LOOPBACK_BIND",
  "COLLIE_BASE_PATH",
  "COLLIE_DEVICE_ALLOWLIST",
  "COLLIE_DEVICE_HEADER",
  "COLLIE_CREW_TIMEOUT_MS",
  "COLLIE_HOST",
  "COLLIE_POLL_MS",
  "COLLIE_PORT",
  "COLLIE_PUBLIC_HOSTS",
  "COLLIE_PUBLIC_URL",
  "COLLIE_SERVE_MODE",
  "COLLIE_SERVE_PORT",
  "COLLIE_SKIP_SERVE",
  "COLLIE_STATE_DIR",
  "COLLIE_TAILSCALE_HOSTS",
  "COLLIE_TRUSTED_USER",
  "COLLIE_TRUSTED_USER_OPTIONAL",
] as const;

/** Fleet's own variables, which never reach the Collie child. */
const FLEET_PRIVATE_KEYS = ["HERDR_FLEET_CONFIG", "HERDR_FLEET_SESSION_STATE"] as const;

export function collieChildEnv(
  config: FleetConfig,
  collieStateDir: string,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...inherited };
  for (const key of [...FLEET_OWNED_COLLIE_SETTINGS, ...FLEET_PRIVATE_KEYS]) delete env[key];
  // The adopted Collie resolves its state directory from this one name. It is the directory Fleet
  // validates the trust state in and the one an explicit enrolment writes, so both read one store.
  env.COLLIE_STATE_DIR = collieStateDir;
  env.COLLIE_HOST = config.collie.host;
  env.COLLIE_PORT = String(config.collie.port);
  env.COLLIE_SKIP_SERVE = "1";
  if (isFleetLeadConfig(config)) {
    env.COLLIE_PUBLIC_HOSTS = config.public.host;
    env.COLLIE_ALLOWED_ORIGINS = config.public.origin;
    env.COLLIE_PUBLIC_URL = config.public.origin;
    // The lead's own pack timing, when it states any. Both names are reset above, so a stray value
    // in the inherited environment cannot decide how long a member has to answer — the configuration
    // does, or nothing does and Collie keeps its own defaults.
    const pack = config.pack;
    if (pack?.pollMs !== undefined) env.COLLIE_POLL_MS = String(pack.pollMs);
    if (pack?.timeoutMs !== undefined) env.COLLIE_CREW_TIMEOUT_MS = String(pack.timeoutMs);
  }
  return env;
}

/** The refusal names the file and the key, never the value. */
function refuse(file: string, setting: ConfigSetting): never {
  throw new Error(`${file} sets [${setting.section}] ${setting.key}, which Herdr Fleet owns; remove it from that file`);
}

const diskReader: ConfigFileReader = {
  read(path) {
    try {
      return { text: readFileSync(path, "utf8"), error: null };
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") return { text: null, error: null };
      return { text: null, error: String(err) };
    }
  },
};

/**
 * Refuse to start when one of Collie's own `config.toml` files sets a setting Fleet owns.
 *
 * Both paths come from upstream's own resolver, given the child's environment, so they are the two
 * files that Collie child will read; the files are parsed by upstream's own reader, so a key means
 * here what it means there. A refusal names the file and the key and never the value. Fleet never
 * writes either file.
 */
export function assertCollieConfigFilesCede(
  childEnv: NodeJS.ProcessEnv,
  reader: ConfigFileReader = diskReader,
): void {
  const home = childEnv.HOME?.trim() || homedir();
  const paths = configFilePaths(childEnv, home, resolveConfigDir(childEnv, home));
  const layer = readConfigFilesSync(reader, paths, () => {}, { home });
  const owned = new Set<string>(FLEET_OWNED_COLLIE_SETTINGS);
  const fileOf = (layerName: ConfigLayerName) => paths.find((path) => path.layer === layerName)?.path ?? layerName;
  for (const [name, source] of layer.sources) {
    const setting = settingByEnv(name);
    if (!owned.has(name) || setting === undefined) continue;
    // A file both paths reach is attributed to the instance layer, as Collie attributes it.
    refuse(fileOf(source === "file:home" ? "home" : "instance"), setting);
  }
  // A value Collie would reject still names the key; the operator meant to set it, so it is refused
  // the same way rather than left to a warning in Collie's log.
  for (const problem of layer.problems) {
    const section = CONFIG_SECTIONS.find((candidate) => candidate === problem.section);
    if (problem.key === null || section === undefined) continue;
    const setting = settingByKey(section, problem.key);
    if (setting !== undefined && owned.has(setting.env)) refuse(problem.file, setting);
  }
}
