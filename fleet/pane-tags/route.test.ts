import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayHandler } from "../gateway.ts";
import { createSessionToken, sessionCookie } from "../auth.ts";
import { SessionStore } from "../session-store.ts";
import { fleetTestConfig } from "../test-helpers.ts";
import { createTagStore } from "./store.ts";
import { TAGS_PATH, parseTagSnapshot } from "./document.ts";

const roots: string[] = [];
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }); });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "fleet-tags-route-")); roots.push(root);
  const config = fleetTestConfig(), sessions = new SessionStore(join(root, "sessions.json"));
  const token = createSessionToken(config, 1_000);
  await sessions.create(token, 1_000);
  const cookie = sessionCookie(config, token.token).split(";")[0]!;
  const handler = createGatewayHandler({ config, sessions, tags: createTagStore(join(root, "tags.json")), now: () => 1_000,
    fetcher: () => { throw new Error("Tags must not proxy to a peer"); } });
  const request = (method: string, body?: string, authenticated = true, origin = config.public.origin) => {
    const init: RequestInit = { method, headers: { host: config.public.host, cookie: authenticated ? cookie : "", origin, "content-type": "application/json" } };
    if (body !== undefined) init.body = body;
    return handler(new Request(`${config.public.origin}${TAGS_PATH}`, init), { peerAddress: "127.0.0.1" });
  };
  return { request };
}
const mutation = JSON.stringify({ version: "", command: { kind: "attach", pane: { row: "pane-1", space: "Project" }, name: "Review" } });
test("Gateway authentication and origin checks precede tag writes", async () => {
  const { request } = await setup();
  expect((await request("GET", undefined, false)).status).toBe(401);
  expect((await request("POST", mutation, false)).status).toBe(401);
  expect((await request("POST", mutation, true, "https://other.example")).status).toBe(403);
  expect(parseTagSnapshot(await (await request("GET")).text())?.document.tags).toEqual([]);
});
test("successful writes return shared state with no-store headers and stale writes conflict", async () => {
  const { request } = await setup();
  const saved = await request("POST", mutation);
  expect(saved.status).toBe(200);
  expect(saved.headers.get("cache-control")).toContain("no-store");
  const result = parseTagSnapshot(await saved.text());
  expect(result?.document.tags[0]?.name).toBe("Review");
  expect(parseTagSnapshot(await (await request("GET")).text())).toEqual(result);
  expect((await request("POST", mutation)).status).toBe(409);
});
test("oversized, malformed and unsupported requests leave state untouched", async () => {
  const { request } = await setup();
  expect((await request("POST", "x".repeat(17 * 1024))).status).toBe(413);
  expect((await request("POST", "bad")).status).toBe(400);
  expect((await request("DELETE")).status).toBe(405);
  expect(parseTagSnapshot(await (await request("GET")).text())?.document.tags).toEqual([]);
});
