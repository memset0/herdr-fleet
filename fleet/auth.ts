import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { jsonNumberField, jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonValue } from "../bridge/json.ts";
import type { FleetConfig } from "./config.ts";
import type { LoginRateLimiter } from "./rate-limit.ts";

export const SESSION_COOKIE_NAME = "__Host-herdr_fleet_session";
export const LOGIN_FORM_LIMIT = 16_384;
export const USERNAME_LIMIT = 64;
export const PASSWORD_LIMIT = 512;
export const RETURN_PATH_LIMIT = 4_096;
const SESSION_VERSION = 1;
const CLOCK_SKEW_MS = 60_000;

export interface SessionClaims {
  readonly version: 1;
  readonly sessionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface CreatedSession extends SessionClaims {
  readonly token: string;
}

export interface LoginInput {
  readonly username: string;
  readonly password: string;
  readonly returnPath: string;
}

export type SessionIdSource = () => string;

const randomSessionId: SessionIdSource = () => randomBytes(32).toString("base64url");

function signature(encoded: string, secret: string): Buffer {
  return createHmac("sha256", Buffer.from(secret, "base64url")).update(encoded).digest();
}

export function createSessionToken(
  config: FleetConfig,
  now: number = Date.now(),
  sessionIdSource: SessionIdSource = randomSessionId,
): CreatedSession {
  const claims: SessionClaims = {
    version: SESSION_VERSION,
    sessionId: sessionIdSource(),
    issuedAt: now,
    expiresAt: now + config.auth.sessionTtlSeconds * 1_000,
  };
  if (!/^[A-Za-z0-9_-]{43}$/.test(claims.sessionId)) {
    throw new Error("session id source returned an invalid identifier");
  }
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const token = `${encoded}.${signature(encoded, config.auth.sessionSecret).toString("base64url")}`;
  return { ...claims, token };
}

function parseClaims(encoded: string): SessionClaims | null {
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns a recursively JSON-shaped value; the field readers below narrow
    // every property before it becomes a session claim.
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as JsonValue;
  } catch {
    return null;
  }
  const value = jsonRecord(parsed);
  if (value === null || Object.keys(value).some((key) => !["version", "sessionId", "issuedAt", "expiresAt"].includes(key))) {
    return null;
  }
  const sessionId = jsonStringField(value.sessionId);
  const issuedAt = jsonNumberField(value.issuedAt);
  const expiresAt = jsonNumberField(value.expiresAt);
  if (
    value.version !== SESSION_VERSION ||
    sessionId === null ||
    !/^[A-Za-z0-9_-]{43}$/.test(sessionId) ||
    issuedAt === null ||
    expiresAt === null ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return null;
  }
  return { version: SESSION_VERSION, sessionId, issuedAt, expiresAt };
}

export function verifySessionToken(token: string, config: FleetConfig, now: number = Date.now()): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const encoded = parts[0] ?? "";
  const suppliedText = parts[1] ?? "";
  if (encoded === "" || !/^[A-Za-z0-9_-]{43}$/.test(suppliedText)) return null;
  const supplied = Buffer.from(suppliedText, "base64url");
  const expected = signature(encoded, config.auth.sessionSecret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const claims = parseClaims(encoded);
  if (claims === null) return null;
  const expectedLifetime = config.auth.sessionTtlSeconds * 1_000;
  if (
    claims.issuedAt > now + CLOCK_SKEW_MS ||
    claims.expiresAt <= now ||
    claims.expiresAt <= claims.issuedAt ||
    claims.expiresAt - claims.issuedAt !== expectedLifetime
  ) {
    return null;
  }
  return claims;
}

export function cookieValue(header: string | null, name: string): string | null {
  if (header === null) return null;
  let found: string | null = null;
  for (const part of header.split(";")) {
    const split = part.indexOf("=");
    if (split < 0) continue;
    if (part.slice(0, split).trim() !== name) continue;
    if (found !== null) return null;
    found = part.slice(split + 1).trim();
  }
  return found;
}

export function sessionCookie(config: FleetConfig, token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${config.auth.sessionTtlSeconds}; Secure; HttpOnly; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}

export async function verifyCredentials(input: Pick<LoginInput, "username" | "password">, config: FleetConfig) {
  const passwordMatches = await Bun.password.verify(input.password, config.auth.passwordHash);
  const supplied = Buffer.from(input.username);
  const expected = Buffer.from(config.auth.username);
  const usernameMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  return passwordMatches && usernameMatches;
}

export interface LoginAttempt {
  readonly accepted: boolean;
  readonly retryAfterSeconds: number;
}

export type CredentialVerifier = (
  input: Pick<LoginInput, "username" | "password">,
  config: FleetConfig,
) => Promise<boolean>;

export async function attemptLogin(
  input: LoginInput,
  source: string,
  config: FleetConfig,
  limiter: LoginRateLimiter,
  verifier: CredentialVerifier = verifyCredentials,
  now: number = Date.now(),
): Promise<LoginAttempt> {
  const allowed = limiter.allowed(source, now);
  if (!allowed.allowed) return { accepted: false, retryAfterSeconds: allowed.retryAfterSeconds };
  if (await verifier(input, config)) {
    limiter.success(source);
    return { accepted: true, retryAfterSeconds: 0 };
  }
  limiter.failure(source, now);
  return { accepted: false, retryAfterSeconds: 0 };
}

function hasControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function safeReturnPath(candidate: string | null): string {
  if (candidate === null || candidate === "") return "/";
  if (candidate.length > RETURN_PATH_LIMIT || !candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  if (candidate.includes("\\") || hasControl(candidate)) return "/";
  let decoded = candidate;
  try {
    for (let count = 0; count < 3; count += 1) decoded = decodeURIComponent(decoded);
  } catch {
    return "/";
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || hasControl(decoded)) return "/";
  const base = new URL("https://fleet.invalid/");
  let parsed: URL;
  try {
    parsed = new URL(candidate, base);
  } catch {
    return "/";
  }
  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (parsed.origin !== base.origin || normalized.startsWith("//") || normalized.includes("\\") || hasControl(normalized)) {
    return "/";
  }
  return normalized;
}

export function sameOriginPost(request: Request, publicOrigin: string): boolean {
  if (request.method !== "POST") return false;
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === publicOrigin;
  const referer = request.headers.get("referer");
  if (referer === null) return false;
  try {
    return new URL(referer).origin === publicOrigin;
  } catch {
    return false;
  }
}

export async function readLoginForm(request: Request): Promise<LoginInput | null> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return null;
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > LOGIN_FORM_LIMIT) return null;
  }
  const body = request.body;
  if (body === null) return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const pieces: string[] = [];
  let received = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    received += next.value.byteLength;
    if (received > LOGIN_FORM_LIMIT) {
      await reader.cancel();
      return null;
    }
    pieces.push(decoder.decode(next.value, { stream: true }));
  }
  pieces.push(decoder.decode());
  const text = pieces.join("");
  if (text.length > LOGIN_FORM_LIMIT) return null;
  const form = new URLSearchParams(text);
  const username = form.get("username") ?? "";
  const password = form.get("password") ?? "";
  const next = form.get("next");
  if (username.length === 0 || username.length > USERNAME_LIMIT || password.length === 0 || password.length > PASSWORD_LIMIT) {
    return null;
  }
  if (next !== null && next.length > RETURN_PATH_LIMIT) return null;
  return { username, password, returnPath: safeReturnPath(next) };
}
