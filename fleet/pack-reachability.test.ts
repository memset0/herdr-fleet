import { createServer, type AddressInfo } from "node:net";

import { describe, expect, test } from "bun:test";

import { childBackoffMs } from "./managed-child.ts";
import { assertLinkFiles, probeEndpoint, sshLinkCommand } from "./pack-reachability.ts";
import { fleetTestPackPeerConfig } from "./test-helpers.ts";

/** `Server#address()` widens to a union; the listening TCP case is the one a probe can use. */
function isAddressInfo(value: AddressInfo | string): value is AddressInfo {
  return Object.hasOwn(Object(value), "port");
}

function fileInfo(mode: number, isFile = true) {
  return async () => ({ isFile: () => isFile, mode });
}

describe("Fleet Pack reachability", () => {
  test("builds one restricted link carrying exactly two loopback projections", () => {
    const command = sshLinkCommand(fleetTestPackPeerConfig());
    expect(command[0]).toBe("ssh");
    expect(command.at(-1)).toBe("fleet-tunnel@lead.example.com");

    // The peer's own projected endpoint comes from `[collie]`, not from a second copy in transport.
    expect(command).toContain("-R");
    expect(command[command.indexOf("-R") + 1]).toBe("127.0.0.1:18901:[::1]:8787");
    expect(command).toContain("-L");
    expect(command[command.indexOf("-L") + 1]).toBe("[::1]:18902:127.0.0.1:8787");
    expect(command.filter((argument) => argument === "-R" || argument === "-L")).toHaveLength(2);
  });

  test("carries a third projection only when the peer declares a terminal service", () => {
    const withTerminal = sshLinkCommand(
      fleetTestPackPeerConfig(`[terminal]
bind_host = "127.0.0.1"
bind_port = 18903
lead_bind_host = "127.0.0.1"
lead_bind_port = 18911
server_path = "/synthetic/fleet/bin/terminal-server"
server_digest = "${"0".repeat(64)}"
`),
    );
    const forwards = withTerminal.filter((argument) => argument === "-R" || argument === "-L");
    expect(forwards).toHaveLength(3);
    // Aimed at the terminal service alone, and at a Lead-side endpoint distinct from the Pack one.
    expect(withTerminal).toContain("127.0.0.1:18911:127.0.0.1:18903");
    expect(withTerminal.at(-1)).toBe("fleet-tunnel@lead.example.com");

    // And the two-projection form is unchanged, argument for argument: take the third projection
    // back out and what is left is byte-for-byte the command a peer without one publishes.
    const trimmed = [...withTerminal];
    trimmed.splice(trimmed.indexOf("127.0.0.1:18911:127.0.0.1:18903") - 1, 2);
    expect(trimmed).toEqual([...sshLinkCommand(fleetTestPackPeerConfig())]);
  });

  test("removes every capability beyond the two projections", () => {
    const command = sshLinkCommand(fleetTestPackPeerConfig());
    for (const option of [
      "BatchMode=yes",
      "RequestTTY=no",
      "SessionType=none",
      "ExitOnForwardFailure=yes",
      "StrictHostKeyChecking=yes",
      "UserKnownHostsFile=/synthetic/fleet/known_hosts",
      "IdentitiesOnly=yes",
      "IdentityAgent=none",
      "ForwardAgent=no",
      "ForwardX11=no",
      "ForwardX11Trusted=no",
      "ControlMaster=no",
      "ControlPath=none",
      "PermitLocalCommand=no",
    ]) {
      expect(command).toContain(option);
    }
    expect(command).toContain("-N");
    expect(command).toContain("-T");
    // No inherited user configuration, and therefore no alias-supplied forward or proxy command.
    expect(command[command.indexOf("-F") + 1]).toBe("/dev/null");
    // ClearAllForwardings would clear the two forwards above, so it must stay absent.
    expect(command.join(" ")).not.toContain("ClearAllForwardings");
    // No remote command, no dynamic forward, no agent socket, no secret on the line.
    expect(command).not.toContain("-D");
    expect(command).not.toContain("-A");
    expect(command).not.toContain("-X");
    expect(command.join(" ")).not.toContain("ProxyCommand");
    expect(command.join(" ")).not.toContain("password");
  });

  test("refuses key material other users can read", async () => {
    const { transport } = fleetTestPackPeerConfig();
    await expect(assertLinkFiles(transport, fileInfo(0o600))).resolves.toBeUndefined();
    await expect(assertLinkFiles(transport, fileInfo(0o644))).rejects.toThrow(
      "transport.identity_file must not be accessible by group or other users",
    );
    await expect(assertLinkFiles(transport, fileInfo(0o600, false))).rejects.toThrow(
      "transport.identity_file must be a regular file",
    );
    await expect(
      assertLinkFiles(transport, async () => {
        throw new Error("private stat detail");
      }),
    ).rejects.toThrow("transport.identity_file is unavailable");
  });

  test("known_hosts is required but carries no permission bound", async () => {
    const { transport } = fleetTestPackPeerConfig();
    let seen = 0;
    await expect(
      assertLinkFiles(transport, async () => {
        seen += 1;
        // The identity is checked first; the second call is known_hosts, which is public material.
        return { isFile: () => true, mode: seen === 1 ? 0o600 : 0o644 };
      }),
    ).resolves.toBeUndefined();
    expect(seen).toBe(2);
  });

  test("the local projection probe is a connect and nothing more", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || !isAddressInfo(address)) throw new Error("no test listener");
    let payload = 0;
    server.on("connection", (socket) => {
      socket.on("data", () => {
        payload += 1;
      });
    });
    try {
      expect(await probeEndpoint({ host: "127.0.0.1", port: address.port })).toBe(true);
      expect(payload).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(await probeEndpoint({ host: "127.0.0.1", port: address.port }, 200)).toBe(false);
  });

  test("link recovery is bounded and never retries immediately", () => {
    const ceiling = fleetTestPackPeerConfig().transport.retryMaxSeconds * 1_000;
    const delays = [0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map((restarts) =>
      childBackoffMs(restarts, 1_000, ceiling),
    );
    expect(delays[0]).toBeGreaterThan(0);
    let previous = 0;
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(ceiling);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
    expect(delays.at(-1)).toBe(ceiling);
  });
});
