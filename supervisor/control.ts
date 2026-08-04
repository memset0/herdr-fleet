#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  isUnavailableControlError,
  sendControl,
  type ControlOperation,
  type ControlResponse,
} from "./protocol.ts";
import {
  ensurePrivateDirs,
  evaluateHostGate,
  loadPluginEnv,
  positiveIntEnv,
  resolveRuntimePaths,
  sanitizedDaemonEnv,
} from "./runtime.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatStatus(result: ControlResponse): string {
  const children = result.children
    .map((child) => `${child.name}=${child.running ? `running(pid=${child.pid})` : "stopped"}`)
    .join(" ");
  return `web-remote: supervisor ${result.status} generation=${result.generation} pid=${result.pid}${children ? ` ${children}` : ""}`;
}

async function query(
  socketPath: string,
  operation: ControlOperation,
  generation: string,
): Promise<ControlResponse | null> {
  try {
    return await sendControl(socketPath, { operation, generation });
  } catch (error) {
    if (isUnavailableControlError(error)) return null;
    throw error;
  }
}

async function waitForReady(socketPath: string, generation: string, timeoutMs = 8_000): Promise<ControlResponse> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await sendControl(socketPath, { operation: "status", generation }, 500);
      if (result.status === "running" && result.generation === generation) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(`supervisor did not become ready: ${lastError instanceof Error ? lastError.message : "timeout"}`);
}

async function waitForSocketRelease(socketPath: string, generation: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const current = await query(socketPath, "status", generation);
    if (!current) return;
    await sleep(50);
  }
  throw new Error("older supervisor did not release its control socket");
}

async function acquireLaunchLock(
  lockDir: string,
  socketPath: string,
  generation: string,
  timeoutMs: number,
): Promise<{ acquired: true } | { acquired: false; result: ControlResponse }> {
  try {
    await mkdir(lockDir, { mode: 0o700 });
    return { acquired: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  try {
    return { acquired: false, result: await waitForReady(socketPath, generation, timeoutMs) };
  } catch (waitError) {
    let ageMs = Number.POSITIVE_INFINITY;
    try {
      ageMs = Date.now() - (await stat(lockDir)).mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (ageMs < Math.max(250, timeoutMs - 500)) throw waitError;
    await rm(lockDir, { recursive: true, force: true });
    try {
      await mkdir(lockDir, { mode: 0o700 });
      return { acquired: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return { acquired: false, result: await waitForReady(socketPath, generation, timeoutMs) };
    }
  }
}

async function ensureSupervisor(): Promise<ControlResponse | null> {
  const paths = resolveRuntimePaths();
  await ensurePrivateDirs(paths);
  const env = await loadPluginEnv(paths.configDir, process.env);
  const gate = evaluateHostGate(env);
  if (!gate.allowed) {
    process.stdout.write(`web-remote: skipped (${gate.reason})\n`);
    return null;
  }

  const current = await query(paths.socketPath, "ensure", paths.generation);
  if (current?.status === "running" && current.generation === paths.generation) return current;
  if (current?.status === "replacing") await waitForSocketRelease(paths.socketPath, paths.generation);

  const launchTimeout = positiveIntEnv(env, "HERDR_WEB_START_TIMEOUT_MS", 8_000, 500);
  const lock = await acquireLaunchLock(paths.lockDir, paths.socketPath, paths.generation, launchTimeout);
  if (!lock.acquired) return lock.result;

  try {
    const afterLock = await query(paths.socketPath, "ensure", paths.generation);
    if (afterLock?.status === "running" && afterLock.generation === paths.generation) return afterLock;
    await rm(paths.socketPath, { force: true });
    const child = spawn(process.execPath, ["run", join(paths.pluginRoot, "supervisor", "daemon.ts")], {
      cwd: paths.pluginRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...sanitizedDaemonEnv(env),
        HERDR_PLUGIN_CONFIG_DIR: paths.configDir,
        HERDR_PLUGIN_ROOT: paths.pluginRoot,
        HERDR_PLUGIN_STATE_DIR: paths.stateDir,
        HERDR_WEB_GENERATION: paths.generation,
      },
    });
    child.unref();
    return await waitForReady(paths.socketPath, paths.generation, launchTimeout);
  } finally {
    await rm(paths.lockDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const operation = (process.argv[2] ?? "status") as ControlOperation;
  if (!["ensure", "status", "restart", "stop"].includes(operation)) {
    throw new Error("usage: control.ts <ensure|status|restart|stop>");
  }
  if (operation === "ensure") {
    const result = await ensureSupervisor();
    if (result) process.stdout.write(`${formatStatus(result)}\n`);
    return;
  }
  const paths = resolveRuntimePaths();
  await ensurePrivateDirs(paths);
  const env = await loadPluginEnv(paths.configDir, process.env);
  const gate = evaluateHostGate(env);
  if (!gate.allowed) {
    process.stdout.write(`web-remote: skipped (${gate.reason})\n`);
    return;
  }
  const result = await query(paths.socketPath, operation, paths.generation);
  if (!result) {
    process.stdout.write("web-remote: supervisor not running\n");
    return;
  }
  process.stdout.write(`${formatStatus(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`web-remote: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
