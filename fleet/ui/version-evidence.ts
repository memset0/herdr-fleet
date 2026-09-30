import type { FleetReleaseObservation } from "../version/release-observer.ts";

export type HostVersionState =
  | "compatible"
  | "outdated"
  | "manual-major"
  | "development"
  | "last-reported"
  | "release-stale"
  | "release-unavailable"
  | "unknown";

export interface HostVersionEvidence {
  /** The running member's complete answer, never a desired or inferred value. */
  readonly reported: string | null;
  readonly state: HostVersionState;
  /** Preserved beside `last-reported`, whose historical qualification otherwise wins the state. */
  readonly development: boolean;
  readonly checkedAt: number | null;
}

interface ParsedReportedVersion {
  readonly major: number;
  readonly minor: number;
  readonly prerelease: boolean;
}

function parseReportedVersion(reported: string | undefined): ParsedReportedVersion | null {
  if (reported === undefined) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    reported.trim(),
  );
  if (match === null) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) return null;
  return { major, minor, prerelease: match[4] !== undefined };
}

/**
 * Classify display evidence only. The result has no target, action or installation claim, and patch
 * never participates because Fleet peers are compatible at major.minor.
 */
export function classifyHostVersion(input: {
  readonly reported?: string;
  readonly answering: boolean;
  readonly release: FleetReleaseObservation;
}): HostVersionEvidence {
  const raw = input.reported?.trim();
  const parsed = parseReportedVersion(raw);
  if (parsed === null) {
    return { reported: raw || null, state: "unknown", development: false, checkedAt: input.release.checkedAt };
  }
  if (!input.answering) {
    return {
      reported: raw ?? null,
      state: "last-reported",
      development: parsed.prerelease,
      checkedAt: input.release.checkedAt,
    };
  }
  if (parsed.prerelease) {
    return { reported: raw ?? null, state: "development", development: true, checkedAt: input.release.checkedAt };
  }
  if (input.release.freshness === "stale") {
    return { reported: raw ?? null, state: "release-stale", development: false, checkedAt: input.release.checkedAt };
  }
  if (input.release.freshness === "unavailable" || input.release.latest === null) {
    return {
      reported: raw ?? null,
      state: "release-unavailable",
      development: false,
      checkedAt: input.release.checkedAt,
    };
  }
  const latestMajor = input.release.majors.at(-1)?.major;
  if (latestMajor !== undefined && latestMajor > parsed.major) {
    return { reported: raw ?? null, state: "manual-major", development: false, checkedAt: input.release.checkedAt };
  }
  const latestInMajor = input.release.majors.find(({ major }) => major === parsed.major)?.version;
  if (latestInMajor !== undefined) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(latestInMajor);
    const latestMinor = match === null ? parsed.minor : Number(match[2]);
    if (latestMinor > parsed.minor) {
      return { reported: raw ?? null, state: "outdated", development: false, checkedAt: input.release.checkedAt };
    }
  }
  return { reported: raw ?? null, state: "compatible", development: false, checkedAt: input.release.checkedAt };
}
