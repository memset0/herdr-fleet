// Which Collie release this tree corresponds to, as numbers a test can compare against.
//
// Collie schedules its own removals against its own version: `cli/program.test.ts` drops the
// `collie pack` alias at major 2 and `bridge/removal-schedule.test.ts` drops the protocol version 1
// overlap at minor 9, and both read that version out of the root `package.json`. In this fork that
// file carries THIS product's line (3.x, AGENTS.md → Versioning), which says nothing about which
// Collie code is in the tree — read as Collie's, it made the alias look two majors overdue and would
// have made the overlap look due at a Fleet 3.9 with Collie still on 1.8.
//
// The adopted release is recorded once, in `FORK.toml`'s `[upstream].tag`, and moves only when an
// adoption moves it. This module is the one reader both clocks share, so the clock and the code it
// guards always come from the same Collie release. It is read through the manifest's own validating
// parser rather than a second, looser one.

import { readFileSync } from "node:fs";

import { parseForkManifest } from "../scripts/fork-manifest.ts";

export interface UpstreamVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** `major.minor.patch`, without the tag's `v`. */
  readonly text: string;
}

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** A strict `vX.Y.Z` release tag as numbers. Anything else throws: a clock that cannot be read must
 *  fail the suite rather than quietly read as zero, which would switch every removal check off. */
export function parseUpstreamTag(tag: string): UpstreamVersion {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) throw new Error(`[upstream].tag is not a strict vX.Y.Z release tag: ${tag}`);
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number);
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`[upstream].tag is not a strict vX.Y.Z release tag: ${tag}`);
  }
  return { major, minor, patch, text: `${major}.${minor}.${patch}` };
}

/** The Collie release `FORK.toml` records for this tree. */
export function upstreamVersion(
  manifest: URL = new URL("../FORK.toml", import.meta.url),
): UpstreamVersion {
  return parseUpstreamTag(parseForkManifest(readFileSync(manifest, "utf8")).upstream.tag);
}
