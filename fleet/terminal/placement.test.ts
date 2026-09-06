import { describe, expect, test } from "bun:test";

import { placementKey, placementLabel, type Placement } from "./placement.ts";

const local = (terminalId: string): Placement => ({ kind: "local", terminalId, paneId: "w1:p1" });
const peer = (host: string, paneId: string): Placement => ({
  kind: "peer",
  host,
  paneId,
  endpoint: { host: "127.0.0.1", port: 18_911 },
});

describe("what a diagnostic may say", () => {
  test("names the Pane and the machine, and never the terminal", () => {
    expect(placementLabel(local("term_65aad773f6c692a"))).toBe("local w1:p1");
    expect(placementLabel(peer("laptop", "w1:p1"))).toBe("laptop w1:p1");
    expect(placementLabel(local("term_65aad773f6c692a"))).not.toContain("term_");
  });
});

describe("the key a placement is held under", () => {
  test("is stable for the same terminal", () => {
    expect(placementKey(local("term_abc"))).toBe(placementKey(local("term_abc")));
  });

  test("separates two members' Panes that share an id", () => {
    // The same Pane id exists on every machine in a pack. One key for both would put one operator's
    // keystrokes into the other's terminal.
    expect(placementKey(peer("laptop", "w1:p1"))).not.toBe(placementKey(peer("desktop", "w1:p1")));
  });

  test("separates a local terminal from a member's Pane named like one", () => {
    expect(placementKey(local("term_abc"))).not.toBe(placementKey(peer("term", "abc")));
  });

  test("separates two Panes on one member", () => {
    expect(placementKey(peer("laptop", "w1:p1"))).not.toBe(placementKey(peer("laptop", "w1:p2")));
  });
});
