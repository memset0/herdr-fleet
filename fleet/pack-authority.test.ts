import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { leadStore, member, peerStore } from "../bridge/pack/fixtures.ts";
import { serializeTrustStore, TRUST_STORE_FILENAME } from "../bridge/pack/trust-store.ts";
import { validatePackAuthority } from "./pack-authority.ts";
import {
  fleetTestConfig,
  fleetTestPackLeadConfig,
  fleetTestPackPeerConfig,
} from "./test-helpers.ts";

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
});
