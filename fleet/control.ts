import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { loadFleetConfig, resolveFleetConfigPath } from "./config.ts";
import { isUnavailableControlError, sendControl, type ControlOperation, type ControlResponse } from "./protocol.ts";
import { ensurePrivateRuntime, resolveRuntimePaths, sanitizedDaemonEnv } from "./runtime.ts";

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function formatStatus(result: ControlResponse): string {
  const children = result.children
    .map((child) => `${child.name}=${child.running ? `running(pid=${child.pid})` : "stopped"}`)
    .join(" ");
  return `herdr-fleet: supervisor ${result.status} generation=${result.generation} pid=${result.pid}${children === "" ? "" : ` ${children}`}`;
}

async function query(socketPath: string, operation: ControlOperation, generation: string) {
  try {
    return await sendControl(socketPath, { operation, generation });
  } catch (error) {
    if (error instanceof Error && isUnavailableControlError(error)) return null;
    throw error;
  }
}

async function waitForReady(socketPath: string, generation: string, timeoutMs = 12_000): Promise<ControlResponse> {
  const deadline = Date.now() + timeoutMs;
  let last = "not reachable";
  while (Date.now() < deadline) {
    try {
      const result = await sendControl(socketPath, { operation: "status", generation }, 500);
      last = result.status;
      if (result.status === "running" && result.generation === generation) return result;
    } catch (error) {
      last = error instanceof Error ? error.message : "unavailable";
    }
    await sleep(50);
  }
  throw new Error(`supervisor did not become ready: ${last}`);
}

async function waitForRelease(socketPath: string, generation: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if ((await query(socketPath, "status", generation)) === null) return;
    await sleep(50);
  }
  throw new Error("older supervisor did not release its control socket");
}

async function launchLock(lockDir: string, socketPath: string, generation: string): Promise<boolean> {
  try {
    await mkdir(lockDir, { mode: 0o700 });
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
  }
  try {
    await waitForReady(socketPath, generation, 12_000);
    return false;
  } catch {
    let old = false;
    try {
      old = Date.now() - (await stat(lockDir)).mtimeMs > 15_000;
    } catch {
      old = true;
    }
    if (!old) throw new Error("another Fleet start is still in progress");
    await rm(lockDir, { recursive: true, force: true });
    await mkdir(lockDir, { mode: 0o700 });
    return true;
  }
}

async function ensureSupervisor(): Promise<ControlResponse> {
  const paths = resolveRuntimePaths();
  await ensurePrivateRuntime(paths);
  await loadFleetConfig(paths.configPath);
  const current = await query(paths.socketPath, "ensure", paths.generation);
  if (current?.status === "running" && current.generation === paths.generation) return current;
  if (current?.status === "replacing") await waitForRelease(paths.socketPath, paths.generation);
  if (!(await launchLock(paths.lockDir, paths.socketPath, paths.generation))) {
    return await waitForReady(paths.socketPath, paths.generation);
  }
  try {
    const afterLock = await query(paths.socketPath, "ensure", paths.generation);
    if (afterLock?.status === "running" && afterLock.generation === paths.generation) return afterLock;
    if (
      afterLock?.generation === paths.generation &&
      (afterLock.status === "starting" || afterLock.status === "restarting")
    ) {
      return await waitForReady(paths.socketPath, paths.generation);
    }
    await rm(paths.socketPath, { force: true });
    const child = spawn(process.execPath, ["run", join(paths.pluginRoot, "fleet", "daemon.ts")], {
      cwd: paths.pluginRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...sanitizedDaemonEnv(process.env),
        HERDR_FLEET_CONFIG: paths.configPath,
        HERDR_FLEET_GENERATION: paths.generation,
        HERDR_PLUGIN_ROOT: paths.pluginRoot,
        HERDR_PLUGIN_STATE_DIR: paths.stateDir,
      },
    });
    child.unref();
    return await waitForReady(paths.socketPath, paths.generation);
  } finally {
    await rm(paths.lockDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "status";
  if (command === "url") {
    const config = await loadFleetConfig(resolveFleetConfigPath());
    console.log(config.public.origin);
    return;
  }
  const operation: ControlOperation | null =
    command === "start" || command === "ensure"
      ? "ensure"
      : command === "status" || command === "restart" || command === "stop"
        ? command
        : null;
  if (operation === null) throw new Error("usage: herdr-fleet <start|ensure|status|restart|stop|url>");
  if (operation === "ensure") {
    console.log(formatStatus(await ensureSupervisor()));
    return;
  }
  if (operation === "restart") {
    await ensureSupervisor();
  }
  const paths = resolveRuntimePaths();
  await ensurePrivateRuntime(paths);
  const result = await query(paths.socketPath, operation, paths.generation);
  if (result === null) {
    console.log("herdr-fleet: supervisor not running");
    return;
  }
  console.log(formatStatus(result));
  if (operation === "restart") console.log(formatStatus(await waitForReady(paths.socketPath, paths.generation)));
}

main().catch((error) => {
  console.error(`herdr-fleet: ${error instanceof Error ? error.message : "operation failed"}`);
  process.exitCode = 1;
});
