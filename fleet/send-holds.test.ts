import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("send holds", () => {
  test("Fleet ships with the hold queue off", () => {
    // The source, not the module: protocol tests in the same run turn the switch on.
    const source = readFileSync(new URL("./send-holds.ts", import.meta.url), "utf8");
    expect(source).toContain("export const sendHolds = { enabled: false };");
  });
});
