import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import { DEVICES_FILENAME, PairingStore, RegistryUnreadableError, filePairingIo, sha256Hex, type PairingIo } from "../bridge/pairing.ts";
import { GATEWAY_DEVICE_LABEL, enrolGatewayDevice, revokeGatewayDevice } from "./collie-pairing.ts";

const roots: string[] = [];

afterAll(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function stateDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "herdr-fleet-pairing-"));
  roots.push(root);
  return root;
}

async function registry(dir: string): Promise<{ label: string; tokenHash: string }[]> {
  return JSON.parse(await readFile(join(dir, DEVICES_FILENAME), "utf8")).devices;
}

describe("the Gateway's Collie pairing", () => {
  test("enrols one device that Collie's own gate resolves, and keeps no token on disk", async () => {
    const dir = await stateDir();
    const token = await enrolGatewayDevice(dir);
    const devices = await registry(dir);
    expect(devices.map((d) => d.label)).toEqual([GATEWAY_DEVICE_LABEL]);
    expect(devices[0]!.tokenHash).toBe(sha256Hex(token));
    expect(await readFile(join(dir, DEVICES_FILENAME), "utf8")).not.toContain(token);
    // Collie's own store, as its request gate asks it, accepts the token as that device.
    expect(new PairingStore(filePairingIo(dir)).resolve(token)?.label).toBe(GATEWAY_DEVICE_LABEL);
  });

  test("replaces a previous start's device, so its token authenticates as nobody", async () => {
    const dir = await stateDir();
    const first = await enrolGatewayDevice(dir);
    const second = await enrolGatewayDevice(dir);
    expect(second).not.toBe(first);
    const store = new PairingStore(filePairingIo(dir));
    expect(store.resolve(first)).toBeNull();
    expect(store.resolve(second)?.label).toBe(GATEWAY_DEVICE_LABEL);
    expect((await registry(dir)).filter((d) => d.label === GATEWAY_DEVICE_LABEL)).toHaveLength(1);
  });

  test("leaves every other device as it was", async () => {
    const dir = await stateDir();
    const other = { label: "phone", tokenHash: sha256Hex("phone-token"), createdAt: 1, lastSeenAt: 1 };
    await writeFile(join(dir, DEVICES_FILENAME), JSON.stringify({ devices: [other] }), { mode: 0o600 });
    await enrolGatewayDevice(dir);
    expect((await registry(dir)).map((d) => d.label)).toEqual(["phone", GATEWAY_DEVICE_LABEL]);
  });

  test("survives the Collie child restarting: the registry is all the gate reads", async () => {
    const dir = await stateDir();
    const token = await enrolGatewayDevice(dir);
    // A fresh store over the same directory is what a restarted Collie child builds.
    expect(new PairingStore(filePairingIo(dir)).resolve(token)?.label).toBe(GATEWAY_DEVICE_LABEL);
  });

  test("refuses when Collie reports the label still taken", async () => {
    const dir = await stateDir();
    const real = filePairingIo(dir);
    // A registry that keeps answering with the Gateway's device, as a concurrent writer would.
    const stuck: PairingIo = {
      ...real,
      readRegistry: async () => ({
        devices: [{ label: GATEWAY_DEVICE_LABEL, tokenHash: sha256Hex("other"), createdAt: 1, lastSeenAt: 1 }],
      }),
      writeRegistry: async () => {},
    };
    await expect(enrolGatewayDevice(dir, { io: stuck })).rejects.toThrow(GATEWAY_DEVICE_LABEL);
  });

  test("refuses an unreadable registry rather than enrolling over it", async () => {
    const dir = await stateDir();
    await writeFile(join(dir, DEVICES_FILENAME), "{not json", { mode: 0o600 });
    await expect(enrolGatewayDevice(dir)).rejects.toBeInstanceOf(RegistryUnreadableError);
    expect(await readFile(join(dir, DEVICES_FILENAME), "utf8")).toBe("{not json");
  });

  test("revokes the device again on stop", async () => {
    const dir = await stateDir();
    const token = await enrolGatewayDevice(dir);
    expect(await revokeGatewayDevice(dir)).toBe(true);
    expect(new PairingStore(filePairingIo(dir)).resolve(token)).toBeNull();
    expect(await registry(dir)).toEqual([]);
    expect(await revokeGatewayDevice(dir)).toBe(false);
  });
});
