import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { jsonNumberField, jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonValue } from "../bridge/json.ts";
import type { SessionClaims } from "./auth.ts";

export const SESSION_STATE_VERSION = 1;
export const MAX_ACTIVE_SESSIONS = 64;
const TOUCH_INTERVAL_MS = 60_000;

interface SessionRecord {
  readonly digest: string;
  readonly issuedAt: number;
  readonly lastSeenAt: number;
  readonly expiresAt: number;
}

interface SessionState {
  readonly version: 1;
  readonly sessions: readonly SessionRecord[];
}

function digest(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

function parseRecord(value: JsonValue | undefined): SessionRecord | null {
  const record = jsonRecord(value);
  if (record === null || Object.keys(record).some((key) => !["digest", "issuedAt", "lastSeenAt", "expiresAt"].includes(key))) {
    return null;
  }
  const idDigest = jsonStringField(record.digest);
  const issuedAt = jsonNumberField(record.issuedAt);
  const lastSeenAt = jsonNumberField(record.lastSeenAt);
  const expiresAt = jsonNumberField(record.expiresAt);
  if (
    idDigest === null ||
    !/^[0-9a-f]{64}$/.test(idDigest) ||
    issuedAt === null ||
    lastSeenAt === null ||
    expiresAt === null ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(lastSeenAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt > lastSeenAt ||
    lastSeenAt > expiresAt
  ) {
    return null;
  }
  return { digest: idDigest, issuedAt, lastSeenAt, expiresAt };
}

export function parseSessionState(source: string): SessionState | null {
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns a recursively JSON-shaped value; every state field is narrowed
    // below before it becomes an active session record.
    parsed = JSON.parse(source) as JsonValue;
  } catch {
    return null;
  }
  const root = jsonRecord(parsed);
  if (
    root === null ||
    root.version !== SESSION_STATE_VERSION ||
    !Array.isArray(root.sessions) ||
    Object.keys(root).some((key) => key !== "version" && key !== "sessions")
  ) {
    return null;
  }
  const sessions: SessionRecord[] = [];
  for (const value of root.sessions) {
    const record = parseRecord(value);
    if (record === null) return null;
    sessions.push(record);
  }
  if (sessions.length > MAX_ACTIVE_SESSIONS) return null;
  return { version: SESSION_STATE_VERSION, sessions };
}

function emptyState(): SessionState {
  return { version: SESSION_STATE_VERSION, sessions: [] };
}

export class SessionStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  private locked<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async read(): Promise<SessionState> {
    let info;
    try {
      info = await stat(this.path);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyState();
      throw new Error("session state is unavailable", { cause: error });
    }
    if (!info.isFile()) throw new Error("session state must be a regular file");
    if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
      throw new Error("session state must not be accessible by group or other users");
    }
    const parsed = parseSessionState(await readFile(this.path, "utf8"));
    if (parsed === null) throw new Error("session state is unreadable");
    return parsed;
  }

  private async write(state: SessionState): Promise<void> {
    const parent = dirname(this.path);
    await mkdir(parent, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await chmod(parent, 0o700);
    const temporary = `${this.path}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
    try {
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporary, this.path);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async create(claims: SessionClaims, now: number = Date.now()): Promise<void> {
    return this.locked(async () => {
      const state = await this.read();
      const current = state.sessions.filter((record) => record.expiresAt > now && record.digest !== digest(claims.sessionId));
      const next: SessionRecord = {
        digest: digest(claims.sessionId),
        issuedAt: claims.issuedAt,
        lastSeenAt: claims.issuedAt,
        expiresAt: claims.expiresAt,
      };
      await this.write({ version: SESSION_STATE_VERSION, sessions: [...current, next].slice(-MAX_ACTIVE_SESSIONS) });
    });
  }

  async active(claims: SessionClaims, now: number = Date.now()): Promise<boolean> {
    return this.locked(async () => {
      const state = await this.read();
      const live = state.sessions.filter((record) => record.expiresAt > now);
      const wanted = digest(claims.sessionId);
      const match = live.find(
        (record) =>
          record.digest === wanted && record.issuedAt === claims.issuedAt && record.expiresAt === claims.expiresAt,
      );
      if (match === undefined) {
        if (live.length !== state.sessions.length) {
          await this.write({ version: SESSION_STATE_VERSION, sessions: live });
        }
        return false;
      }
      if (now - match.lastSeenAt >= TOUCH_INTERVAL_MS) {
        const touched = live.map((record) =>
          record === match ? Object.assign({}, record, { lastSeenAt: now }) : record,
        );
        await this.write({ version: SESSION_STATE_VERSION, sessions: touched });
      }
      return true;
    });
  }

  async revoke(sessionId: string, now: number = Date.now()): Promise<boolean> {
    return this.locked(async () => {
      const state = await this.read();
      const wanted = digest(sessionId);
      const remaining = state.sessions.filter((record) => record.digest !== wanted && record.expiresAt > now);
      const removed = remaining.length !== state.sessions.filter((record) => record.expiresAt > now).length;
      if (removed || remaining.length !== state.sessions.length) {
        await this.write({ version: SESSION_STATE_VERSION, sessions: remaining });
      }
      return removed;
    });
  }
}
