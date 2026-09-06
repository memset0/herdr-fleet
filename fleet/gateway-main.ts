import { dirname, isAbsolute } from "node:path";

import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath } from "./config.ts";
import { startGateway } from "./server.ts";
import { SessionStore } from "./session-store.ts";
import { createSettingsStore, settingsPathFor } from "./settings/store.ts";
import { localSnapshotSource, resolveTerminal } from "./terminal/resolve.ts";
import { createTerminalService } from "./terminal/service.ts";

async function main(): Promise<void> {
  const configPath = resolveFleetConfigPath();
  const config = await loadFleetConfig(configPath);
  if (!isFleetLeadConfig(config)) throw new Error("Fleet Gateway is unavailable for role peer");
  const statePath = process.env.HERDR_FLEET_SESSION_STATE?.trim() ?? "";
  if (!isAbsolute(statePath)) throw new Error("HERDR_FLEET_SESSION_STATE must be an absolute path");
  const sessions = new SessionStore(statePath);
  // The snapshot source is resolved once: a Pane is resolved against the multiplexer this machine
  // owns, and asking is what proves the Pane is still there.
  const snapshots = localSnapshotSource();
  const terminal = await createTerminalService({
    resolve: (target) => resolveTerminal(target, snapshots),
    isActive: (session) => sessions.active({ version: 1, ...session }),
    log: (event, detail) => {
      // Lifecycle only, and it is the shape of this call that keeps it so: a fixed event name and a
      // record of identity and counts, never a frame, a byte of output, or a session id.
      console.log(`herdr-fleet ${event} ${JSON.stringify(detail)}`);
    },
  });
  const server = startGateway({
    config,
    sessions,
    // Beside the private configuration, not in the state directory: bindings are the operator's own
    // choice, and a wiped state directory must not quietly return them to stock defaults.
    settings: createSettingsStore(settingsPathFor(dirname(configPath))),
    terminal: terminal ?? undefined,
    onSessionRevoked: terminal === null ? undefined : (sessionId) => terminal.revoked(sessionId),
  });
  console.log(
    `herdr-fleet gateway listening on ${server.url.origin}` +
      (terminal === null ? " (no terminal server installed)" : ""),
  );
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      // Terminals first: stopping the listener would drop their browsers without the servers those
      // connections started ever being told, and each of those is an attachment to a real Pane.
      await terminal?.stop();
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
