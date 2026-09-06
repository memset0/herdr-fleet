import { describe, expect, test } from "bun:test";

import type { Placement } from "./placement.ts";
import {
  PEER_CLOSE_PATH,
  makePeerStartServer,
  peerAttachUrl,
  peerAuthority,
  peerControlUrl,
} from "./peer-start.ts";

const ENDPOINT = { host: "127.0.0.1", port: 18_911 };
const GEOMETRY = { columns: 100, rows: 30 };
const peer: Placement = { kind: "peer", host: "laptop", paneId: "w1:p1", endpoint: ENDPOINT };

describe("the address the lead dials", () => {
  test("names the Pane, on the projected endpoint, and nothing else", () => {
    const url = new URL(peerAttachUrl(ENDPOINT, "w1:p1"));
    expect(url.protocol).toBe("ws:");
    expect(url.host).toBe("127.0.0.1:18911");
    expect(url.pathname).toBe("/terminal/attach");
    expect([...url.searchParams.keys()]).toEqual(["pane"]);
    expect(url.searchParams.get("pane")).toBe("w1:p1");
  });

  test("brackets an IPv6 loopback rather than producing an unparseable authority", () => {
    expect(peerAuthority({ host: "::1", port: 18_911 })).toBe("[::1]:18911");
    expect(new URL(peerAttachUrl({ host: "::1", port: 18_911 }, "w1:p1")).host).toBe("[::1]:18911");
  });

  test("carries no terminal id, command, path or account, because it has none to carry", () => {
    const url = peerAttachUrl(ENDPOINT, "w1:p1");
    for (const forbidden of ["term_", "ttyd", "attach ", "/bin/", "user="]) {
      expect(url).not.toContain(forbidden);
    }
  });
});

describe("holding a member's terminal", () => {
  test("starts nothing on the lead — the address is the whole of it", async () => {
    const asked: string[] = [];
    const start = makePeerStartServer({
      request: async (url) => {
        asked.push(url);
      },
    });
    const server = await start(peer, GEOMETRY);
    expect(server.endpoint).toBe(peerAttachUrl(ENDPOINT, "w1:p1"));
    expect(asked).toEqual([]);
  });

  test("stopping tells the member to stop its own, once", async () => {
    const asked: { url: string; body: unknown }[] = [];
    const start = makePeerStartServer({
      request: async (url, init) => {
        asked.push({ url, body: init.body });
      },
    });
    const server = await start(peer, GEOMETRY);
    server.stop();
    server.stop();
    expect(asked).toHaveLength(1);
    expect(asked[0]!.url).toBe(peerControlUrl(ENDPOINT, PEER_CLOSE_PATH));
    expect(asked[0]!.body).toBe(JSON.stringify({ pane: "w1:p1" }));
  });

  test("a member that has already stood down is the state stop asks for, not a failure", async () => {
    const start = makePeerStartServer({
      request: async () => {
        throw new Error("connection refused");
      },
    });
    const server = await start(peer, GEOMETRY);
    expect(() => server.stop()).not.toThrow();
  });

  test("refuses a local placement rather than inventing an endpoint for it", async () => {
    const start = makePeerStartServer();
    await expect(start({ kind: "local", terminalId: "term_abc", paneId: "w1:p1" }, GEOMETRY)).rejects.toThrow(
      "member terminals only",
    );
  });
});
