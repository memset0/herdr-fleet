import { spawnSync } from "node:child_process";

import { PLUGIN_ID } from "./runtime.ts";

interface PluginListEnvelope {
  result?: {
    plugins?: Array<{ plugin_id?: string; enabled?: boolean }>;
  };
}

export function herdrServerActive(
  env: NodeJS.ProcessEnv,
  run: typeof spawnSync = spawnSync,
): boolean {
  const binary = env.HERDR_BIN_PATH?.trim() || "herdr";
  const result = run(binary, ["status", "server"], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
  return !result.error && result.status === 0 && /^status:\s+running$/m.test(result.stdout ?? "");
}

export function pluginEnabled(
  env: NodeJS.ProcessEnv,
  run: typeof spawnSync = spawnSync,
): boolean {
  const binary = env.HERDR_BIN_PATH?.trim() || "herdr";
  const result = run(binary, ["plugin", "list", "--json"], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
  if (result.error || result.status !== 0) return false;
  try {
    const parsed = JSON.parse(result.stdout ?? "") as PluginListEnvelope;
    return Boolean(parsed.result?.plugins?.some((plugin) => plugin.plugin_id === PLUGIN_ID && plugin.enabled));
  } catch {
    return false;
  }
}

export function runtimeHealthy(env: NodeJS.ProcessEnv): boolean {
  return herdrServerActive(env) && pluginEnabled(env);
}
