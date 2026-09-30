import { describe, expect, test } from "bun:test";

import type { FleetReleaseObservation } from "../version/release-observer.ts";
import { classifyHostVersion } from "./version-evidence.ts";

const FRESH: FleetReleaseObservation = {
  latest: "4.0.0",
  majors: [
    { major: 3, version: "3.4.2" },
    { major: 4, version: "4.0.0" },
  ],
  checkedAt: 1_700_000_000_000,
  freshUntil: 1_700_000_300_000,
  freshness: "fresh",
};

describe("Host version evidence", () => {
  test("uses numeric major.minor compatibility without treating build identity as development", () => {
    expect(
      classifyHostVersion({ reported: "3.4.0+2fc727c", answering: true, release: FRESH }),
    ).toMatchObject({
      reported: "3.4.0+2fc727c",
      state: "manual-major",
      development: false,
    });

    const sameMajor = { ...FRESH, latest: "3.4.2", majors: [FRESH.majors[0]!] };
    expect(
      classifyHostVersion({ reported: "3.4.0+2fc727c", answering: true, release: sameMajor }),
    ).toMatchObject({ state: "compatible", development: false });
    expect(
      classifyHostVersion({ reported: "3.3.9+2fc727c", answering: true, release: sameMajor }),
    ).toMatchObject({ state: "outdated", development: false });
  });

  test("keeps explicit development and last-reported qualification ahead of release comparison", () => {
    expect(
      classifyHostVersion({ reported: "3.3.0-dev+2fc727c", answering: true, release: FRESH }),
    ).toMatchObject({ state: "development", development: true });
    expect(
      classifyHostVersion({ reported: "3.3.0-dev+2fc727c", answering: false, release: FRESH }),
    ).toMatchObject({ state: "last-reported", development: true });
  });

  test("never calls a version current when publication freshness is not trustworthy", () => {
    const stale = { ...FRESH, freshness: "stale" as const };
    expect(
      classifyHostVersion({ reported: "3.4.0+2fc727c", answering: true, release: stale }),
    ).toMatchObject({ state: "release-stale", checkedAt: FRESH.checkedAt });
    expect(
      classifyHostVersion({
        reported: "3.4.0+2fc727c",
        answering: true,
        release: { latest: null, majors: [], checkedAt: null, freshUntil: null, freshness: "unavailable" },
      }),
    ).toMatchObject({ state: "release-unavailable" });
    expect(classifyHostVersion({ reported: "not-semver", answering: true, release: FRESH })).toMatchObject({
      state: "unknown",
    });
  });
});
