import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayHandler } from "../gateway.ts";
import { createSessionToken, sessionCookie } from "../auth.ts";
import { SessionStore } from "../session-store.ts";
import { fleetTestConfig } from "../test-helpers.ts";
import { createTodoistStore, emptyTodoistState } from "./store.ts";
import { createTodoistService } from "./service.ts";
import { bindingRedirect } from "./route.ts";
import { oauthLanding } from "./callback.ts";

const roots: string[] = [];
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }); });

test("Todoist routes remain behind the existing session and origin gates", async () => {
  const root = await mkdtemp(join(tmpdir(), "fleet-todoist-route-")); roots.push(root);
  const config = fleetTestConfig(), sessions = new SessionStore(join(root, "sessions.json"));
  const token = createSessionToken(config, 1000); await sessions.create(token, 1000);
  const cookie = sessionCookie(config, token.token).split(";")[0]!;
  const service = createTodoistService({ store: createTodoistStore(join(root, "todoist.json")), origin: config.public.origin, fetcher: async () => { throw new Error("Provider must not be called"); } });
  const handler = createGatewayHandler({ config, sessions, todoist: service, now: () => 1000 });
  const request = (path: string, method = "GET", authenticated = false, origin = config.public.origin) => {
    const init: RequestInit = { method, headers: { host: config.public.host, cookie: authenticated ? cookie : "", origin, "content-type": "application/json" } };
    if (method === "POST") init.body = "{}";
    return handler(new Request(config.public.origin + path, init), { peerAddress: "127.0.0.1" });
  };
  expect((await request("/fleet/api/todoist/status")).status).toBe(401);
  expect((await request("/fleet/api/todoist/configure", "POST")).status).toBe(401);
  expect((await request("/fleet/api/todoist/configure", "POST", true, "https://other.example")).status).toBe(403);
  const response = await request("/fleet/api/todoist/status", "GET", true);
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ configured: false, connected: false });
});

test("OAuth callback embeds no untrusted input and requires a same-origin scripted continuation", async () => {
  const url = new URL("https://example.com/fleet/todoist/callback");
  url.searchParams.set("state", "a".repeat(43)); url.searchParams.set("code", '"><script>bad()</script>');
  const response = oauthLanding(url), html = await response.text();
  expect(html).not.toContain("bad()");
  expect(html).toContain('src="/fleet/todoist/callback.js"');
  expect(response.headers.get("content-security-policy")).toContain("form-action 'none'");
});

test("stable backlinks follow movement and refuse replacement or stale inventory", async () => {
  const state = emptyTodoistState();
  const terminal = { version: 1 as const, host: "member-a", session: "default", id: "herdr:term_one" };
  state.links = [{ id: "link-one", terminal, kind: "todoist", resource: '["account","project","task"]', accountId: "account", projectId: "project", taskId: "task", state: "linked" }];
  const store = createTodoistStore("unused", { read: async () => JSON.stringify(state), write: async () => { throw new Error("Read-only redirect"); } });
  const service = createTodoistService({ store, origin: "https://example.com" });
  const moved = { paneId: "w9:p7", host: "member-a", session: "default", bindingSession: "default", bindingId: terminal.id, workspace: "Renamed", fresh: true, primary: true };
  const response = await bindingRedirect("link-one", service, async () => [moved]);
  expect(response.headers.get("location")).toBe("/pane/w9%3Ap7?h=member-a&s=default");
  expect((await bindingRedirect("link-one", service, async () => [{ ...moved, bindingId: "herdr:term_new" }])).status).toBe(409);
  expect((await bindingRedirect("link-one", service, async () => [{ ...moved, fresh: false }])).status).toBe(409);
});
