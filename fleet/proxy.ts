import type { FleetLeadConfig } from "./config.ts";
import { SESSION_COOKIE_NAME } from "./auth.ts";
import { FLEET_WEBFONTS } from "./ui/webfonts.ts";

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
  // Collie's own seen signal (bridge/server.ts `marksPaneSeen`): no credential and no identity, only
  // the page saying a pane read is the operator looking at it. A cross-site request cannot set it
  // here any more than at Collie, so forwarding it keeps Collie's same-origin proof intact.
  "x-collie-seen",
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

/**
 * The headers Collie receives: an allowlist of the browser's, never its `authorization`, plus what
 * the Gateway states itself. `collieToken` is the Gateway's own pairing credential (fleet/collie-
 * pairing.ts): since Collie 1.18 every `/api/*` read and write needs a paired device's bearer token
 * (ADR 0086), the Gateway is that device, and the browser behind it holds none of its own.
 */
export function upstreamRequestHeaders(request: Request, config: FleetLeadConfig, collieToken?: string): Headers {
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
  if (collieToken !== undefined) headers.set("authorization", `Bearer ${collieToken}`);
  return headers;
}

function upstreamUrl(request: Request, config: FleetLeadConfig): URL {
  const incoming = new URL(request.url);
  const base = new URL(`http://${config.collie.host.includes(":") ? `[${config.collie.host}]` : config.collie.host}:${config.collie.port}/`);
  const target = new URL(`${incoming.pathname}${incoming.search}`, base);
  if (target.origin !== base.origin) throw new Error("proxy target escaped the configured Collie origin");
  return target;
}

function publicLocation(location: string, upstream: URL, config: FleetLeadConfig): string | null {
  let parsed: URL;
  try {
    parsed = new URL(location, upstream);
  } catch {
    return null;
  }
  if (parsed.origin !== upstream.origin) return null;
  return `${config.public.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * THE FETCHED FONT'S ORIGIN, admitted for stylesheets and fonts and for nothing else.
 *
 * Fleet's CJK fallback is fetched rather than shipped (fleet/ui/webfonts.ts says why), so the
 * document loads one third-party stylesheet and the `unicode-range` chunks it names. Collie's own
 * policy admits neither, and the Gateway is the one place every document passes on its way to a
 * browser, so the origin is added here rather than written into Collie's source. It is derived from
 * the catalog, so it is spelled once.
 *
 * WHAT IS NOT RELAXED, and this is the point: `script-src`, `connect-src`, frames and `base-uri` are
 * untouched, so the origin can serve no code and the page can open no channel to it. Only an HTML
 * document's policy is widened, and never a sandboxed one: Collie answers a file it previews with a
 * `sandbox` policy, and that response has no use for a font.
 */
const FONT_ORIGINS: readonly string[] = [...new Set(FLEET_WEBFONTS.map((face) => new URL(face.href).origin))];

export function widenFontPolicy(policy: string, origins: readonly string[] = FONT_ORIGINS): string {
  const directives = policy
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive !== "");
  const tokens = directives.map((directive) => directive.split(/\s+/u));
  if (tokens.some(([name]) => name?.toLowerCase() === "sandbox")) return policy;
  const fallback = tokens.find(([name]) => name?.toLowerCase() === "default-src")?.slice(1) ?? ["'self'"];
  const base = fallback.filter((source) => source !== "'none'");
  const widened = new Set<string>();
  const out = tokens.map(([name = "", ...sources]) => {
    const lower = name.toLowerCase();
    if (lower !== "style-src" && lower !== "font-src") return [name, ...sources].join(" ");
    widened.add(lower);
    const kept = sources.filter((source) => source !== "'none'");
    return [name, ...kept, ...origins.filter((origin) => !kept.includes(origin))].join(" ");
  });
  // An absent directive inherits `default-src`; spelling it out keeps that inheritance and adds the
  // origin to it alone.
  for (const name of ["style-src", "font-src"]) {
    if (!widened.has(name)) out.push([name, ...base, ...origins.filter((origin) => !base.includes(origin))].join(" "));
  }
  return out.join("; ");
}

export type FleetFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function proxyCollie(
  request: Request,
  config: FleetLeadConfig,
  fetcher: FleetFetcher = fetch,
  collieToken?: string,
): Promise<Response> {
  const target = upstreamUrl(request, config);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  const upstream = await fetcher(target, {
    method: request.method,
    headers: upstreamRequestHeaders(request, config, collieToken),
    body,
    redirect: "manual",
  });
  const headers = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  stripResponseCookie(headers, SESSION_COOKIE_NAME);
  headers.delete("content-encoding");
  headers.delete("content-length");
  const policy = headers.get("content-security-policy");
  if (policy !== null && (headers.get("content-type") ?? "").toLowerCase().startsWith("text/html")) {
    headers.set("content-security-policy", widenFontPolicy(policy));
  }
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
