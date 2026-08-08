import { describe, expect, test } from "bun:test";

import { proxyCollie, publicCollieAsset, stripCookie, stripResponseCookie } from "./proxy.ts";
import { gatewayConfig } from "./test-helpers.ts";

describe("Collie proxy semantics", () => {
  test("strips only the Gateway cookie", () => {
    expect(stripCookie("a=1; herdr_web_session=secret; collie=kept", "herdr_web_session")).toBe("a=1; collie=kept");
    expect(stripCookie("herdr_web_session=secret", "herdr_web_session")).toBeNull();
  });

  test("strips only matching upstream Set-Cookie fields without splitting Expires", () => {
    const headers = new Headers();
    headers.append("set-cookie", "collie=kept; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/");
    headers.append("set-cookie", "herdr_web_session=attacker; Domain=.example.com; Path=/; Secure");
    headers.append("set-cookie", "preferences=kept-too; Path=/");
    headers.append("set-cookie", "herdr_web_session=cleared; Max-Age=0; Path=/");

    stripResponseCookie(headers, "herdr_web_session");

    expect(headers.getSetCookie()).toEqual([
      "collie=kept; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
      "preferences=kept-too; Path=/",
    ]);
  });

  test("preserves route/body and public Host while stripping credentials", async () => {
    const config = gatewayConfig();
    const node = config.nodes[0]!;
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(input);
      seenInit = init;
      const headers = new Headers({
        location: "http://127.0.0.1:18788/pane/next",
        connection: "keep-alive",
        "content-encoding": "gzip",
        "content-length": "7",
        "x-upstream": "yes",
      });
      headers.append("set-cookie", "herdr_web_session=must-not-reach-browser; Domain=.example.com; Path=/");
      headers.append("set-cookie", "collie=kept; Path=/");
      return new Response("proxied", {
        status: 307,
        headers,
      });
    }) as typeof fetch;
    const request = new Request("https://local.example.com/api/pane/p1/reply?session=demo", {
      method: "POST",
      headers: {
        host: "local.example.com",
        origin: "https://local.example.com",
        authorization: "Bearer must-not-forward",
        cookie: "herdr_web_session=secret; collie=kept",
        "content-type": "text/plain",
      },
      body: "hello",
    });
    const result = await proxyCollie(request, node, "http://127.0.0.1:18788", config, fetcher);
    expect(seenUrl).toBe("http://127.0.0.1:18788/api/pane/p1/reply?session=demo");
    const headers = new Headers(seenInit?.headers);
    expect(headers.get("host")).toBe("local.example.com");
    expect(headers.get("origin")).toBe("https://local.example.com");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("accept-encoding")).toBe("identity");
    expect(headers.get("cookie")).toBe("collie=kept");
    expect(await new Response(seenInit?.body).text()).toBe("hello");
    expect(result.headers.get("location")).toBe("https://local.example.com/pane/next");
    expect(result.headers.get("connection")).toBeNull();
    expect(result.headers.get("content-encoding")).toBeNull();
    expect(result.headers.get("content-length")).toBeNull();
    expect(result.headers.get("x-upstream")).toBe("yes");
    expect(result.headers.getSetCookie()).toEqual(["collie=kept; Path=/"]);
  });

  test("only update-safe PWA assets are public", () => {
    expect(publicCollieAsset("/sw.js")).toBeTrue();
    expect(publicCollieAsset("/assets/app.js")).toBeTrue();
    expect(publicCollieAsset("/")).toBeFalse();
    expect(publicCollieAsset("/api/snapshot")).toBeFalse();
    expect(publicCollieAsset("/pane/p1")).toBeFalse();
  });
});
