import { dirname, isAbsolute } from "node:path";

import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath } from "./config.ts";
import { startGateway } from "./server.ts";
import { SessionStore } from "./session-store.ts";
import { createSettingsStore, settingsPathFor } from "./settings/store.ts";

async function main(): Promise<void> {
  const configPath = resolveFleetConfigPath();
  const config = await loadFleetConfig(configPath);
  if (!isFleetLeadConfig(config)) throw new Error("Fleet Gateway is unavailable for role peer");
  const statePath = process.env.HERDR_FLEET_SESSION_STATE?.trim() ?? "";
  if (!isAbsolute(statePath)) throw new Error("HERDR_FLEET_SESSION_STATE must be an absolute path");
  const server = startGateway({
    config,
    sessions: new SessionStore(statePath),
    // Beside the private configuration, not in the state directory: bindings are the operator's own
    // choice, and a wiped state directory must not quietly return them to stock defaults.
    settings: createSettingsStore(settingsPathFor(dirname(configPath))),
  });
  console.log(`herdr-fleet gateway listening on ${server.url.origin}`);
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await server.stop(true);
      resolve();
    };
    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
  });
}

main().catch((error) => {
  console.error(`herdr-fleet gateway: ${error instanceof Error ? error.message : "startup failed"}`);
  process.exitCode = 1;
});
