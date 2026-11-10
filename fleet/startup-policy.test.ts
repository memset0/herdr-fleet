import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { expect, test } from "bun:test";

import { probeEndpoint } from "./pack-reachability.ts";
import { startupPolicy, waitForStartup } from "./startup-policy.ts";
import { fleetTestConfig } from "./test-helpers.ts";

const legacy = startupPolicy(fleetTestConfig());
const core = startupPolicy({ collie: { ...fleetTestConfig().collie, mux: "herdr-core" } });

function virtualClock() {
  let now = 0;
  return {
    now: () => now,
    sleep: (milliseconds: number) => { now += milliseconds; return Promise.resolve(); },
  };
}

test("Core waits for delayed evidence that the legacy policy refuses", async () => {
  const clock = virtualClock();
  await waitForStartup(() => Promise.resolve(clock.now() >= 13_000), core.readyMs, clock);
  expect(clock.now()).toBe(13_000);
  const oldClock = virtualClock();
  await expect(waitForStartup(() => Promise.resolve(oldClock.now() >= 13_000), legacy.readyMs, oldClock)).rejects.toThrow("did not become ready");
});

test("ready evidence has no policy-sized delay and permanent failure stays bounded", async () => {
  const fast = virtualClock();
  await waitForStartup(() => Promise.resolve(true), core.readyMs, fast);
  expect(fast.now()).toBe(0);
  const stuck = virtualClock();
  await expect(waitForStartup(() => Promise.resolve(false), core.readyMs, stuck)).rejects.toThrow("did not become ready");
  expect(stuck.now()).toBe(core.readyMs);
  for (const policy of [core, legacy]) {
    expect(policy.controlMs).toBeGreaterThan(policy.readyMs);
    expect(policy.staleLockMs).toBeGreaterThan(policy.controlMs);
  }
});

function freePort(): number {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("fixture") });
  const port = server.port;
  server.stop(true);
  if (port === undefined) throw new Error("fixture TCP port missing");
  return port;
}

test("concurrent Core launchers share a generation whose child binds after thirteen seconds", async () => {
  const root = mkdtempSync("/tmp/fleet-start-");
  const colliePort = freePort();
  let gatewayPort = freePort();
  while (gatewayPort === colliePort) gatewayPort = freePort();
  for (const path of ["fleet", "bin", "home", "config", "run"]) mkdirSync(join(root, path), { mode: 0o700 });
  for (const file of ["control.ts", "daemon.ts"]) symlinkSync(join(import.meta.dir, file), join(root, "fleet", file));
  const collie = join(root, "bin/collie");
  writeFileSync(collie, `#!/usr/bin/env bun\nawait Bun.sleep(13000);\nBun.serve({hostname:"127.0.0.1",port:Number(process.env.FLEET_TEST_COLLIE_PORT),fetch:()=>new Response("ok")});\n`);
  chmodSync(collie, 0o700);
  writeFileSync(join(root, "fleet/gateway-main.ts"), `Bun.serve({hostname:"127.0.0.1",port:Number(process.env.FLEET_TEST_GATEWAY_PORT),fetch:()=>new Response("ok")});\n`);
  writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
  const configPath = join(root, "fleet.toml");
  writeFileSync(configPath, `schema_version=1\nrole="lead"\n[listen]\nhost="127.0.0.1"\nport=${gatewayPort}\n[public]\norigin="https://fleet.example.com"\n[collie]\nhost="127.0.0.1"\nport=${colliePort}\nmux="herdr-core"\ncore_socket="/example/core.sock"\n[auth]\nusername="operator"\npassword_hash="$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA"\nsession_secret="${Buffer.alloc(32, 17).toString("base64url")}"\n`, { mode: 0o600 });
  const env = { ...process.env, HOME: join(root, "home"), XDG_CONFIG_HOME: join(root, "config"),
    XDG_RUNTIME_DIR: join(root, "run"), PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
    HERDR_PLUGIN_ROOT: root, HERDR_PLUGIN_STATE_DIR: join(root, "state"), HERDR_FLEET_CONFIG: configPath,
    HERDR_FLEET_GENERATION: "example-startup", COLLIE_CONFIG: join(root, "absent.toml"),
    FLEET_TEST_COLLIE_PORT: String(colliePort), FLEET_TEST_GATEWAY_PORT: String(gatewayPort) };
  async function control(operation: string) {
    const child = Bun.spawn([process.execPath, "run", join(root, "fleet/control.ts"), operation], { env, stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { exitCode, stdout, stderr };
  }
  try {
    const first = control("start");
    await Bun.sleep(150);
    const second = control("start");
    const results = await Promise.all([first, second]);
    for (const result of results) {
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("supervisor running");
    }
    expect(results[0]!.stdout.match(/ pid=(\d+)/)?.[1]).toBe(results[1]!.stdout.match(/ pid=(\d+)/)?.[1]);
    expect(await probeEndpoint({ host: "127.0.0.1", port: colliePort })).toBe(true);
  } finally {
    await control("stop");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!(await probeEndpoint({ host: "127.0.0.1", port: colliePort })) && !(await probeEndpoint({ host: "127.0.0.1", port: gatewayPort }))) break;
      await Bun.sleep(25);
    }
    expect(await probeEndpoint({ host: "127.0.0.1", port: colliePort })).toBe(false);
    expect(await probeEndpoint({ host: "127.0.0.1", port: gatewayPort })).toBe(false);
    await rm(root, { recursive: true, force: true });
  }
}, 35_000);
