import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, test } from "bun:test";

import type { JsonValue } from "../../bridge/json.ts";
import type { FleetLeadConfig } from "../config.ts";
import { FLEET_SETTINGS_PATH, createGatewayHandler } from "../gateway.ts";
import { LoginRateLimiter } from "../rate-limit.ts";
import { SessionStore } from "../session-store.ts";
import { fleetTestConfig } from "../test-helpers.ts";
import { createSettingsStore, type SettingsStoreIo } from "./store.ts";

// The settings routes are Fleet's own surface on Fleet's own Gateway. Nothing under `bridge/` knows
// this document exists, and these tests are the evidence for that: the fetcher below refuses every
// proxied call, so anything that reached Collie would fail loudly here.

let config: FleetLeadConfig;
const loginCsrfToken = "C".repeat(43);

beforeAll(async () => {
  const base = fleetTestConfig();
  config = {
    ...base,
    auth: {
      ...base.auth,
      passwordHash: await Bun.password.hash("gateway-test-password", {
        algorithm: "argon2id",
        memoryCost: 4_096,
        timeCost: 1,
      }),
    },
  };
});

const PATH = "/cfg/settings.json";
const VALID = JSON.stringify({ schemaVersion: 1, shortcuts: { bindings: { "next-tab": ["Prefix+M"] } } });

function memoryIo() {
  const files = new Map<string, { text: string; mtime: number }>();
  let clock = 10;
  const io: SettingsStoreIo = {
    async mtime(path) {
      return files.get(path)?.mtime ?? null;
    },
    async read(path) {
      const file = files.get(path);
      if (file === undefined) throw new Error("missing");
      return file.text;
    },
    async write(path, text) {
      clock += 1;
      files.set(path, { text, mtime: clock });
    },
  };
  return { io, raw: () => files.get(PATH)?.text };
}

function req(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", config.public.host);
  return new Request(`${config.public.origin}${path}`, { ...init, headers });
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "herdr-fleet-settings-"));
  const disk = memoryIo();
  const handler = createGatewayHandler({
    config,
    sessions: new SessionStore(join(root, "sessions.json")),
    limiter: new LoginRateLimiter(config.auth.rateLimit),
    fetcher: () => {
      throw new Error("the settings routes must never reach Collie");
    },
    now: () => 1_000,
    loginCsrfToken,
    settings: createSettingsStore(PATH, disk.io, () => undefined),
  });
  const login = await handler(
    req("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: config.public.origin,
        "x-forwarded-for": "192.0.2.9",
      },
      body: new URLSearchParams({ username: "operator", password: "gateway-test-password" }),
    }),
    { peerAddress: "127.0.0.1" },
  );
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error("login did not issue a cookie");
  return { handler, cookie, disk };
}

function get(handler: Awaited<ReturnType<typeof setup>>["handler"], cookie: string) {
  return handler(req(FLEET_SETTINGS_PATH, { headers: { cookie } }), { peerAddress: "127.0.0.1" });
}

function put(
  handler: Awaited<ReturnType<typeof setup>>["handler"],
  cookie: string,
  body: JsonValue,
) {
  return handler(
    req(FLEET_SETTINGS_PATH, {
      method: "PUT",
      headers: { cookie, origin: config.public.origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { peerAddress: "127.0.0.1" },
  );
}

describe("the settings routes", () => {
  test("an unauthenticated read is refused with 401, not a login page", async () => {
    const { handler } = await setup();
    const response = await handler(req(FLEET_SETTINGS_PATH), { peerAddress: "127.0.0.1" });
    expect(response.status).toBe(401);
  });

  test("an unauthenticated write is refused and changes nothing", async () => {
    const { handler, disk } = await setup();
    const response = await handler(
      req(FLEET_SETTINGS_PATH, {
        method: "PUT",
        headers: { origin: config.public.origin, "content-type": "application/json" },
        body: JSON.stringify({ document: VALID, version: "" }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(response.status).toBe(401);
    expect(disk.raw()).toBeUndefined();
  });

  test("an authenticated read answers the document and its version", async () => {
    const { handler, cookie } = await setup();
    const response = await get(handler, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: "", document: "", risky: [] });
  });

  test("a valid write replaces the file and answers the new version", async () => {
    const { handler, cookie, disk } = await setup();
    const response = await put(handler, cookie, { document: VALID, version: "" });
    expect(response.status).toBe(200);
    expect(disk.raw()).toBe(VALID);
    expect(await response.json()).toMatchObject({ version: expect.stringMatching(/^[0-9a-f]{32}$/) });
  });

  test("an invalid document is refused with the offending entry named", async () => {
    const { handler, cookie, disk } = await setup();
    const response = await put(handler, cookie, {
      document: JSON.stringify({ shortcuts: { bindings: { nope: [] } } }),
      version: "",
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ at: "shortcuts.bindings.nope" });
    expect(disk.raw()).toBeUndefined();
  });

  test("a stale write conflicts and hands back what is on disk", async () => {
    const { handler, cookie, disk } = await setup();
    await put(handler, cookie, { document: VALID, version: "" });
    const response = await put(handler, cookie, { document: "{}", version: "" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "conflict", document: VALID });
    expect(disk.raw()).toBe(VALID);
  });

  test("a body that names anything but a document and a version is refused", async () => {
    const { handler, cookie, disk } = await setup();
    expect((await put(handler, cookie, { path: "/etc/passwd" })).status).toBe(400);
    expect((await put(handler, cookie, { document: 7, version: "" })).status).toBe(400);
    expect(disk.raw()).toBeUndefined();
  });

  test("a method the surface does not have is refused rather than proxied", async () => {
    const { handler, cookie } = await setup();
    const response = await handler(
      req(FLEET_SETTINGS_PATH, {
        method: "DELETE",
        headers: { cookie, origin: config.public.origin },
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(response.status).toBe(405);
  });
});
