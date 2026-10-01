export type HostVersionState =
  | "compatible"
  | "outdated"
  | "manual-major"
  | "development"
  | "last-reported"
  | "unknown";

export interface HostVersionEvidence {
  /** The running member's complete answer, never a desired or inferred value. */
  readonly reported: string | null;
  readonly state: HostVersionState;
  /** Preserved beside `last-reported`, whose historical qualification otherwise wins the state. */
  readonly development: boolean;
}

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly prerelease: boolean;
}

function parseVersion(reported: string | null | undefined): ParsedVersion | null {
  if (reported === undefined || reported === null) return null;
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
 * Classify display evidence only, against the lead's own running version from the same census read.
 * The lead is levelled first, so it is the reference a member must match; only its major.minor
 * counts — between releases it runs a `-dev` commit build, and patch never participates because
 * Fleet peers are compatible at major.minor. The result has no target, action or installation claim.
 */
export function classifyHostVersion(input: {
  readonly reported?: string;
  readonly answering: boolean;
  /** The lead's own runtime version (`self.version` of the crew census), or null when unread. */
  readonly lead: string | null;
}): HostVersionEvidence {
  const raw = input.reported?.trim();
  const parsed = parseVersion(raw);
  if (parsed === null) return { reported: raw || null, state: "unknown", development: false };
  const reported = raw ?? null;
  if (!input.answering) return { reported, state: "last-reported", development: parsed.prerelease };
  if (parsed.prerelease) return { reported, state: "development", development: true };
  const lead = parseVersion(input.lead);
  // No reference, no conclusion: a version is never called compatible against nothing.
  if (lead === null) return { reported, state: "unknown", development: false };
  if (lead.major > parsed.major) return { reported, state: "manual-major", development: false };
  if (lead.major === parsed.major && lead.minor > parsed.minor) {
    return { reported, state: "outdated", development: false };
  }
  return { reported, state: "compatible", development: false };
}
