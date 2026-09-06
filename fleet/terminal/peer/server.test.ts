import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { FleetTerminalConfig } from "../../config.ts";
import type { TerminalServer } from "../session.ts";
import { startPeerTerminalServer } from "./server.ts";
import { PeerTerminalService } from "./service.ts";

const port = 18_000 + Math.floor(Math.random() * 900);
const CONFIG: FleetTerminalConfig = {
  bind: { host: "127.0.0.1", port },
  leadBind: { host: "127.0.0.1", port: port + 1_000 },
  serverPath: "/synthetic/fleet/bin/terminal-server",
  serverDigest: "0".repeat(64),
  idleSeconds: 3_600,
  maxServers: 2,
};

const stopped: string[] = [];
const service = new PeerTerminalService({
  config: CONFIG,
  resolve: async () => ({ ok: true, placement: { kind: "local", terminalId: "term_abc", paneId: "w1:p1" } }),
  verifyExecutable: async () => true,
  startServer: async (): Promise<TerminalServer> => ({
    endpoint: "ws+unix:///run/term_abc.sock:/ws",
    stop: () => stopped.push("term_abc"),
  }),
  standDown: () => undefined,
});

let listener: ReturnType<typeof startPeerTerminalServer>;
const at = (path: string) => `http://127.0.0.1:${port}${path}`;

beforeAll(() => {
  listener = startPeerTerminalServer({ service, config: CONFIG });
});

afterAll(async () => {
  service.stop();
  await listener.stop(true);
});

describe("what the listener answers", () => {
  test("state, with counts and bounds and nothing about a Pane", async () => {
    const response = await fetch(at("/terminal/state"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ held: 0, idleSeconds: 3_600, maxServers: 2 });
  });

  test("close, naming a Pane in its body", async () => {
    const response = await fetch(at("/terminal/close"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pane: "w1:p1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("a refusal names the field it refused", async () => {
    const response = await fetch(at("/terminal/close"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pane: "w1:p1", terminal: "term_abc" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "refused", at: "terminal" });
  });

  test("a fourth operation does not exist", async () => {
    const response = await fetch(at("/terminal/start"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ at: "path" });
  });

  test("attach is a stream and refuses to be an ordinary request", async () => {
    const response = await fetch(at("/terminal/attach?pane=w1:p1"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ at: "upgrade" });
  });

  test("a body that is not one JSON object is refused rather than defaulted", async () => {
    const response = await fetch(at("/terminal/close"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ at: "body" });
  });

  test("it binds loopback only, so nothing off this machine can reach it", () => {
    expect(listener.hostname).toBe("127.0.0.1");
    expect(listener.port).toBe(port);
  });
});
