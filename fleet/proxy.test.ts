import { describe, expect, test } from "bun:test";

import { proxyCollie, upstreamRequestHeaders, widenFontPolicy } from "./proxy.ts";
import { fleetTestConfig } from "./test-helpers.ts";

const config = fleetTestConfig();

describe("single Collie proxy", () => {
  test("constructs trusted headers and preserves the browser request without credentials", async () => {
    const request = new Request("https://fleet.example.com/api/pane/p1/reply?session=demo", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: "Bearer attacker",
        cookie: "__Host-herdr_fleet_session=secret; collie_pref=kept",
        "content-type": "text/plain",
        "if-none-match": '"pane-v1"',
        origin: "https://fleet.example.com",
        "tailscale-user-login": "attacker@example.com",
        "x-forwarded-for": "198.51.100.9",
        "x-trusted-device": "attacker",
      },
      body: "hello",
    });
    const headers = upstreamRequestHeaders(request, config);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBe("collie_pref=kept");
    expect(headers.get("tailscale-user-login")).toBeNull();
    expect(headers.get("x-trusted-device")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(headers.get("host")).toBe("fleet.example.com");
    expect(headers.get("origin")).toBe("https://fleet.example.com");
    expect(headers.get("accept-encoding")).toBe("identity");
    expect(headers.get("if-none-match")).toBe('"pane-v1"');

    let target = "";
    let sent: RequestInit | undefined;
    const response = await proxyCollie(request, config, async (input, init) => {
      target = String(input);
      sent = init;
      const responseHeaders = new Headers({
        connection: "keep-alive",
        "content-encoding": "gzip",
        "content-length": "7",
        location: "http://127.0.0.1:8787/pane/p1?session=demo",
      });
      responseHeaders.append("set-cookie", "__Host-herdr_fleet_session=attacker; Path=/");
      responseHeaders.append("set-cookie", "collie_pref=kept; Path=/");
      return new Response("proxied", { status: 307, headers: responseHeaders });
    });
    expect(target).toBe("http://127.0.0.1:8787/api/pane/p1/reply?session=demo");
    expect(await new Response(sent?.body).text()).toBe("hello");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fleet.example.com/pane/p1?session=demo");
    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(["collie_pref=kept; Path=/"]);
  });

  test("forwards Collie's seen signal on a pane read, and nothing else outside the allowlist", () => {
    const seen = upstreamRequestHeaders(
      new Request("https://fleet.example.com/api/pane/p1?lines=1", {
        headers: { "x-collie-seen": "1", "x-unlisted": "dropped" },
      }),
      config,
    );
    expect(seen.get("x-collie-seen")).toBe("1");
    expect(seen.get("x-unlisted")).toBeNull();
    const plain = upstreamRequestHeaders(new Request("https://fleet.example.com/api/pane/p1"), config);
    expect(plain.get("x-collie-seen")).toBeNull();
  });

  test("refuses an absolute redirect whose parsed origin is not the Collie origin", async () => {
    const request = new Request("https://fleet.example.com/");
    const response = await proxyCollie(request, config, async () =>
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1:8787@evil.example/steal" } }),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  test("preserves a conditional 304 without stale entity headers", async () => {
    const response = await proxyCollie(
      new Request("https://fleet.example.com/api/pane/p1", { headers: { "if-none-match": '"pane-v1"' } }),
      config,
      async () => new Response(null, { status: 304, headers: { etag: '"pane-v1"', "content-length": "99" } }),
    );
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"pane-v1"');
    expect(response.headers.get("content-length")).toBeNull();
  });

  test("carries the Gateway's own pairing token, never the browser's", async () => {
    const request = new Request("https://fleet.example.com/api/snapshot", {
      headers: { authorization: "Bearer browser-supplied" },
    });
    expect(upstreamRequestHeaders(request, config, "gateway-token").get("authorization")).toBe("Bearer gateway-token");
    expect(upstreamRequestHeaders(request, config).get("authorization")).toBeNull();
    let sent: Headers | undefined;
    await proxyCollie(request, config, async (_input, init) => {
      sent = new Headers(init?.headers);
      return new Response("{}");
    }, "gateway-token");
    expect(sent?.get("authorization")).toBe("Bearer gateway-token");
  });
});

describe("the fetched font's origin in Collie's document policy", () => {
  const COLLIE_CSP =
    "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; " +
    "manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'";
  const ORIGIN = "https://fonts.example.com";

  test("admits the origin for stylesheets and fonts and for nothing else", () => {
    const widened = widenFontPolicy(COLLIE_CSP, [ORIGIN]);
    const directive = (name: string) => widened.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
    expect(directive("style-src")).toBe(`style-src 'self' 'unsafe-inline' ${ORIGIN}`);
    // Absent, it inherited default-src; spelled out, it keeps that and adds the origin alone.
    expect(directive("font-src")).toBe(`font-src 'self' ${ORIGIN}`);
    for (const name of ["default-src", "connect-src", "script-src", "worker-src", "base-uri", "frame-ancestors", "object-src", "form-action"]) {
      expect(directive(name)).not.toContain(ORIGIN);
    }
  });

  test("leaves a sandboxed policy alone", () => {
    expect(widenFontPolicy("default-src 'none'; sandbox", [ORIGIN])).toBe("default-src 'none'; sandbox");
  });

  test("widens an HTML document Collie answers, and no other body", async () => {
    const answer = (type: string) =>
      proxyCollie(new Request("https://fleet.example.com/"), config, async () =>
        new Response("x", { headers: { "content-type": type, "content-security-policy": COLLIE_CSP } }),
      );
    expect((await answer("text/html; charset=utf-8")).headers.get("content-security-policy")).toContain("font-src");
    expect((await answer("application/json")).headers.get("content-security-policy")).toBe(COLLIE_CSP);
  });
});

describe("Collie 1.20's phone speech engine through the proxy", () => {
  // Collie serves every `stt/*.js` with its own worker policy (bridge/server.ts STT_WORKER_CSP): the one
  // place wasm may compile, so the document's policy never gains 'wasm-unsafe-eval'. Copied here as
  // text so a change upstream is read at the next adoption rather than imported unread.
  const STT_WORKER_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; base-uri 'none'";

  test("passes the speech worker's own policy and the engine's types untouched", async () => {
    const answer = (path: string, type: string, policy?: string) =>
      proxyCollie(new Request(`https://fleet.example.com${path}`), config, async () => {
        const headers = new Headers({ "content-type": type });
        if (policy !== undefined) headers.set("content-security-policy", policy);
        return new Response("x", { headers });
      });
    const worker = await answer("/stt/worker-abc123.js", "text/javascript; charset=utf-8", STT_WORKER_CSP);
    expect(worker.headers.get("content-security-policy")).toBe(STT_WORKER_CSP);
    const wasm = await answer("/stt/needle-3-93e88ede/needle.wasm", "application/wasm");
    expect(wasm.headers.get("content-type")).toBe("application/wasm");
  });

  test("keeps every directive of the page policy but the two it widens", () => {
    const page =
      "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; " +
      "style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; " +
      "manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'";
    const kept = (policy: string) =>
      policy.split("; ").filter((d) => !d.startsWith("style-src ") && !d.startsWith("font-src "));
    expect(kept(widenFontPolicy(page, ["https://fonts.example.com"]))).toEqual(kept(page));
  });

  test("streams the model to the phone byte for byte, with its type, tag and sandbox", async () => {
    const model = new Uint8Array(4 * 1024 * 1024);
    for (let i = 0; i < model.length; i += 1) model[i] = (i * 31) & 0xff;
    const sandbox = "default-src 'none'; sandbox";
    const response = await proxyCollie(new Request("https://fleet.example.com/api/stt/model/" + "b".repeat(64)), config, async () =>
      new Response(new Blob([model]).stream(), {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(model.length),
          etag: '"b"',
          "content-security-policy": sandbox,
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("etag")).toBe('"b"');
    expect(response.headers.get("content-security-policy")).toBe(sandbox);
    // The phone measures progress against the model's size from the host's status, never from this
    // header, so the proxy dropping it (it rewrites the body's framing) costs the bar nothing.
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBe(model.length);
    expect(Bun.hash(body)).toBe(Bun.hash(model));
  });
});
