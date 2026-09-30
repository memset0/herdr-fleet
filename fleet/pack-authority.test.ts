import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { leadStore, member, peerStore } from "../bridge/crew/fixtures.ts";
import { serializeTrustStore, TRUST_STORE_FILENAME, type TrustStoreData } from "../bridge/crew/trust-store.ts";
import { validatePackAuthority } from "./pack-authority.ts";
import {
  fleetTestConfig,
  fleetTestPackLeadConfig,
  fleetTestPackPeerConfig,
} from "./test-helpers.ts";

/** The trust file's previous name, as the 1.7.0-era Collie wrote it. */
const LEGACY_TRUST_STORE_FILENAME = "pack-trust.json";

/** A store as the previous Collie serialised it: `pack` for `crew`, `packId` for `crewId`. */
function legacySerialized(data: TrustStoreData): string {
  const modern = serializeTrustStore(data);
  const old = modern.replace(/"crew":/g, '"pack":').replace(/"crewId":/g, '"packId":');
  expect(old).toContain('"pack":');
  return old;
}

async function withStateDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(import.meta.dir, ".pack-trust-names-"));
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("Fleet native Pack authority", () => {
  test("schema 1 remains independent of Pack trust state", async () => {
    let reads = 0;
    await validatePackAuthority(fleetTestConfig(), "/unused", async () => {
      reads += 1;
      return null;
    });
    expect(reads).toBe(0);
  });

  test("accepts only matching native lead and peer modes", async () => {
    await expect(
      validatePackAuthority(fleetTestPackLeadConfig(), "/unused", async () =>
        leadStore({ peers: [member({ memberId: "peer-a" })] }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      validatePackAuthority(fleetTestPackPeerConfig(), "/unused", async () => peerStore()),
    ).resolves.toBeUndefined();
    await expect(
      validatePackAuthority(fleetTestPackLeadConfig(), "/unused", async () => peerStore()),
    ).rejects.toThrow("role lead does not match Collie Pack role peer");
    await expect(
      validatePackAuthority(fleetTestPackPeerConfig(), "/unused", async () =>
        leadStore({ peers: [member({ memberId: "peer-a" })] }),
      ),
    ).rejects.toThrow("role peer does not match Collie Pack role lead");
  });

  test("rejects missing, invalid, solo, and conflicted trust state", async () => {
    const config = fleetTestPackLeadConfig();
    await expect(validatePackAuthority(config, "/unused", async () => null)).rejects.toThrow(
      "unavailable or invalid",
    );
    await expect(
      validatePackAuthority(config, "/unused", async () => {
        throw new Error("private parse detail");
      }),
    ).rejects.toThrow("unavailable or invalid");
    await expect(validatePackAuthority(config, "/unused", async () => leadStore())).rejects.toThrow(
      "does not contain an active Pack role",
    );
    await expect(
      validatePackAuthority(
        fleetTestPackPeerConfig(),
        "/unused",
        async () => peerStore({ peers: [member({ memberId: "peer-a" })] }),
      ),
    ).rejects.toThrow("trust state is conflicted");
  });

  test("a lead's reachability list must equal Collie's enrolled member set", async () => {
    const lead = fleetTestPackLeadConfig();
    const roster = (...ids: string[]) =>
      leadStore({ peers: ids.map((memberId) => member({ memberId })) });

    // The fixture maps exactly `peer-a`, so agreement is the passing case.
    await expect(
      validatePackAuthority(lead, "/unused", async () => roster("peer-a")),
    ).resolves.toBeUndefined();

    // Enrolled but unmapped: the Lead would believe in a member it cannot dial.
    await expect(
      validatePackAuthority(lead, "/unused", async () => roster("peer-a", "peer-b")),
    ).rejects.toThrow("Collie Pack member peer-b has no fleet.toml reachability entry");

    // Mapped but not enrolled: configuration trying to be a second roster.
    const overMapped = {
      ...lead,
      reachability: [...lead.reachability, { memberId: "peer-b", host: "127.0.0.1", port: 18_902 }],
    } as const;
    await expect(
      validatePackAuthority(overMapped, "/unused", async () => roster("peer-a")),
    ).rejects.toThrow("fleet.toml reachability names peer-b, which Collie has not enrolled");

    // A peer carries no mapping at all, so the check never runs against one.
    await expect(
      validatePackAuthority(fleetTestPackPeerConfig(), "/unused", async () => peerStore()),
    ).resolves.toBeUndefined();
  });

  test("a mismatched reachability list leaves the store byte-for-byte unchanged", async () => {
    const root = await mkdtemp(join(import.meta.dir, ".pack-reachability-"));
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const path = join(root, TRUST_STORE_FILENAME);
      await writeFile(path, serializeTrustStore(leadStore({ peers: [member({ memberId: "peer-z" })] })), {
        mode: 0o600,
      });
      const before = await readFile(path);
      await expect(validatePackAuthority(fleetTestPackLeadConfig(), root)).rejects.toThrow(
        "has no fleet.toml reachability entry",
      );
      expect(await readFile(path)).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("production validation reads Collie's store without changing its bytes", async () => {
    const root = await mkdtemp(join(import.meta.dir, ".pack-authority-"));
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const path = join(root, TRUST_STORE_FILENAME);
      await writeFile(
        path,
        serializeTrustStore(leadStore({ peers: [member({ memberId: "peer-a" })] })),
        { mode: 0o600 },
      );
      const before = await readFile(path);
      await validatePackAuthority(fleetTestPackLeadConfig(), root);
      expect(await readFile(path)).toEqual(before);
      await writeFile(path, "not a trust store\n", { mode: 0o600 });
      const invalid = await readFile(path);
      await expect(validatePackAuthority(fleetTestPackLeadConfig(), root)).rejects.toThrow(
        "unavailable or invalid",
      );
      expect(await readFile(path)).toEqual(invalid);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the first start after the upgrade validates from the previous name and leaves it in place", async () => {
    await withStateDir(async (root) => {
      expect(TRUST_STORE_FILENAME).not.toBe(LEGACY_TRUST_STORE_FILENAME);
      const legacy = join(root, LEGACY_TRUST_STORE_FILENAME);
      await writeFile(legacy, legacySerialized(leadStore({ peers: [member({ memberId: "peer-a" })] })), {
        mode: 0o600,
      });
      const before = await readFile(legacy);
      await validatePackAuthority(fleetTestPackLeadConfig(), root);
      // The legacy file really decided: a role it does not hold is refused from it.
      await expect(validatePackAuthority(fleetTestPackPeerConfig(), root)).rejects.toThrow(
        "role peer does not match Collie Pack role lead",
      );
      expect(await readFile(legacy)).toEqual(before);
      expect(await readdir(root)).toEqual([LEGACY_TRUST_STORE_FILENAME]);
    });
  });

  test("when both names exist the current one wins and neither is touched", async () => {
    await withStateDir(async (root) => {
      const current = join(root, TRUST_STORE_FILENAME);
      const legacy = join(root, LEGACY_TRUST_STORE_FILENAME);
      await writeFile(current, serializeTrustStore(leadStore({ peers: [member({ memberId: "peer-a" })] })), {
        mode: 0o600,
      });
      await writeFile(legacy, legacySerialized(peerStore()), { mode: 0o600 });
      const currentBefore = await readFile(current);
      const legacyBefore = await readFile(legacy);
      await validatePackAuthority(fleetTestPackLeadConfig(), root);
      await expect(validatePackAuthority(fleetTestPackPeerConfig(), root)).rejects.toThrow(
        "role peer does not match Collie Pack role lead",
      );
      expect(await readFile(current)).toEqual(currentBefore);
      expect(await readFile(legacy)).toEqual(legacyBefore);
      expect((await readdir(root)).toSorted()).toEqual([TRUST_STORE_FILENAME, LEGACY_TRUST_STORE_FILENAME].toSorted());
    });
  });

  test("trust state absent under both names fails closed and creates nothing", async () => {
    await withStateDir(async (root) => {
      await expect(validatePackAuthority(fleetTestPackLeadConfig(), root)).rejects.toThrow(
        "unavailable or invalid",
      );
      expect(await readdir(root)).toEqual([]);
    });
  });
});
