import { describe, expect, test } from "bun:test";
import { collieChildEnv, coreBackendEnv } from "./collie-env.ts";
import { parseFleetConfig } from "./config.ts";
import { fleetTestConfig } from "./test-helpers.ts";
import { coreBindingId, coreBindingSession } from "./bindings/core.ts";
import { resolveHerdrCommand } from "./herdr-command.ts";
import { resolveInSnapshot } from "./terminal/resolve.ts";

describe("Core-backed Fleet", () => {
  test("Core selection ignores inherited TUI and Core terminal selectors", () => {
    const old = fleetTestConfig();
    const config = { ...old, collie: { ...old.collie, mux: "herdr-core" as const, coreSocket: "/example/core.sock", coreSession: "work" } };
    const inherited = { HC_SOCKET: "/wrong.sock", HC_SESSION: "wrong", HC_TERMINAL_ID: "t2", COLLIE_MUX: "herdr", HERDR_SOCKET_PATH: "/example/old.sock" };
    const env = collieChildEnv(config, "/example/state", inherited);
    expect(env).toMatchObject({ COLLIE_MUX: "herdr-core", HC_SOCKET: "/example/core.sock", HC_SESSION: "work" });
    expect(env.HC_TERMINAL_ID).toBeUndefined();
    expect(coreBackendEnv(config, inherited).COLLIE_MUX_ENDPOINT_HERDR_CORE).toBe("/example/core.sock");
    const command = resolveHerdrCommand({ env: { ...env, PATH: "/example/bin" }, which: (name) => name === "herdr-core" ? "/example/bin/herdr-core" : null, isExecutable: () => true });
    expect(command).toEqual({ ok: true, path: "/example/bin/herdr-core" });
  });

  test("invalid Core selection cannot fall back to a TUI executable", () => {
    expect(resolveHerdrCommand({ env: { COLLIE_MUX: "herdr-core", HERDR_BIN_PATH: "/example/herdr" }, which: () => null, isExecutable: () => true }).ok).toBe(false);
    const config = fleetTestConfig();
    const raw = { schema_version: 1, role: "lead", listen: config.listen, public: { origin: config.public.origin },
      collie: { mux: "herdr-core", host: "127.0.0.1", port: 8787, core_socket: "relative.sock" },
      auth: { username: config.auth.username, password_hash: config.auth.passwordHash, session_secret: config.auth.sessionSecret } };
    expect(() => parseFleetConfig(raw)).toThrow("collie.core_socket must be absolute");
    raw.collie.core_socket = "/example/core.sock";
    expect(parseFleetConfig(raw).collie.coreSocket).toBe("/example/core.sock");
  });

  test("permanent Core identity scopes reused terminal addresses", () => {
    expect(coreBindingId("core-a", "t1")).not.toBe(coreBindingId("core-b", "t1"));
    expect(coreBindingId("core-a", "t1")).not.toBe(coreBindingId("core-a", "t2"));
    expect(coreBindingSession("core-a")).not.toContain("core-a");
    expect(coreBindingId("core-a", "t1")).toBe(coreBindingId("core-a", "t1"));
  });

  test("a local Core address resolves exactly once and never across machines", () => {
    const local = { pane_id: "t1", terminal_id: "t1" };
    expect(resolveInSnapshot({ paneId: "t1" }, { panes: [local] }).ok).toBe(true);
    expect(resolveInSnapshot({ paneId: "t1" }, { panes: [local, local] })).toEqual({ ok: false, reason: "pane-ambiguous" });
    expect(resolveInSnapshot({ paneId: "t1", host: "peer-a" }, { panes: [local] })).toEqual({ ok: false, reason: "not-local" });
    expect(resolveInSnapshot({ paneId: "t1" }, { panes: [{ pane_id: "t1", terminal_id: "remote/t1" }] }).ok).toBe(false);
  });
});
