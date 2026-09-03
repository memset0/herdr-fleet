import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { createSessionToken } from "./auth.ts";
import { SessionStore } from "./session-store.ts";
import { fleetTestConfig } from "./test-helpers.ts";

describe("active Fleet sessions", () => {
  test("survives restart, stores only a digest, and revokes a copied token", async () => {
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-sessions-"));
    const path = join(root, "sessions.json");
    const claims = createSessionToken(fleetTestConfig(), 1_000, () => "B".repeat(43));
    await new SessionStore(path).create(claims, 1_000);
    expect(await new SessionStore(path).active(claims, 2_000)).toBeTrue();
    expect(await readFile(path, "utf8")).not.toContain(claims.sessionId);
    expect(await new SessionStore(path).revoke(claims.sessionId, 2_000)).toBeTrue();
    expect(await new SessionStore(path).active(claims, 2_001)).toBeFalse();
  });

  test("prunes expiry and fails closed on corrupt or broad state", async () => {
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-sessions-"));
    const path = join(root, "sessions.json");
    const config = fleetTestConfig();
    const expired = createSessionToken(config, 1_000, () => "C".repeat(43));
    await new SessionStore(path).create(expired, 1_000);
    expect(await new SessionStore(path).active(expired, expired.expiresAt)).toBeFalse();

    await writeFile(path, "{broken", { mode: 0o600 });
    await expect(new SessionStore(path).active(expired, 2_000)).rejects.toThrow("unreadable");
    await writeFile(path, '{"version":1,"sessions":[]}\n', { mode: 0o600 });
    await chmod(path, 0o644);
    await expect(new SessionStore(path).active(expired, 2_000)).rejects.toThrow("group or other");
  });
});
