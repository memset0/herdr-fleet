#!/usr/bin/env bun

import { appendFile, chmod, mkdir, rm, stat, truncate } from "node:fs/promises";
import net from "node:net";
import { join } from "node:path";

import { ManagedChild } from "./child.ts";
import { runtimeHealthy } from "./health.ts";
import type { ControlRequest, ControlResponse } from "./protocol.ts";
import {
  ensurePrivateDirs,
  evaluateHostGate,
  loadPluginEnv,
  positiveIntEnv,
  resolveRuntimePaths,
  sanitizedDaemonEnv,
} from "./runtime.ts";

const LOG_LIMIT_BYTES = 256 * 1024;

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

async function appendLifecycleLog(path: string, message: string): Promise<void> {
  try {
    if ((await stat(path)).size >= LOG_LIMIT_BYTES) await truncate(path, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await appendFile(path, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8", mode: 0o600 });
}

function response(
  status: ControlResponse["status"],
  generation: string,
  startedAt: number,
  children: ManagedChild[],
  message?: string,
): ControlResponse {
  return {
    status,
    generation,
    pid: process.pid,
    startedAt,
    children: children.map((child) => child.status()),
    ...(message ? { message } : {}),
  };
}

async function main(): Promise<void> {
  const paths = resolveRuntimePaths();
  await ensurePrivateDirs(paths);
  const loadedEnv = await loadPluginEnv(paths.configDir, sanitizedDaemonEnv(process.env));
  const gate = evaluateHostGate(loadedEnv);
  if (!gate.allowed) throw new Error(`supervisor host gate refused: ${gate.reason}`);

  const collieHost = loadedEnv.COLLIE_HOST?.trim() || "127.0.0.1";
  if (!isLoopback(collieHost)) throw new Error(`COLLIE_HOST must be loopback, got ${collieHost}`);
  const bun = process.execPath;
  const collieStateDir = join(paths.stateDir, "collie");
  await mkdir(collieStateDir, { recursive: true, mode: 0o700 });
  await chmod(collieStateDir, 0o700);

  const childEnv: NodeJS.ProcessEnv = {
    ...loadedEnv,
    COLLIE_HOST: collieHost,
    COLLIE_SKIP_SERVE: "1",
    COLLIE_UPDATE_REPO: loadedEnv.COLLIE_UPDATE_REPO || "memset0/herdr-plugin-web-remote",
    HERDR_PLUGIN_CONFIG_DIR: paths.configDir,
    HERDR_PLUGIN_STATE_DIR: collieStateDir,
    HERDR_PLUGIN_ROOT: paths.pluginRoot,
    HERDR_WEB_GENERATION: paths.generation,
  };
  const children = [
    new ManagedChild({
      name: "collie",
      command: [bun, "run", join(paths.pluginRoot, "bridge", "index.ts")],
      cwd: paths.pluginRoot,
      env: childEnv,
      logPath: join(paths.stateDir, "collie.log"),
    }),
  ];
  const gatewayConfig = loadedEnv.HERDR_WEB_GATEWAY_CONFIG?.trim();
  if (gatewayConfig) {
    children.push(
      new ManagedChild({
        name: "gateway",
        command: [bun, "run", join(paths.pluginRoot, "gateway", "index.ts"), gatewayConfig],
        cwd: paths.pluginRoot,
        env: { ...loadedEnv, HERDR_WEB_GENERATION: paths.generation },
        logPath: join(paths.stateDir, "gateway.log"),
      }),
    );
  }

  const startedAt = Date.now();
  const lifecycleLog = join(paths.stateDir, "supervisor.log");
  let shuttingDown = false;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolveDonePromise) => {
    resolveDone = resolveDonePromise;
  });

  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 16 * 1024) {
        socket.end(`${JSON.stringify(response("invalid", paths.generation, startedAt, children, "oversized request"))}\n`);
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      let request: ControlRequest;
      try {
        request = JSON.parse(buffer.slice(0, newline)) as ControlRequest;
      } catch {
        socket.end(`${JSON.stringify(response("invalid", paths.generation, startedAt, children, "invalid JSON"))}\n`);
        return;
      }
      if (request.generation !== paths.generation) {
        socket.end(`${JSON.stringify(response("replacing", paths.generation, startedAt, children))}\n`);
        setTimeout(() => void shutdown("generation-replaced"), 10);
        return;
      }
      if (request.operation === "status" || request.operation === "ensure") {
        socket.end(`${JSON.stringify(response("running", paths.generation, startedAt, children))}\n`);
        return;
      }
      if (request.operation === "restart") {
        socket.end(`${JSON.stringify(response("restarting", paths.generation, startedAt, children))}\n`);
        void Promise.all(children.map((child) => child.restart())).then(() =>
          appendLifecycleLog(lifecycleLog, "children restarted"),
        );
        return;
      }
      if (request.operation === "stop") {
        socket.end(`${JSON.stringify(response("stopping", paths.generation, startedAt, children))}\n`);
        setTimeout(() => void shutdown("requested"), 10);
        return;
      }
      socket.end(`${JSON.stringify(response("invalid", paths.generation, startedAt, children, "unknown operation"))}\n`);
    });
  });

  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = null;
    await appendLifecycleLog(lifecycleLog, `stopping generation=${paths.generation} pid=${process.pid} reason=${reason}`);
    await Promise.all(children.map((child) => child.stop()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(paths.socketPath, { force: true });
    resolveDone?.();
  };

  await rm(paths.socketPath, { force: true });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(paths.socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
  await chmod(paths.socketPath, 0o600);
  for (const child of children) child.start();
  await appendLifecycleLog(
    lifecycleLog,
    `started generation=${paths.generation} pid=${process.pid} children=${children.map((child) => child.status().name).join(",")}`,
  );

  const healthInterval = positiveIntEnv(loadedEnv, "HERDR_WEB_HEALTH_INTERVAL_MS", 15_000, 250);
  const inactiveGrace = positiveIntEnv(loadedEnv, "HERDR_WEB_INACTIVE_GRACE_MS", 60_000, 1_000);
  let unhealthySince: number | null = null;
  healthTimer = setInterval(() => {
    if (runtimeHealthy(loadedEnv)) {
      unhealthySince = null;
      return;
    }
    unhealthySince ??= Date.now();
    if (Date.now() - unhealthySince >= inactiveGrace) void shutdown("herdr-or-plugin-inactive");
  }, healthInterval);

  process.on("SIGINT", () => void shutdown("sigint"));
  process.on("SIGTERM", () => void shutdown("sigterm"));
  await done;
}

main().catch((error) => {
  process.stderr.write(`web-remote supervisor: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
