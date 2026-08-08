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

export function stripResponseCookie(headers: Headers, name: string): void {
  const cookies = headers.getSetCookie();
  if (!cookies.length) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    const cookieName = cookie.slice(0, separator < 0 ? cookie.length : separator).trim();
    if (cookieName !== name) headers.append("set-cookie", cookie);
  }
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
  // Bun fetch transparently decodes gzip but retains the upstream Content-Encoding header. If the
  // bridge compressed a snapshot, forwarding that mismatched header makes the public proxy try to
  // decode plain JSON a second time and abort the HTTP/2 stream. Keep this hop uncompressed; Caddy
  // may independently encode the final public response if configured to do so.
  headers.set("accept-encoding", "identity");
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
  stripResponseCookie(responseHeaders, config.public.cookieName);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
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
