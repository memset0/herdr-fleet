import { describe, expect, test } from "bun:test";

import { proxyCollie, upstreamRequestHeaders } from "./proxy.ts";
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
});
