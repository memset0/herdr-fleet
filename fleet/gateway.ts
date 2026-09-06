import { isIP } from "node:net";
import { randomBytes } from "node:crypto";

import type { JsonValue } from "../bridge/json.ts";
import {
  SESSION_COOKIE_NAME,
  attemptLogin,
  clearSessionCookie,
  cookieValue,
  createSessionToken,
  readLoginForm,
  safeReturnPath,
  sameOriginPost,
  sessionCookie,
  validLoginCsrfToken,
  verifySessionToken,
  type SessionClaims,
} from "./auth.ts";
import type { FleetLeadConfig } from "./config.ts";
import { LOGIN_CSS, loginPage } from "./login-ui.ts";
import { proxyCollie, type FleetFetcher } from "./proxy.ts";
import { LoginRateLimiter } from "./rate-limit.ts";
import type { SessionStore } from "./session-store.ts";
import type { SettingsStore } from "./settings/store.ts";
import { TERMINAL_PATH, admit, type TerminalTarget } from "./terminal/admit.ts";

const HTML_CSP =
  "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

const BASE_HEADERS = {
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(self), geolocation=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} satisfies Readonly<Record<string, string>>;

const PUBLIC_FILES = new Set([
  "/apple-touch-icon.png",
  "/dog-gallop.png",
  "/favicon-96x96.png",
  "/favicon.ico",
  "/favicon.svg",
  "/fonts/ui-aldrich-1.002-latin.woff2",
  "/manifest.webmanifest",
  "/registerSW.js",
  "/sw.js",
  "/theme-init.js",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
]);

/** Fleet's own API surface. One path, so nothing else can grow under it by accident. */
export const FLEET_SETTINGS_PATH = "/fleet/api/settings";

/**
 * Every machine surface answers 401 rather than redirecting: a fetch cannot follow a login page, and
 * neither can a protocol upgrade — a WebSocket handshake that is answered with a redirect fails
 * without ever telling the caller why, which is the one thing an unauthenticated terminal must not do.
 */
function isApiPath(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  return pathname === FLEET_SETTINGS_PATH || pathname === TERMINAL_PATH;
}

/**
 * The only body shape a settings write may have, read once.
 *
 * It answers the two fields rather than narrowing in place, so nothing downstream can reach for a
 * third: the path this route writes to is resolved at startup and is never the client's to name.
 */
function settingsWriteBody(value: JsonValue): { document: string; version: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { document, version } = value;
  if (typeof document !== "string" || typeof version !== "string") return null;
  return { document, version };
}

export interface GatewayContext {
  readonly peerAddress: string;
  /**
   * Completes a protocol upgrade, or reports that it could not be. Supplied by the server rather
   * than reached for, so this handler stays a pure request→response function that a test can drive
   * without a listener — and so that the decision to upgrade is visibly the handler's, taken before
   * the upgrade rather than discovered after it.
   */
  readonly upgrade?: ((request: Request, data: TerminalUpgrade) => boolean) | undefined;
}

/** What the server attaches to an upgraded connection: the Pane it is for, and who asked. */
export interface TerminalUpgrade {
  readonly target: TerminalTarget;
  /** The session behind the connection, so the socket can be closed when that session ends. */
  readonly session: SessionClaims;
}

export interface GatewayOptions {
  readonly config: FleetLeadConfig;
  readonly sessions: SessionStore;
  /**
   * Fleet's own settings document. Absent leaves the route 404 — the same posture every other
   * capability this Gateway does not have takes, rather than a half-answered endpoint.
   */
  readonly settings?: SettingsStore;
  readonly limiter?: LoginRateLimiter;
  readonly fetcher?: FleetFetcher;
  readonly now?: () => number;
  /**
   * Told when a session is deliberately ended, so anything holding one can let go immediately rather
   * than waiting for a sweep. A logout is the operator saying "not from this browser any more", and a
   * terminal that survived it by a minute would be the one thing that did not hear them.
   */
  readonly onSessionRevoked?: ((sessionId: string) => void) | undefined;
  readonly loginCsrfToken?: string;
}

function withBaseHeaders(response: Response, cache: "no-store" | "public" = "no-store"): Response {
  for (const [name, value] of Object.entries(BASE_HEADERS)) response.headers.set(name, value);
  if (cache === "no-store") response.headers.set("cache-control", "no-store");
  return response;
}

function text(body: string, status: number, headers: HeadersInit = {}): Response {
  return withBaseHeaders(
    new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } }),
  );
}

function json(body: JsonValue, status: number, headers: HeadersInit = {}): Response {
  return withBaseHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", ...headers },
    }),
  );
}

function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  const response = withBaseHeaders(
    new Response(body, {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": HTML_CSP, ...headers },
    }),
  );
  response.headers.set("referrer-policy", "same-origin");
  return response;
}

function redirect(location: string, headers: HeadersInit = {}): Response {
  return withBaseHeaders(new Response(null, { status: 303, headers: { location, ...headers } }));
}

function publicAsset(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname)) return true;
  return /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pathname) && !pathname.endsWith(".map");
}

function loopback(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address.startsWith("::ffff:127.");
}

function safeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export function trustedClientSource(request: Request, context: GatewayContext, config: FleetLeadConfig): string {
  if (!loopback(context.peerAddress)) return context.peerAddress || "non-loopback";
  const supplied = request.headers.get(config.proxy.clientIpHeader)?.trim() ?? "";
  if (supplied === "" || supplied.includes(",") || isIP(supplied) === 0) return "loopback";
  return supplied;
}

async function currentSession(
  request: Request,
  config: FleetLeadConfig,
  sessions: SessionStore,
  now: number,
): Promise<SessionClaims | null> {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (token === null) return null;
  const claims = verifySessionToken(token, config, now);
  if (claims === null || !(await sessions.active(claims, now))) return null;
  return claims;
}

export function createGatewayHandler(options: GatewayOptions) {
  const { config, sessions, settings } = options;
  const limiter = options.limiter ?? new LoginRateLimiter(config.auth.rateLimit);
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const loginCsrfToken = options.loginCsrfToken ?? randomBytes(32).toString("base64url");
  if (!/^[A-Za-z0-9_-]{43}$/.test(loginCsrfToken)) throw new Error("login CSRF token source returned an invalid token");
  const renderLogin = (returnPath: string, message = "") => loginPage(returnPath, loginCsrfToken, message);

  return async (request: Request, context: GatewayContext): Promise<Response> => {
    const url = new URL(request.url);
    const host = request.headers.get("host")?.toLowerCase() ?? "";
    if (host !== config.public.host) return text("not found\n", 404);
    if (!loopback(context.peerAddress)) return text("forbidden\n", 403);

    if (url.pathname === "/auth/app.css" && request.method === "GET") {
      return withBaseHeaders(
        new Response(LOGIN_CSS, {
          headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" },
        }),
        "public",
      );
    }

    if (publicAsset(url.pathname) && request.method === "GET") {
      try {
        return withBaseHeaders(await proxyCollie(request, config, fetcher), "public");
      } catch {
        return text("upstream unavailable\n", 502);
      }
    }

    let session: SessionClaims | null;
    try {
      session = await currentSession(request, config, sessions, now());
    } catch {
      return text("authentication state unavailable\n", 503);
    }

    if (url.pathname === "/auth/login" && request.method === "GET") {
      const next = safeReturnPath(url.searchParams.get("next"));
      return session === null ? html(renderLogin(next)) : redirect(next);
    }

    if (url.pathname === "/auth/login" && request.method === "POST") {
      const sameOrigin = sameOriginPost(request, config.public.origin);
      const input = await readLoginForm(request);
      if (input === null) return sameOrigin ? html(renderLogin("/", "Invalid request."), 400) : text("forbidden\n", 403);
      if (!sameOrigin && !validLoginCsrfToken(input.csrfToken, loginCsrfToken)) return text("forbidden\n", 403);
      const attempted = await attemptLogin(
        input,
        trustedClientSource(request, context, config),
        config,
        limiter,
        undefined,
        now(),
      );
      if (!attempted.accepted) {
        if (attempted.retryAfterSeconds > 0) {
          return html(renderLogin("/", "Too many attempts. Try again later."), 429, {
            "retry-after": String(attempted.retryAfterSeconds),
          });
        }
        return html(renderLogin(input.returnPath, "Invalid username or password."), 401);
      }
      const created = createSessionToken(config, now());
      try {
        await sessions.create(created, created.issuedAt);
      } catch {
        return text("authentication state unavailable\n", 503);
      }
      return redirect(input.returnPath, { "set-cookie": sessionCookie(config, created.token) });
    }

    if (url.pathname === "/auth/logout") {
      if (!sameOriginPost(request, config.public.origin)) return text("forbidden\n", 403);
      try {
        if (session !== null) {
          await sessions.revoke(session.sessionId, now());
          options.onSessionRevoked?.(session.sessionId);
        }
      } catch {
        return text("authentication state unavailable\n", 503);
      }
      return redirect("/auth/login", { "set-cookie": clearSessionCookie() });
    }
    if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return text("not found\n", 404);
    if (url.pathname.startsWith("/pack/")) return text("not found\n", 404);

    if (session === null) {
      if (isApiPath(url.pathname)) {
        return json({ error: "authentication required" }, 401);
      }
      const login = new URL("/auth/login", config.public.origin);
      login.searchParams.set("next", safeReturnPath(`${url.pathname}${url.search}`));
      return redirect(`${login.pathname}${login.search}`);
    }

    if (!safeMethod(request.method) && request.headers.get("origin") !== config.public.origin) {
      return text("forbidden\n", 403);
    }

    // FLEET'S OWN SURFACE, above the proxy and below the session gate. It is served here rather than
    // added to Collie's config endpoint because these settings are not Collie's: nothing under
    // bridge/ knows this document exists, and this Gateway already owns an authenticated surface.
    if (url.pathname === FLEET_SETTINGS_PATH) {
      if (settings === undefined) return json({ error: "not found" }, 404);
      if (request.method === "GET") {
        const snapshot = await settings.read();
        return json(
          { version: snapshot.version, document: snapshot.text, risky: [...snapshot.settings.risky] },
          200,
        );
      }
      if (request.method === "PUT") {
        // The path is this Gateway's own, resolved at startup. A body naming a file would be a
        // second, client-supplied answer to where settings live, so none is accepted.
        let body: JsonValue;
        try {
          // SAFETY: `Request.json()` answers with exactly a JsonValue by construction; the guard
          // below is what turns it into the two fields this route accepts.
          body = (await request.json()) as JsonValue;
        } catch {
          return json({ error: "invalid request" }, 400);
        }
        const write = settingsWriteBody(body);
        if (write === null) return json({ error: "invalid request" }, 400);
        const result = await settings.write(write.document, write.version);
        if (result.ok) {
          return json({ version: result.snapshot.version, document: result.snapshot.text, risky: [...result.snapshot.settings.risky] }, 200);
        }
        if (result.reason === "conflict") {
          return json(
            { error: "conflict", version: result.snapshot.version, document: result.snapshot.text },
            409,
          );
        }
        return json({ error: "invalid", at: result.rejection.at, message: result.rejection.message }, 422);
      }
      return json({ error: "method not allowed" }, 405);
    }

    // THE TERMINAL BOUNDARY. Above the proxy for a mechanical reason as well as a logical one:
    // `proxyCollie` strips `upgrade` as a hop-by-hop header, so a terminal request that reached it
    // would arrive at Collie as an ordinary GET and be answered as one. It is also the only route
    // here that does not produce a response at all when it succeeds.
    if (url.pathname === TERMINAL_PATH) {
      const decision = admit(
        {
          url,
          host,
          origin: request.headers.get("origin"),
          // Re-stated rather than assumed from the gate above, because this is the one branch whose
          // refusal has to be certain BEFORE anything is handed to the socket layer.
          authenticated: session !== null,
        },
        { publicHost: config.public.host, publicOrigin: config.public.origin },
      );
      // Every refusal answers identically. The reason is the operator's, through diagnostics; a
      // caller learns only that it did not get a terminal, so "no such Pane" and "not signed in"
      // are indistinguishable from outside.
      if (!decision.ok) return text("terminal unavailable\n", 400);
      if (context.upgrade === undefined) return text("terminal unavailable\n", 400);
      const upgraded = context.upgrade(request, { target: decision.target, session: session! });
      // `upgrade` answers the request itself when it succeeds; there is no response to return.
      return upgraded ? new Response(null, { status: 101 }) : text("terminal unavailable\n", 400);
    }

    try {
      return withBaseHeaders(await proxyCollie(request, config, fetcher));
    } catch {
      return isApiPath(url.pathname)
        ? json({ error: "upstream unavailable" }, 502)
        : text("upstream unavailable\n", 502);
    }
  };
}
