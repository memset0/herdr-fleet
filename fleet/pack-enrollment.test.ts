import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { material, T0 } from "../bridge/pack/fixtures.ts";
import { enrollPeer, mintInvite, type EnrollResponse } from "../bridge/pack/enrollment.ts";
import { createTrustStore, selfIdentity } from "../bridge/pack/enrollment.ts";
import { TRUST_STORE_FILENAME, TrustStore } from "../bridge/pack/trust-store.ts";
import type { JsonValue } from "../bridge/json.ts";
import { joinPack, mintPeerInvite } from "./pack-enrollment.ts";

/** Identity without a keypair: every test here is about transitions, never about key generation. */
const identity = (label: string) => () => Promise.resolve(material(label));

async function scratch(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "herdr-fleet-enrol-"));
}

function storePath(dir: string): string {
  return join(dir, TRUST_STORE_FILENAME);
}

/** A lead's genuine answer, produced by Collie's own transitions rather than hand-written. */
function leadAnswer(): EnrollResponse {
  const lead = createTrustStore(selfIdentity("lead", material("lead"), T0));
  const invited = mintInvite(lead, { now: T0 });
  const enrolled = enrollPeer(
    invited.next,
    { fingerprint: material("peer").fingerprint, certPem: material("peer").certPem, address: "127.0.0.1:19791", label: "peer" },
    T0,
  );
  if (enrolled === null) throw new Error("the fixture lead could not enrol");
  return enrolled.result;
}

/** The same answer as the JSON a lead would actually send — a literal, so nothing is asserted away. */
function leadAnswerBody(answer: EnrollResponse): JsonValue {
  return {
    protocol: answer.protocol,
    packId: answer.packId,
    packName: answer.packName,
    packSecret: answer.packSecret,
    secretGeneration: answer.secretGeneration,
    memberId: answer.memberId,
    leadMemberId: answer.leadMemberId,
    leadFingerprint: answer.leadFingerprint,
    leadCertPem: answer.leadCertPem,
  };
}

describe("Fleet Pack enrolment", () => {
  test("the first mint creates the store and keeps only the token's hash", async () => {
    const dir = await scratch();
    try {
      const minted = await mintPeerInvite({
        collieStateDir: dir,
        selfId: "lead",
        now: T0,
        identity: identity("lead"),
        label: "peer",
      });
      expect(minted.token).not.toBe("");
      expect(minted.expiresAt).toBeGreaterThan(T0);

      const raw = await readFile(storePath(dir), "utf8");
      expect(raw).not.toContain(minted.token);
      const data = await new TrustStore(dir).load();
      expect(data?.invites).toHaveLength(1);
      expect(data?.self.fingerprint).toBe(material("lead").fingerprint);
      expect(data?.pack).not.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a second mint keeps the identity the first one created", async () => {
    const dir = await scratch();
    try {
      await mintPeerInvite({ collieStateDir: dir, selfId: "lead", now: T0, identity: identity("lead") });
      const first = await new TrustStore(dir).load();
      await mintPeerInvite({
        collieStateDir: dir,
        selfId: "lead",
        now: T0 + 1_000,
        // A second minting would be a second identity; it must never be reached.
        identity: () => Promise.reject(new Error("identity was minted twice")),
      });
      const second = await new TrustStore(dir).load();
      expect(second?.self.memberId).toBe(first?.self.memberId);
      expect(second?.self.fingerprint).toBe(first?.self.fingerprint);
      expect(second?.self.createdAt).toBe(first?.self.createdAt);
      expect(second?.pack?.packId).toBe(first?.pack?.packId);
      expect(second?.invites).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a peer adopts the pack, pins the lead and takes the id the lead minted", async () => {
    const dir = await scratch();
    const answer = leadAnswer();
    try {
      let posted = "";
      const response = await joinPack({
        collieStateDir: dir,
        selfId: "peer",
        leadOrigin: "http://127.0.0.1:19790",
        address: "127.0.0.1:19791",
        token: "an-invite-token",
        now: T0,
        identity: identity("peer"),
        transport: (url, request) => {
          posted = url;
          expect(request.token).toBe("an-invite-token");
          expect(request.address).toBe("127.0.0.1:19791");
          expect(request.fingerprint).toBe(material("peer").fingerprint);
          return Promise.resolve(leadAnswerBody(answer));
        },
      });
      expect(posted).toBe("http://127.0.0.1:19790/pack/v1/enroll");
      expect(response.memberId).toBe(answer.memberId);

      const data = await new TrustStore(dir).load();
      expect(data?.self.memberId).toBe(answer.memberId);
      expect(data?.lead?.memberId).toBe(answer.leadMemberId);
      expect(data?.lead?.fingerprint).toBe(answer.leadFingerprint);
      // A peer's roster is exactly its lead.
      expect(data?.peers).toEqual([]);
      expect(data?.pack?.packId).toBe(answer.packId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a refused invite and an unreachable lead both write nothing", async () => {
    for (const [label, transport] of [
      ["refused", () => Promise.resolve(undefined)],
      ["unusable", () => Promise.resolve({ protocol: 1 })],
      ["unreachable", () => Promise.reject(new Error("connect ECONNREFUSED"))],
    ] as const) {
      const dir = await scratch();
      try {
        const attempt = joinPack({
          collieStateDir: dir,
          selfId: "peer",
          leadOrigin: "http://127.0.0.1:19790",
          address: "127.0.0.1:19791",
          token: "an-invite-token",
          now: T0,
          identity: identity("peer"),
          transport,
        });
        await expect(attempt).rejects.toThrow();
        // Nothing is persisted before a response has parsed, so this machine is untouched.
        const data = await new TrustStore(dir).load();
        expect(data?.lead ?? null).toBeNull();
        expect(data?.pack ?? null).toBeNull();
        expect(label).not.toBe("");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  test("no diagnostic can carry the token", async () => {
    const dir = await scratch();
    try {
      let message = "";
      try {
        await joinPack({
          collieStateDir: dir,
          selfId: "peer",
          leadOrigin: "http://127.0.0.1:19790",
          address: "127.0.0.1:19791",
          token: "a-secret-token-value",
          now: T0,
          identity: identity("peer"),
          transport: () => Promise.reject(new Error("connect ECONNREFUSED a-secret-token-value")),
        });
      } catch (caught) {
        message = caught instanceof Error ? caught.message : String(caught);
      }
      // The transport's own message is replaced rather than wrapped: it is one of the few places a
      // token could be echoed back at us.
      expect(message).toBe("the lead could not be reached through the configured projection");
      expect(message).not.toContain("a-secret-token-value");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the module reaches for no CLI, no plugin identity and no service manager", () => {
    const source = readFileSync(resolve(import.meta.dir, "pack-enrollment.ts"), "utf8");
    for (const forbidden of ["../cli/", "PLUGIN_ID", "systemctl", "launchctl", "supervisionTier", "spawn"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
