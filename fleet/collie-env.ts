import { isFleetLeadConfig, type FleetConfig } from "./config.ts";

const RESET_KEYS = [
  "COLLIE_ALLOWED_ORIGINS",
  "COLLIE_ALLOW_ANY_HOST",
  "COLLIE_ALLOW_NON_LOOPBACK_BIND",
  "COLLIE_DEVICE_ALLOWLIST",
  "COLLIE_DEVICE_HEADER",
  "COLLIE_HOST",
  "COLLIE_PACK_TIMEOUT_MS",
  "COLLIE_POLL_MS",
  "COLLIE_PORT",
  "COLLIE_PUBLIC_HOSTS",
  "COLLIE_PUBLIC_URL",
  "COLLIE_SERVE_MODE",
  "COLLIE_SERVE_PORT",
  "COLLIE_SKIP_SERVE",
  "COLLIE_TAILSCALE_HOSTS",
  "COLLIE_TRUSTED_USER",
  "COLLIE_TRUSTED_USER_OPTIONAL",
  "HERDR_FLEET_CONFIG",
  "HERDR_FLEET_SESSION_STATE",
] as const;

export function collieChildEnv(
  config: FleetConfig,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...inherited };
  for (const key of RESET_KEYS) delete env[key];
  env.COLLIE_HOST = config.collie.host;
  env.COLLIE_PORT = String(config.collie.port);
  env.COLLIE_SKIP_SERVE = "1";
  if (isFleetLeadConfig(config)) {
    env.COLLIE_PUBLIC_HOSTS = config.public.host;
    env.COLLIE_ALLOWED_ORIGINS = config.public.origin;
    env.COLLIE_PUBLIC_URL = config.public.origin;
    // The lead's own pack timing, when it states any. Both keys are reset above, so a stray value in
    // the inherited environment cannot decide how long a member has to answer — the configuration
    // does, or nothing does and Collie keeps its own defaults.
    const pack = config.pack;
    if (pack?.pollMs !== undefined) env.COLLIE_POLL_MS = String(pack.pollMs);
    if (pack?.timeoutMs !== undefined) env.COLLIE_PACK_TIMEOUT_MS = String(pack.timeoutMs);
  }
  return env;
}
