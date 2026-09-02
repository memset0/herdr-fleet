import { afterEach, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { arch, platform, tmpdir, userInfo } from "node:os";
import { join, resolve } from "node:path";

import { sendControl, type ControlResponse } from "./protocol.ts";
import { ensurePrivateDirs, resolveRuntimePaths } from "./runtime.ts";

const pluginRoot = resolve(import.meta.dir, "..");
let cleanupRoot: string | null = null;
let cleanupEnv: NodeJS.ProcessEnv | null = null;

async function runControl(env: NodeJS.ProcessEnv, operation: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const processHandle = Bun.spawn([process.execPath, "run", join(pluginRoot, "supervisor", "control.ts"), operation], {
    cwd: pluginRoot,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  return { code, stdout, stderr };
}

async function status(env: NodeJS.ProcessEnv): Promise<ControlResponse> {
  const paths = resolveRuntimePaths(env);
  return sendControl(paths.socketPath, { operation: "status", generation: env.HERDR_WEB_GENERATION! });
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(50);
  }
  throw new Error("condition did not become true before timeout");
}

afterEach(async () => {
  if (cleanupEnv) {
    await runControl({ ...cleanupEnv, HERDR_WEB_GENERATION: "cleanup" }, "stop").catch(() => undefined);
    await Bun.sleep(100);
  }
  if (cleanupRoot) await rm(cleanupRoot, { recursive: true, force: true });
  cleanupRoot = null;
  cleanupEnv = null;
});

test(
  "stale ownership, hook races, child crashes, generation replacement, and health shutdown converge safely",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-supervisor-test-"));
    cleanupRoot = root;
    const configDir = join(root, "config");
    const stateDir = join(root, "state");
    const healthy = join(root, "healthy");
    const fakeHerdr = join(root, "herdr-fixture");
    const terminalNodeConfig = join(root, "terminal-node.json");
    const terminalFleetConfig = join(root, "terminal-fleet.json");
    const gatewayConfig = join(root, "gateway.json");
    const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("probe") });
    const colliePort = probe.port;
    await probe.stop(true);
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    await writeFile(healthy, "yes\n", { mode: 0o600 });
    await writeFile(
      fakeHerdr,
      `#!/usr/bin/env bash\nset -euo pipefail\nif [[ \"\${1:-} \${2:-}\" == \"status server\" ]]; then\n  [[ -f ${JSON.stringify(healthy)} ]] || exit 1\n  echo 'status: running'\n  exit 0\nfi\nif [[ \"\${1:-} \${2:-}\" == \"plugin list\" ]]; then\n  echo '{\"result\":{\"plugins\":[{\"plugin_id\":\"memset0.web-remote\",\"enabled\":true}]}}'\n  exit 0\nfi\nexit 1\n`,
      { mode: 0o700 },
    );
    await chmod(fakeHerdr, 0o700);
    await writeFile(terminalNodeConfig, JSON.stringify({
      id: "synthetic",
      owner: userInfo().username,
      herdr_owner: userInfo().username,
      platform: platform() === "darwin" ? "darwin" : "linux",
      architecture: arch() === "arm64" ? "aarch64" : "x86_64",
      herdr: fakeHerdr,
      session: null,
      server_socket: join(root, "missing-herdr.sock"),
      runtime_dir: join(root, "terminal-active"),
      ttyd: join(root, "missing-ttyd"),
      ttyd_sha256: "0".repeat(64),
      ttyd_version_output: "ttyd version 1.7.7-synthetic",
    }) + "\n", { mode: 0o600 });
    await writeFile(terminalFleetConfig, JSON.stringify({
      schema: 3,
      nodes: {
        synthetic: {
          platform: platform() === "darwin" ? "darwin" : "linux",
          architecture: arch() === "arm64" ? "aarch64" : "x86_64",
          owner: userInfo().username,
          herdr_owner: userInfo().username,
          python: process.execPath,
          herdr: fakeHerdr,
          session: null,
          server_socket: join(root, "missing-herdr.sock"),
          runtime_dir: join(root, "terminal-active"),
          install_root: join(root, "terminal-install"),
          binary: {
            source: "local_path",
            path: join(root, "missing-ttyd"),
            sha256: "0".repeat(64),
            version_output: "ttyd version 1.7.7-synthetic",
          },
          transport: { kind: "local" },
        },
      },
    }) + "\n", { mode: 0o600 });
    await writeFile(gatewayConfig, JSON.stringify({
      public: { scheme: "https", fleetHost: "fleet.example.com", baseDomain: "example.com", cookieName: "__Secure-synthetic" },
      auth: {
        username: "operator",
        sessionSecret: Buffer.from("synthetic-session-secret-32-bytes!!").toString("base64url"),
      },
      nodes: [{ id: "synthetic", enabled: true }],
    }) + "\n", { mode: 0o600 });
    await writeFile(
      join(configDir, ".env"),
      `COLLIE_HOST=127.0.0.1\nCOLLIE_PORT=${colliePort}\nCOLLIE_SKIP_SERVE=1\nCOLLIE_MULTI_SESSION=0\n`,
      { mode: 0o600 },
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HERDR_BIN_PATH: fakeHerdr,
      HERDR_PLUGIN_CONFIG_DIR: configDir,
      HERDR_PLUGIN_ROOT: pluginRoot,
      HERDR_PLUGIN_STATE_DIR: stateDir,
      HERDR_SOCKET_PATH: join(root, "missing-herdr.sock"),
      HERDR_WEB_RUNTIME_DIR: join(root, "runtime"),
      HERDR_WEB_GENERATION: "generation-a",
      HERDR_WEB_START_TIMEOUT_MS: "600",
      HERDR_WEB_HEALTH_INTERVAL_MS: "250",
      HERDR_WEB_INACTIVE_GRACE_MS: "1000",
      HERDR_WEB_TERMINAL_NODE_CONFIG: terminalNodeConfig,
      HERDR_WEB_TERMINAL_FLEET_CONFIG: terminalFleetConfig,
      HERDR_WEB_TERMINAL_LIVE_ROOT: root,
      HERDR_WEB_TERMINAL_INGRESS_SOCKET: join(root, "terminal-ingress", "ingress.sock"),
      HERDR_WEB_TERMINAL_INGRESS_GID: String(typeof process.getgid === "function" ? process.getgid() : 0),
      HERDR_WEB_GATEWAY_CONFIG: gatewayConfig,
    };
    cleanupEnv = env;
    const paths = resolveRuntimePaths(env);
    await ensurePrivateDirs(paths);

    // A dead process may leave both artifacts. ensure must reclaim them rather than trusting either.
    await writeFile(paths.socketPath, "stale\n", { mode: 0o600 });
    await mkdir(paths.lockDir, { mode: 0o700 });
    await utimes(paths.lockDir, new Date(0), new Date(0));
    const reclaimed = await runControl(env, "ensure");
    expect(reclaimed.code, reclaimed.stderr).toBe(0);
    expect((await status(env)).generation).toBe("generation-a");

    await runControl(env, "stop");
    await waitUntil(async () => {
      try {
        await status(env);
        return false;
      } catch {
        return true;
      }
    });
    await expect(stat(join(root, "terminal-active", "ttyd.sock"))).rejects.toThrow();

    const racing = await Promise.all(Array.from({ length: 5 }, () => runControl(env, "ensure")));
    expect(racing.every((result) => result.code === 0)).toBeTrue();
    const singleton = await status(env);
    expect(new Set(racing.map((result) => result.stdout.match(/pid=(\d+)/)?.[1])).size).toBe(1);
    expect(singleton.children.filter((child) => child.name === "collie")).toHaveLength(1);
    expect(singleton.children.filter((child) => child.name === "terminal-node")).toHaveLength(1);
    expect(singleton.children.filter((child) => child.name === "terminal-ingress")).toHaveLength(1);
    await waitUntil(async () => {
      try {
        await Promise.all([
          stat(join(root, "terminal-active", "terminal-node-synthetic.sock")),
          stat(join(root, "terminal-ingress", "ingress.sock")),
        ]);
        return true;
      } catch {
        return false;
      }
    });
    const oldChildPid = singleton.children[0]?.pid;
    if (!oldChildPid) throw new Error("Collie child is not running");

    process.kill(oldChildPid, "SIGKILL");
    await waitUntil(async () => {
      const current = await status(env);
      return Boolean(current.children[0]?.running && current.children[0].pid !== oldChildPid && current.children[0].restarts >= 1);
    });

    const newerEnv = { ...env, HERDR_WEB_GENERATION: "generation-b" };
    cleanupEnv = newerEnv;
    const olderSupervisorPid = (await status(env)).pid;
    const replaced = await runControl(newerEnv, "ensure");
    expect(replaced.code, replaced.stderr).toBe(0);
    const current = await status(newerEnv);
    expect(current.generation).toBe("generation-b");
    expect(current.pid).not.toBe(olderSupervisorPid);

    await unlink(healthy);
    await waitUntil(async () => {
      try {
        await status(newerEnv);
        return false;
      } catch {
        return true;
      }
    }, 4_000);

    const gated = await runControl(
      { ...newerEnv, HERDR_WEB_GENERATION: "gated", HERDR_WEB_HOST_PREFIX: "definitely-not-this-host" },
      "ensure",
    );
    expect(gated.code).toBe(0);
    expect(gated.stdout).toContain("skipped");
  },
  20_000,
);
