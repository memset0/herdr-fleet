import {
  clearSessionCookie,
  createSessionToken,
  hasSession,
  LoginRateLimiter,
  safeReturnUrl,
  sessionCookie,
  verifyCredentials,
} from "./auth.ts";
import { normalizeHost, type GatewayConfig, type NodeConfig } from "./config.ts";
import type { FleetCollector } from "./fleet.ts";
import { proxyCollie, publicCollieAsset } from "./proxy.ts";
import type { TransportRegistry } from "./transports.ts";
import { APP_CSS, FLEET_CSS, FLEET_JS, fleetPage, loginPage } from "./ui.ts";

const HTML_CSP =
  "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

const BASE_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function response(body: BodyInit | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(BASE_HEADERS)) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

function html(body: string, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("content-security-policy", HTML_CSP);
  headers.set("cache-control", "no-store");
  return response(body, {
    status,
    headers,
  });
}

function json(value: unknown, status = 200): Response {
  return response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirect(location: string, headers: HeadersInit = {}): Response {
  const merged = new Headers(headers);
  merged.set("location", location);
  return response(null, { status: 303, headers: merged });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function requestedUrl(request: Request, config: GatewayConfig, host: string): string {
  const url = new URL(request.url);
  return `${config.public.scheme}://${host}${url.pathname}${url.search}`;
}

function expectedOrigin(config: GatewayConfig, host: string): string {
  return `${config.public.scheme}://${host}`;
}

function sameOriginPost(request: Request, config: GatewayConfig, host: string): boolean {
  if (request.method !== "POST") return false;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin(config, host);
  const referer = request.headers.get("referer");
  return Boolean(referer && referer.startsWith(`${expectedOrigin(config, host)}/`));
}

async function formData(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") throw new Error("unsupported form content type");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 16_384) throw new Error("form is too large");
  const text = await request.text();
  if (text.length > 16_384) throw new Error("form is too large");
  return new URLSearchParams(text);
}

export interface GatewayHandlerOptions {
  config: GatewayConfig;
  collector: FleetCollector;
  transports: TransportRegistry;
  fetcher?: typeof fetch;
  limiter?: LoginRateLimiter;
  now?: () => number;
}

export function createGatewayHandler(options: GatewayHandlerOptions): (request: Request) => Promise<Response> {
  const { config, collector, transports } = options;
  const fetcher = options.fetcher ?? fetch;
  const limiter = options.limiter ?? new LoginRateLimiter();
  const now = options.now ?? Date.now;
  const nodes = new Map<string, NodeConfig>(
    config.nodes.filter((node) => node.enabled).map((node) => [node.publicHost, node]),
  );
  const recognizedHosts = new Set([config.public.fleetHost, ...nodes.keys()]);

  const proxyNode = async (request: Request, node: NodeConfig): Promise<Response> => {
    try {
      const proxied = await proxyCollie(request, node, transports.upstream(node), config, fetcher);
      for (const [name, value] of Object.entries(BASE_HEADERS)) proxied.headers.set(name, value);
      return proxied;
    } catch {
      return request.headers.get("accept")?.includes("application/json") || new URL(request.url).pathname.startsWith("/api/")
        ? json({ error: "node upstream unavailable" }, 502)
        : response("node upstream unavailable\n", { status: 502 });
    }
  };

  return async (request: Request): Promise<Response> => {
    const host = normalizeHost(request.headers.get("host"));
    if (!recognizedHosts.has(host)) return response("not found\n", { status: 404 });
    const url = new URL(request.url);
    const authenticated = hasSession(request, config, now());

    if (url.pathname === "/auth/app.css" && request.method === "GET") {
      return response(APP_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (url.pathname === "/fleet-assets/fleet.css" && request.method === "GET") {
      return response(FLEET_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (url.pathname === "/fleet-assets/fleet.js" && request.method === "GET") {
      return response(FLEET_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (url.pathname === "/auth/login" && request.method === "GET") {
      const next = safeReturnUrl(url.searchParams.get("next"), config);
      return authenticated ? redirect(next) : html(loginPage(next));
    }
    if (url.pathname === "/auth/login" && request.method === "POST") {
      const key = clientKey(request);
      if (!limiter.allowed(key, now())) return html(loginPage(safeReturnUrl(null, config), "Too many attempts. Try again later."), 429);
      try {
        const form = await formData(request);
        const next = safeReturnUrl(form.get("next"), config);
        const valid = await verifyCredentials(form.get("username") ?? "", form.get("password") ?? "", config);
        if (!valid) {
          limiter.failure(key, now());
          return html(loginPage(next, "Invalid username or password."), 401);
        }
        limiter.success(key);
        return redirect(next, { "set-cookie": sessionCookie(config, createSessionToken(config, now())) });
      } catch (error) {
        return html(loginPage(safeReturnUrl(null, config), error instanceof Error ? error.message : "Invalid request."), 400);
      }
    }
    if (url.pathname === "/auth/logout") {
      if (!sameOriginPost(request, config, host)) return response("forbidden\n", { status: 403 });
      return redirect(`${config.public.scheme}://${config.public.fleetHost}/auth/login`, {
        "set-cookie": clearSessionCookie(config),
      });
    }
    if (url.pathname.startsWith("/auth/")) return response("not found\n", { status: 404 });

    const node = nodes.get(host);
    if (node && publicCollieAsset(url.pathname) && request.method === "GET") {
      return proxyNode(request, node);
    }

    if (!authenticated) {
      if (url.pathname.startsWith("/api/")) return json({ error: "authentication required" }, 401);
      const login = new URL(`${config.public.scheme}://${config.public.fleetHost}/auth/login`);
      login.searchParams.set("next", requestedUrl(request, config, host));
      return redirect(login.toString());
    }

    if (host === config.public.fleetHost) {
      if (url.pathname === "/api/fleet" && request.method === "GET") return json(collector.snapshot());
      if (url.pathname === "/" && request.method === "GET") return html(fleetPage());
      return response("not found\n", { status: 404 });
    }

    if (!node) return response("not found\n", { status: 404 });
    return proxyNode(request, node);
  };
}
