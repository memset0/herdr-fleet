import type { FleetConfig } from "./config.ts";

const RESET_KEYS = [
  "COLLIE_ALLOWED_ORIGINS",
  "COLLIE_ALLOW_ANY_HOST",
  "COLLIE_ALLOW_NON_LOOPBACK_BIND",
  "COLLIE_DEVICE_ALLOWLIST",
  "COLLIE_DEVICE_HEADER",
  "COLLIE_HOST",
  "COLLIE_PORT",
  "COLLIE_PUBLIC_HOSTS",
  "COLLIE_PUBLIC_URL",
  "COLLIE_SERVE_MODE",
  "COLLIE_SERVE_PORT",
  "COLLIE_SKIP_SERVE",
  "COLLIE_TAILSCALE_HOSTS",
  "COLLIE_TRUSTED_USER",
  "COLLIE_TRUSTED_USER_OPTIONAL",
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
  env.COLLIE_PUBLIC_HOSTS = config.public.host;
  env.COLLIE_ALLOWED_ORIGINS = config.public.origin;
  env.COLLIE_PUBLIC_URL = config.public.origin;
  return env;
}
