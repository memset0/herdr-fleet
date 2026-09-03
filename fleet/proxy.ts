import type { FleetConfig } from "./config.ts";
import { SESSION_COOKIE_NAME } from "./auth.ts";

const REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "cache-control",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "range",
] as const;

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
] as const;

export function stripCookie(header: string | null, name: string): string | null {
  if (header === null) return null;
  const retained = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (part === "") return false;
      const split = part.indexOf("=");
      return part.slice(0, split < 0 ? part.length : split).trim() !== name;
    });
  return retained.length === 0 ? null : retained.join("; ");
}

function stripResponseCookie(headers: Headers, name: string): void {
  const cookies = headers.getSetCookie();
  if (cookies.length === 0) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const split = cookie.indexOf("=");
    const cookieName = cookie.slice(0, split < 0 ? cookie.length : split).trim();
    if (cookieName !== name) headers.append("set-cookie", cookie);
  }
}

export function upstreamRequestHeaders(request: Request, config: FleetConfig): Headers {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const cookie = stripCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (cookie !== null) headers.set("cookie", cookie);
  headers.set("accept-encoding", "identity");
  headers.set("host", config.public.host);
  headers.set("x-forwarded-host", config.public.host);
  headers.set("x-forwarded-proto", "https");
  const origin = request.headers.get("origin");
  if (origin === config.public.origin) headers.set("origin", config.public.origin);
  return headers;
}

function upstreamUrl(request: Request, config: FleetConfig): URL {
  const incoming = new URL(request.url);
  const base = new URL(`http://${config.collie.host.includes(":") ? `[${config.collie.host}]` : config.collie.host}:${config.collie.port}/`);
  const target = new URL(`${incoming.pathname}${incoming.search}`, base);
  if (target.origin !== base.origin) throw new Error("proxy target escaped the configured Collie origin");
  return target;
}

function publicLocation(location: string, upstream: URL, config: FleetConfig): string | null {
  let parsed: URL;
  try {
    parsed = new URL(location, upstream);
  } catch {
    return null;
  }
  if (parsed.origin !== upstream.origin) return null;
  return `${config.public.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export type FleetFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function proxyCollie(
  request: Request,
  config: FleetConfig,
  fetcher: FleetFetcher = fetch,
): Promise<Response> {
  const target = upstreamUrl(request, config);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  const upstream = await fetcher(target, {
    method: request.method,
    headers: upstreamRequestHeaders(request, config),
    body,
    redirect: "manual",
  });
  const headers = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  stripResponseCookie(headers, SESSION_COOKIE_NAME);
  headers.delete("content-encoding");
  headers.delete("content-length");
  const location = headers.get("location");
  if (location !== null) {
    const rewritten = publicLocation(location, target, config);
    if (rewritten === null) {
      return new Response("upstream redirect refused\n", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    headers.set("location", rewritten);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
