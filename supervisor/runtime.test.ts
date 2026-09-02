import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeGeneration,
  ensurePrivateDirs,
  evaluateHostGate,
  parseEnvFile,
  loadPluginEnv,
  positiveIntEnv,
  resolveRuntimePaths,
  resolveTerminalRoles,
  sanitizedDaemonEnv,
} from "./runtime.ts";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe("supervisor runtime policy", () => {
  test("parses quoted env files without evaluating shell", () => {
    expect(parseEnvFile("A=one\nB='two words'\nC=\"three\\nlines\" # note\n")).toEqual({
      A: "one",
      B: "two words",
      C: "three\nlines",
    });
    expect(() => parseEnvFile("$(touch /tmp/not-evaluated)")).toThrow("invalid .env line");
  });

  test("rejects scheduler jobs and non-designated shared-home hosts", () => {
    expect(evaluateHostGate({ HERDR_WEB_HOST_PREFIX: "login-a" }, "login-a01").allowed).toBeTrue();
    expect(evaluateHostGate({ HERDR_WEB_HOST_PREFIX: "login-a" }, "login-b01")).toEqual({
      allowed: false,
      reason: "host login-b01 does not match designated prefix login-a",
    });
    expect(evaluateHostGate({ SLURM_JOB_ID: "123" }, "login-a01").reason).toContain("SLURM_JOB_ID");
    expect(evaluateHostGate({ SLURM_JOB_ID: "123", HERDR_WEB_DISALLOW_JOBS: "0" }, "login-a01").allowed).toBeTrue();
  });

  test("uses a node-local control directory and owner-only state", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-runtime-test-"));
    temporary.push(root);
    const paths = resolveRuntimePaths(
      {
        HERDR_PLUGIN_ROOT: join(root, "plugin"),
        HERDR_PLUGIN_CONFIG_DIR: join(root, "config"),
        HERDR_PLUGIN_STATE_DIR: join(root, "state"),
        HERDR_WEB_RUNTIME_DIR: join(root, "runtime"),
      },
      42,
    );
    expect(paths.runtimeDir).toBe(join(root, "runtime", "herdr-web-remote-42"));
    await ensurePrivateDirs(paths);
    await chmod(paths.runtimeDir, 0o755);
    await ensurePrivateDirs(paths);
    expect((await stat(paths.runtimeDir)).mode & 0o777).toBe(0o700);
    expect((await stat(paths.stateDir)).mode & 0o777).toBe(0o700);
  });

  test("requires one node-control role and pairs central ingress with Gateway", () => {
    const paths = resolveRuntimePaths({
      HERDR_PLUGIN_ROOT: "/opt/web-remote",
      HERDR_PLUGIN_CONFIG_DIR: "/tmp/config",
      HERDR_PLUGIN_STATE_DIR: "/tmp/state",
      HERDR_WEB_RUNTIME_DIR: "/tmp/runtime",
    }, 42);
    const nodeOnly = resolveTerminalRoles(paths, {
      HERDR_WEB_TERMINAL_NODE_CONFIG: "/tmp/node.json",
    });
    expect(nodeOnly.nodeConfig).toBe("/tmp/node.json");
    expect(nodeOnly.ingress).toBeNull();
    expect(() => resolveTerminalRoles(paths, {})).toThrow("HERDR_WEB_TERMINAL_NODE_CONFIG");
    expect(() => resolveTerminalRoles(paths, {
      HERDR_WEB_TERMINAL_NODE_CONFIG: "/tmp/node.json",
      HERDR_WEB_GATEWAY_CONFIG: "/tmp/gateway.json",
    })).toThrow("configured together");
    const central = resolveTerminalRoles(paths, {
      HERDR_WEB_TERMINAL_NODE_CONFIG: "/tmp/node.json",
      HERDR_WEB_GATEWAY_CONFIG: "/tmp/gateway.json",
      HERDR_WEB_TERMINAL_FLEET_CONFIG: "/tmp/terminal.json",
      HERDR_WEB_TERMINAL_LIVE_ROOT: "/tmp/terminal-live",
      HERDR_WEB_TERMINAL_INGRESS_SOCKET: "/tmp/terminal-ingress/ingress.sock",
      HERDR_WEB_TERMINAL_INGRESS_GID: "123",
    });
    expect(central.ingress).toEqual({
      inventory: "/tmp/terminal.json",
      gatewayConfig: "/tmp/gateway.json",
      liveRoot: "/tmp/terminal-live",
      socketPath: "/tmp/terminal-ingress/ingress.sock",
      socketGid: 123,
    });
    expect(() => resolveTerminalRoles(paths, {
      HERDR_WEB_TERMINAL_NODE_CONFIG: "/tmp/node.json",
      HERDR_WEB_GATEWAY_CONFIG: "/tmp/gateway.json",
      HERDR_WEB_TERMINAL_FLEET_CONFIG: "/tmp/terminal.json",
      HERDR_WEB_TERMINAL_LIVE_ROOT: "/tmp/terminal-live",
    })).toThrow("ingress socket and GID");
  });

  test("generation changes with managed source and hook variables are removed", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-generation-test-"));
    temporary.push(root);
    for (const relative of ["bridge", "gateway", "supervisor"]) await mkdir(join(root, relative), { recursive: true });
    await writeFile(join(root, "package.json"), "{}\n");
    await writeFile(join(root, "bridge", "index.ts"), "export {};\n");
    await writeFile(join(root, "gateway", "index.ts"), "export {};\n");
    await writeFile(join(root, "supervisor", "daemon.ts"), "export {};\n");
    const before = computeGeneration(root);
    await writeFile(join(root, "gateway", "index.ts"), "export const changed = true;\n");
    expect(computeGeneration(root)).not.toBe(before);
    expect(sanitizedDaemonEnv({ HERDR_PLUGIN_EVENT: "pane.focused", KEEP: "yes" })).toEqual({ KEEP: "yes" });
    expect(positiveIntEnv({ X: "bad" }, "X", 15)).toBe(15);
    expect(positiveIntEnv({ X: "20" }, "X", 15)).toBe(20);
  });

  test("refuses a group-readable plugin env", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-env-mode-test-"));
    temporary.push(root);
    const path = join(root, ".env");
    await writeFile(path, "COLLIE_PORT=8787\n", { mode: 0o600 });
    expect((await loadPluginEnv(root, {})).COLLIE_PORT).toBe("8787");
    await chmod(path, 0o640);
    await expect(loadPluginEnv(root, {})).rejects.toThrow("chmod 600");
  });
});
