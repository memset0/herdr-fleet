import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `lookNow` lives inside `startServer`, which only `Bun.serve` runs, so the port is pinned where it
// lives — the same source-assertion shape upstream's own route tests use for Bun.serve bodies.
describe("a lead's look-now re-reads its members", () => {
  const src = readFileSync(join(import.meta.dir, "..", "bridge", "server.ts"), "utf8");
  const body = src.slice(src.indexOf("const lookNow = async"), src.indexOf("const localSnapshot ="));

  test("lookNow sweeps the crew after poking its own engine", () => {
    expect(body).toContain("rt.engine.pokeNow();");
    expect(body.indexOf("await crewLead?.sweep();")).toBeGreaterThan(body.indexOf("rt.engine.pokeNow();"));
  });

  test("the crew lead it sweeps is the server's optional one, absent on a solo install and a peer", () => {
    expect(src).toContain("const crewLead = opts.crewLead;");
    expect(src).toContain("crewLead?: CrewLead;");
  });
});
