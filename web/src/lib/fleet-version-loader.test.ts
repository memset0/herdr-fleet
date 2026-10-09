// Herdr Fleet's version evidence rides the root loader (FORK.toml unnarrowed-pack-rows-port). The
// census read that yields it is optional: it starts beside the required snapshot and must never hold
// the first usable answer behind it.
import { http, HttpResponse } from "msw";

import { FakeIDBFactory, uninstallFakeIndexedDB } from "@/test/fake-indexeddb";
import { server } from "@/test/setup";
import { fixtureCrewStatus } from "@/test/handlers";

// loaders.ts keeps a module-level cache, so each case re-imports it fresh, on a cold fake database.
beforeEach(() => {
  vi.resetModules();
  new FakeIDBFactory().install();
});

afterEach(() => {
  vi.restoreAllMocks();
  uninstallFakeIndexedDB();
});

describe("rootLoader — Fleet version evidence", () => {
  it("does not hold the first usable snapshot behind optional version discovery", async () => {
    let releaseCensus = () => {};
    const heldCensus = new Promise<void>((resolve) => {
      releaseCensus = resolve;
    });
    server.use(
      http.get("/api/crew", async () => {
        await heldCensus;
        return HttpResponse.json(fixtureCrewStatus);
      }),
    );
    const { rootLoader } = await import("./loaders");

    const first = await rootLoader();
    expect(first.bridge).toBe("connected");
    expect(first.fleetVersions).toEqual({ lead: null, members: [] });
    releaseCensus();
    await vi.waitFor(async () => {
      // The lead's own version and every member's report come from the same census answer.
      const next = await rootLoader();
      expect(next.fleetVersions?.lead).toBe(fixtureCrewStatus.self.version);
      expect(next.fleetVersions?.members).toContainEqual({ id: "workshop", version: "0.29.0" });
    });
  });
});
