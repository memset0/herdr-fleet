import { isAbsolute } from "node:path";

import { FLEET_TERMINAL_ENV, parseFleetTerminalEnvelope } from "../config.ts";
import { localSnapshotSource, resolveTerminal } from "./resolve.ts";
import { makeSocketDirectory, makeStartServer, type TerminalTools } from "./spawn.ts";
import { PeerTerminalService } from "./peer/service.ts";
import { startPeerTerminalServer } from "./peer/server.ts";
import { verifyExecutableDigest } from "./peer/verify.ts";

/**
 * The member's terminal service, as a process.
 *
 * It is started by the plugin's own supervisor beside Collie and the link, and only when the
 * member's validated configuration declares a terminal endpoint. It receives that configuration's
 * path and nothing else of the Fleet runtime: no session state, no browser material, no Pack
 * identity — see the runtime delta for why that list is the contract rather than a habit.
 *
 * Standing down is an ordinary exit with status 0. The supervisor reads that as idle rather than
 * failed, and the next request brings this process back with nothing carried over.
 */
async function main(): Promise<void> {
  const envelope = process.env[FLEET_TERMINAL_ENV]?.trim() ?? "";
  if (envelope === "") throw new Error(`${FLEET_TERMINAL_ENV} is required`);
  const terminal = parseFleetTerminalEnvelope(envelope);

  // The attach command comes from the runtime this plugin is launched by, not from configuration:
  // it is the multiplexer's own binary, and a configuration that named a different one would be
  // naming what this service attaches to.
  const attach = Bun.which("herdr");
  if (attach === null || !isAbsolute(attach)) throw new Error("the multiplexer command is not installed");
  const tools: TerminalTools = { server: terminal.serverPath, attach };

  const sockets = await makeSocketDirectory();
  const snapshots = localSnapshotSource();
  const service = new PeerTerminalService({
    config: terminal,
    resolve: (paneId) => resolveTerminal({ paneId }, snapshots),
    verifyExecutable: () => verifyExecutableDigest(terminal.serverPath, terminal.serverDigest),
    startServer: makeStartServer({ tools, socketDir: sockets.path }),
    standDown: () => void stop(0),
    log: (event, detail) => {
      console.log(`herdr-fleet ${event} ${JSON.stringify(detail)}`);
    },
  });
  const listener = startPeerTerminalServer({ service, config: terminal });
  console.log(`herdr-fleet terminal service listening on ${terminal.bind.host}:${terminal.bind.port}`);

  let stopping = false;
  const stop = async (code: number): Promise<void> => {
    if (stopping) return;
    stopping = true;
    service.stop();
    await listener.stop(true);
    await sockets.remove();
    process.exitCode = code;
  };
  process.once("SIGINT", () => void stop(0));
  process.once("SIGTERM", () => void stop(0));
}

main().catch((error) => {
  console.error(
    `herdr-fleet terminal service: ${error instanceof Error ? error.message : "startup failed"}`,
  );
  process.exitCode = 1;
});
