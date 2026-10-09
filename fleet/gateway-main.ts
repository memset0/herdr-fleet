import { createTodoistService } from "./todoist/service.ts";
import { createTodoistStore } from "./todoist/store.ts";
import { dirname, isAbsolute, join } from "node:path";

import { GATEWAY_TOKEN_ENV } from "./collie-pairing.ts";
import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath } from "./config.ts";
import { resolveHerdrCommand } from "./herdr-command.ts";
import { startGateway } from "./server.ts";
import { createTagStore } from "./pane-tags/store.ts";
import { SessionStore } from "./session-store.ts";
import { createSettingsStore, settingsPathFor } from "./settings/store.ts";
import { ManualPaneFitControllerManager } from "./manual-pane-fit/controller.ts";
import { createLocalPaneFit } from "./manual-pane-fit/local.ts";
import { leadResolver, localSnapshotSource, localSocketPath } from "./terminal/resolve.ts";
import { createTerminalService } from "./terminal/service.ts";

/**
 * Lifecycle only, and it is the shape of this call that keeps it so: a fixed event name and a record
 * of identity and counts, never a frame, a byte of output, or a session id.
 */
function log(event: string, detail: Record<string, string | number>): void {
  console.log(`herdr-fleet ${event} ${JSON.stringify(detail)}`);
}

async function main(): Promise<void> {
  const configPath = resolveFleetConfigPath();
  const config = await loadFleetConfig(configPath);
  if (!isFleetLeadConfig(config)) throw new Error("Fleet Gateway is unavailable for role peer");
  const statePath = process.env.HERDR_FLEET_SESSION_STATE?.trim() ?? "";
  if (!isAbsolute(statePath)) throw new Error("HERDR_FLEET_SESSION_STATE must be an absolute path");
  const sessions = new SessionStore(statePath);
  // The pairing credential the supervisor enrolled for this Gateway (fleet/collie-pairing.ts), read
  // once and removed from this process's environment so no terminal attach or other child inherits
  // it. Without it every proxied request would be refused by Collie, so the Gateway does not start.
  const collieToken = process.env[GATEWAY_TOKEN_ENV]?.trim() ?? "";
  delete process.env[GATEWAY_TOKEN_ENV];
  if (collieToken === "") throw new Error(`${GATEWAY_TOKEN_ENV} is missing; the supervisor enrols the Gateway`);
  // The snapshot source is resolved once: a Pane is resolved against the multiplexer this machine
  // owns, and asking is what proves the Pane is still there.
  const socketPath = localSocketPath();
  const snapshots = localSnapshotSource(socketPath);
  // A member's terminal endpoint comes from the same validated reachability list the Pack link is
  // projected from — a schema-1 lead has none, and therefore serves only its own Panes.
  const members = config.schemaVersion === 2 ? config.reachability : [];
  // One multiplexer command for both the terminal attach and the manual Pane fit, resolved the way
  // every Fleet child resolves it. Without one the lead serves neither for its own Panes; members are
  // still asked through their own terminal services.
  const herdrCommand = resolveHerdrCommand();
  if (!herdrCommand.ok) log("herdr.unavailable", { diagnostic: herdrCommand.diagnostic });
  const herdr = herdrCommand.ok ? herdrCommand.path : null;
  const terminal = await createTerminalService({
    attach: herdr,
    resolve: leadResolver(snapshots, () => members),
    isActive: (session) => sessions.active({ version: 1, ...session }),
    log,
  });
  const paneFit =
    herdr === null
      ? null
      : createLocalPaneFit({
          source: snapshots,
          socketPath,
          controller: new ManualPaneFitControllerManager({ binary: herdr }),
        });
  const server = startGateway({
    config,
    sessions,
    collieToken,
    // Beside the private configuration, not in the state directory: bindings are the operator's own
    // choice, and a wiped state directory must not quietly return them to stock defaults.
    todoist: createTodoistService({ store: createTodoistStore(join(dirname(configPath), "todoist.json")), origin: config.public.origin }),
    tags: createTagStore(join(dirname(configPath), "pane-tags.json")),
    settings: createSettingsStore(settingsPathFor(dirname(configPath))),
    terminal: terminal ?? undefined,
    paneFit: { local: paneFit, members: () => members, log },
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
      // Retained fit controllers hold geometry somebody chose; they end with the Gateway.
      paneFit?.dispose();
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
