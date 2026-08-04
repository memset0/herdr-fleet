import { createHmac, timingSafeEqual } from "node:crypto";

import type { GatewayConfig } from "./config.ts";

interface SessionPayload {
  username: string;
  issuedAt: number;
  expiresAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", Buffer.from(secret, "base64url")).update(payload).digest("base64url");
}

export function createSessionToken(
  config: GatewayConfig,
  now = Date.now(),
): string {
  const payload: SessionPayload = {
    username: config.auth.username,
    issuedAt: now,
    expiresAt: now + config.public.sessionTtlSeconds * 1_000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, config.auth.sessionSecret)}`;
}

export function verifySessionToken(token: string, config: GatewayConfig, now = Date.now()): boolean {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return false;
  const expectedSignature = sign(encoded, config.auth.sessionSecret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return (
      payload.username === config.auth.username &&
      Number.isSafeInteger(payload.issuedAt) &&
      Number.isSafeInteger(payload.expiresAt) &&
      payload.issuedAt <= now + 60_000 &&
      payload.expiresAt > now
    );
  } catch {
    return false;
  }
}

export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function hasSession(request: Request, config: GatewayConfig, now = Date.now()): boolean {
  const token = cookieValue(request.headers.get("cookie"), config.public.cookieName);
  return token ? verifySessionToken(token, config, now) : false;
}

export function sessionCookie(config: GatewayConfig, token: string): string {
  return `${config.public.cookieName}=${token}; Domain=.${config.public.baseDomain}; Path=/; Max-Age=${config.public.sessionTtlSeconds}; Secure; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(config: GatewayConfig): string {
  return `${config.public.cookieName}=; Domain=.${config.public.baseDomain}; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

export async function verifyCredentials(
  username: string,
  password: string,
  config: GatewayConfig,
): Promise<boolean> {
  const passwordMatches = await Bun.password.verify(password, config.auth.passwordHash);
  const supplied = Buffer.from(username);
  const expected = Buffer.from(config.auth.username);
  const usernameMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  return usernameMatches && passwordMatches;
}

export function safeReturnUrl(candidate: string | null, config: GatewayConfig): string {
  const fallback = `${config.public.scheme}://${config.public.fleetHost}/`;
  if (!candidate) return fallback;
  try {
    const url = candidate.startsWith("/") ? new URL(candidate, fallback) : new URL(candidate);
    const hosts = new Set([config.public.fleetHost, ...config.nodes.map((node) => node.publicHost)]);
    if (url.protocol !== `${config.public.scheme}:` || !hosts.has(url.hostname.toLowerCase())) return fallback;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return fallback;
  }
}

interface RateEntry {
  failures: number[];
  blockedUntil: number;
}

export class LoginRateLimiter {
  private readonly entries = new Map<string, RateEntry>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 10 * 60_000,
    private readonly blockMs = 15 * 60_000,
    private readonly maxEntries = 10_000,
  ) {}

  allowed(key: string, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return true;
    if (entry.blockedUntil > now) return false;
    entry.failures = entry.failures.filter((time) => now - time <= this.windowMs);
    if (entry.failures.length === 0) this.entries.delete(key);
    return true;
  }

  failure(key: string, now = Date.now()): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    const entry = this.entries.get(key) ?? { failures: [], blockedUntil: 0 };
    entry.failures = entry.failures.filter((time) => now - time <= this.windowMs);
    entry.failures.push(now);
    if (entry.failures.length >= this.maxFailures) entry.blockedUntil = now + this.blockMs;
    this.entries.set(key, entry);
  }

  success(key: string): void {
    this.entries.delete(key);
  }
}
