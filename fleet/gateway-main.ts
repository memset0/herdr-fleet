import { isAbsolute } from "node:path";

import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath } from "./config.ts";
import { startGateway } from "./server.ts";
import { SessionStore } from "./session-store.ts";

async function main(): Promise<void> {
  const config = await loadFleetConfig(resolveFleetConfigPath());
  if (!isFleetLeadConfig(config)) throw new Error("Fleet Gateway is unavailable for role peer");
  const statePath = process.env.HERDR_FLEET_SESSION_STATE?.trim() ?? "";
  if (!isAbsolute(statePath)) throw new Error("HERDR_FLEET_SESSION_STATE must be an absolute path");
  const server = startGateway({ config, sessions: new SessionStore(statePath) });
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
