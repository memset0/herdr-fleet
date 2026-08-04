import type { GatewayConfig, NodeConfig } from "./config.ts";

const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

export function stripCookie(cookie: string | null, name: string): string | null {
  if (!cookie) return null;
  const retained = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && part.slice(0, part.indexOf("=") < 0 ? part.length : part.indexOf("=")) !== name);
  return retained.length ? retained.join("; ") : null;
}

export function publicCollieAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    [
      "/sw.js",
      "/manifest.webmanifest",
      "/registerSW.js",
      "/favicon.ico",
      "/favicon.svg",
      "/favicon-96x96.png",
      "/apple-touch-icon.png",
      "/web-app-manifest-192x192.png",
      "/web-app-manifest-512x512.png",
      "/theme-init.js",
      "/dog-gallop.png",
    ].includes(pathname)
  );
}

export async function proxyCollie(
  request: Request,
  node: NodeConfig,
  upstream: string,
  config: GatewayConfig,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, `${upstream}/`);
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  headers.delete("authorization");
  const remainingCookie = stripCookie(headers.get("cookie"), config.public.cookieName);
  if (remainingCookie) headers.set("cookie", remainingCookie);
  else headers.delete("cookie");
  headers.set("host", node.publicHost);
  headers.set("x-forwarded-host", node.publicHost);
  headers.set("x-forwarded-proto", config.public.scheme);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetcher(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
  const responseHeaders = new Headers(response.headers);
  for (const name of HOP_BY_HOP) responseHeaders.delete(name);
  const location = responseHeaders.get("location");
  if (location?.startsWith(upstream)) {
    responseHeaders.set("location", `${config.public.scheme}://${node.publicHost}${location.slice(upstream.length)}`);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
