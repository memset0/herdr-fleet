import { appendFile, chmod, rm, stat, truncate } from "node:fs/promises";
import net from "node:net";
import { join } from "node:path";

import { loadFleetConfig } from "./config.ts";
import { ManagedChild } from "./managed-child.ts";
import { parseControlRequest, type ControlResponse } from "./protocol.ts";
import { childSpecs, ensurePrivateRuntime, resolveRuntimePaths } from "./runtime.ts";

const LOG_LIMIT_BYTES = 256 * 1024;
const READY_TIMEOUT_MS = 10_000;

async function lifecycleLog(path: string, message: string): Promise<void> {
  try {
    if ((await stat(path)).size >= LOG_LIMIT_BYTES) await truncate(path, 0);
  } catch {
    // appendFile creates a missing log.
  }
  await appendFile(path, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8", mode: 0o600 });
}

function endpoint(host: string, port: number, path: string): string {
  return `http://${host.includes(":") ? `[${host}]` : host}:${port}${path}`;
}

async function endpointReady(url: string, host: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 400);
  try {
    const response = await fetch(url, { headers: { host }, signal: controller.signal, redirect: "manual" });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const paths = resolveRuntimePaths();
  await ensurePrivateRuntime(paths);
  const config = await loadFleetConfig(paths.configPath);
  const children = childSpecs(config, paths, process.env).map(
    (spec) =>
      new ManagedChild({
        ...spec,
        minBackoffMs: 1_000,
        maxBackoffMs: 30_000,
      }),
  );
  const startedAt = Date.now();
  const logPath = join(paths.stateDir, "supervisor.log");
  let ready = false;
  let stopping = false;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const readiness = async () => {
    if (!children.every((child) => child.status().running)) return false;
    const collie = await endpointReady(
      endpoint(config.collie.host, config.collie.port, "/api/config"),
      config.collie.host.includes(":") ? `[${config.collie.host}]:${config.collie.port}` : `${config.collie.host}:${config.collie.port}`,
    );
    if (!collie) return false;
    return await endpointReady(
      endpoint(config.listen.host, config.listen.port, "/auth/login"),
      config.public.host,
    );
  };

  const waitForReadiness = async () => {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await readiness()) {
        ready = true;
        return;
      }
      await Bun.sleep(100);
    }
    throw new Error("Fleet children did not become ready within 10 seconds");
  };

  const response = (status: ControlResponse["status"], message?: string): ControlResponse => ({
    status,
    generation: paths.generation,
    pid: process.pid,
    startedAt,
    children: children.map((child) => child.status()),
    message,
  });

  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 16 * 1024) {
        socket.end(`${JSON.stringify(response("invalid", "oversized request"))}\n`);
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const request = parseControlRequest(buffer.slice(0, newline));
      if (request === null) {
        socket.end(`${JSON.stringify(response("invalid", "invalid request"))}\n`);
        return;
      }
      if (request.generation !== paths.generation && request.operation === "ensure") {
        socket.end(`${JSON.stringify(response("replacing"))}\n`);
        setTimeout(() => void shutdown("generation-replaced"), 10);
        return;
      }
      if (request.operation === "ensure" || request.operation === "status") {
        socket.end(`${JSON.stringify(response(ready ? "running" : "starting"))}\n`);
        return;
      }
      if (request.operation === "restart") {
        if (request.generation !== paths.generation) {
          socket.end(`${JSON.stringify(response("invalid", "generation mismatch"))}\n`);
          return;
        }
        ready = false;
        socket.end(`${JSON.stringify(response("restarting"))}\n`);
        void restartChildren();
        return;
      }
      socket.end(`${JSON.stringify(response("stopping"))}\n`);
      setTimeout(() => void shutdown("requested"), 10);
    });
  });

  const restartChildren = async () => {
    await Promise.all(children.map((child) => child.restart()));
    try {
      await waitForReadiness();
      await lifecycleLog(logPath, "children restarted");
    } catch (error) {
      await lifecycleLog(logPath, `restart failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const shutdown = async (reason: string) => {
    if (stopping) return;
    stopping = true;
    ready = false;
    if (healthTimer !== null) clearInterval(healthTimer);
    healthTimer = null;
    await lifecycleLog(logPath, `stopping generation=${paths.generation} reason=${reason}`);
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
  try {
    await waitForReadiness();
  } catch (error) {
    await shutdown("startup-failed");
    throw error;
  }
  await lifecycleLog(logPath, `started generation=${paths.generation} pid=${process.pid}`);
  healthTimer = setInterval(() => {
    void readiness().then((healthy) => {
      ready = healthy;
      return undefined;
    });
  }, 1_000);
  process.once("SIGINT", () => void shutdown("sigint"));
  process.once("SIGTERM", () => void shutdown("sigterm"));
  await done;
}

main().catch((error) => {
  console.error(`herdr-fleet supervisor: ${error instanceof Error ? error.message : "startup failed"}`);
  process.exitCode = 1;
});
