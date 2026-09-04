#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The fourth guard: refuse a tracked tree that carries a private fact.
//
// WHY A GUARD AND NOT A RULE. This product is developed against its operator's own production
// environment, so every bug report, reproduction and fixture starts life holding a real host, a real
// address or a real path. "Do not commit those" has been written down and enforced by remembering to
// look, which failed twice in one working session — once in a privacy guard whose deny-list spelled
// out the very values it excluded, and once in a fixture whose host label was a real machine's name.
//
// ── IT MATCHES SHAPES, NEVER A LIST OF FORBIDDEN VALUES ──────────────────────
// A deny-list has to name what it forbids, which puts those names in the tree: the leak it exists to
// prevent. So this asserts what a PUBLIC value looks like — loopback and RFC 5737 documentation
// addresses, placeholder accounts, a verifier too short to be one — and reports everything else.
//
// ── IT SCANS WHAT THIS FORK OWNS, READ FROM FORK.toml ────────────────────────
// Upstream's files are upstream's business: its fixtures name its own author's home directory and
// its own example addresses, all already public in its repository. Our leak surface is what WE
// write, and the manifest already declares exactly that, so the scan set follows the boundary.
//
// ── THE SHAPELESS NAMES COME FROM THE IGNORED FILE, OR NOT AT ALL ────────────
// A machine named by an ordinary word has no shape to match. Those names live in LOCAL.md, which
// this repository ignores, and are read from there when it exists. They are therefore usable by the
// guard and absent from the tree. When the file is missing the shape rules still run and the output
// says which case it could not cover, so a green run on a fresh clone is not read as a proof.
//
// Findings never echo a value read from LOCAL.md: a guard's own output is the next place a private
// value gets pasted from.

/** The checkout to scan. Defaults to this one; a positional argument lets the tests run the real guard. */
const ROOT = resolve(process.argv[2] ?? resolve(import.meta.dir, ".."));

/**
 * The publisher's own identity: intentional public metadata, exempt from the local-name check.
 *
 * An operator who lists their own handle as a private name would otherwise be reported on every line
 * carrying the plugin id or the repository slug. The shape rules do not consult this list — a real
 * address next to a repository slug is still a real address.
 */
const PUBLISHER = ["memset0.herdr-fleet", "memset0/herdr-fleet", "AltanS/collie"];

// ── WHY THERE IS NO HOSTNAME SHAPE RULE ──────────────────────────────────────
// A hostname's shape cannot tell the operator's own domain from a public one: `w3c.github.io` in a
// documentation link and a real deployment host are the same shape, and every dotted identifier in
// this codebase — an i18n key, `vite.config.ts`, `response.ok` — is that shape too. A rule loose
// enough to catch the second reports thousands of the third, and is switched off within a day.
//
// Hostnames are therefore the private-names block's job, not shape's: the operator's domain is one
// entry there and catches every host under it. The blind-spot line below says so, so a green run with
// no block is not read as "no hostname leaked".
/** Addresses a public example may name: loopback, "any", and RFC 5737's documentation ranges. */
const PUBLIC_ADDRESS =
  /^(127(\.\d{1,3}){3}|0\.0\.0\.0|255\.255\.255\.255|192\.0\.2\.\d{1,3}|198\.51\.100\.\d{1,3}|203\.0\.113\.\d{1,3})$/;

/** Placeholder accounts a public fixture may use. Public by construction, so safe to name here. */
const SYNTHETIC_USER = /\/(?:home|Users)\/(you|user|username|operator|someone|me|example)$/i;

interface Rule {
  readonly id: string;
  readonly what: string;
  readonly find: RegExp;
  /** True when the captured text is public and must not be reported. */
  readonly allow: (found: string) => boolean;
}

const RULES: readonly Rule[] = [
  {
    id: "address",
    what: "an IP address outside loopback and the documentation ranges",
    find: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
    allow: (found) => PUBLIC_ADDRESS.test(found),
  },
  {
    id: "home",
    what: "an absolute path under a user's home directory",
    find: /\/(?:home|Users)\/[A-Za-z0-9._-]+|(?<![\w-])\/root\/[A-Za-z0-9._/-]*/g,
    // A placeholder account is the point of a fixture and names nobody.
    allow: (found) => SYNTHETIC_USER.test(found),
  },
  {
    id: "secret",
    what: "material shaped like a private key, a real password verifier or a long opaque secret",
    // A verifier is only real if its salt and hash are long enough to BE a salt and a hash. A
    // fixture's `$…$c2FsdA$aGFzaA` — six characters each, "salt" and "hash" in base64 — is a
    // placeholder, and reporting it teaches an operator to ignore this guard.
    find: /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bssh-(?:rsa|ed25519|dss)\s+AAAA[0-9A-Za-z+/]{20,}|\$argon2[a-z]*\$[^\s"']*\$[A-Za-z0-9+/]{16,}\$[A-Za-z0-9+/]{16,}/g,
    allow: () => false,
  },
];

/**
 * The operator's own shapeless names, from the ignored local file. Never printed.
 *
 * Read from ONE marked block rather than scraped from the prose around it. LOCAL.md is a document,
 * and every four-letter word in a document is not a machine name — a scrape reports the whole tree
 * within a minute and the guard is switched off by lunchtime. The block is explicit, the operator
 * owns what is in it, and everything outside it is prose:
 *
 *     ```private-names
 *     one-name-per-line
 *     ```
 */
function localNames(): string[] {
  let text: string;
  try {
    text = readFileSync(join(ROOT, "LOCAL.md"), "utf8");
  } catch {
    return [];
  }
  const block = /^```private-names\s*$([\s\S]*?)^```\s*$/m.exec(text);
  if (block === null) return [];
  return (block[1] ?? "")
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly what: string;
  /** Omitted for a local-name match: the value came from LOCAL.md and must not be echoed. */
  readonly found?: string;
}

function trackedFiles(): string[] {
  const out = Bun.spawnSync(["git", "-C", ROOT, "ls-files", "-z"], { stdout: "pipe" });
  return new TextDecoder()
    .decode(out.stdout)
    .split("\0")
    .filter((path) => path !== "");
}

/**
 * WHAT IS SCANNED: exactly what this fork owns, and nothing else.
 *
 * Upstream's files are upstream's business — its own fixtures name its own author's home directory
 * and its own example addresses, all of them already public in its repository, and reporting them
 * teaches an operator to ignore this guard. Our leak surface is what WE write, and `FORK.toml`
 * already declares precisely that, so the scan set maintains itself as the boundary moves.
 */
function ownedPaths(): (path: string) => boolean {
  // SAFETY: only `owned[].paths` is read, and both levels are optional here, so a manifest that
  // parses to any other shape yields an empty glob list rather than a wrong one. `check-fork.ts`
  // is what validates the manifest; this guard only borrows its path list.
  const manifest = Bun.TOML.parse(readFileSync(join(ROOT, "FORK.toml"), "utf8")) as {
    owned?: { paths?: string[] }[];
  };
  const globs = (manifest.owned ?? []).flatMap((entry) => entry.paths ?? []);
  const matchers = globs.map((glob) => new Bun.Glob(glob));
  // Everything we author outside the manifest's own listing: the specifications, the agreement, the
  // manifest itself and this guard.
  const alsoOurs = [/^openspec\//, /^AGENTS\.md$/, /^FORK\.toml$/, /^scripts\/check-private-facts/];
  return (path) =>
    alsoOurs.some((re) => re.test(path)) || matchers.some((matcher) => matcher.match(path));
}

function scan(paths: readonly string[], names: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  for (const path of paths) {
    if (!owned(path)) continue;
    // Archived changes are a historical record; correcting one would rewrite what was decided.
    if (path.startsWith("openspec/changes/archive/")) continue;
    // This guard's own tests plant one violation per shape; scanning them reports every fixture.
    // Every planted value there is fabricated, and that file is the one place where that is the point.
    if (path === "scripts/check-private-facts.test.ts") continue;
    let text: string;
    try {
      text = readFileSync(join(ROOT, path), "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
      for (const rule of RULES) {
        for (const match of line.matchAll(rule.find)) {
          const found = match[0];
          if (rule.allow(found)) continue;
          findings.push({ file: path, line: index + 1, rule: rule.id, what: rule.what, found });
        }
      }
      if (PUBLISHER.some((allowed) => line.includes(allowed))) continue;
      const lower = line.toLowerCase();
      for (const name of names) {
        if (lower.includes(name)) {
          // No `found`: this value came from LOCAL.md.
          findings.push({
            file: path,
            line: index + 1,
            rule: "local",
            what: "a name the local context file records as this operator's own",
          });
          break;
        }
      }
    }
  }
  return findings;
}

const owned = ownedPaths();
const names = localNames();
const findings = scan(trackedFiles(), names);

for (const finding of findings) {
  const value = finding.found === undefined ? "" : `  ${finding.found}`;
  console.error(`${finding.file}:${finding.line}  [${finding.rule}] ${finding.what}${value}`);
}

if (findings.length > 0) {
  console.error("");
  console.error(`private facts: ${findings.length} finding(s) — make the value synthetic, or skip once with`);
  console.error("  SKIP_PRIVACY_CHECK=1 git commit …");
  process.exitCode = 1;
} else {
  const blind =
    names.length === 0
      ? "no private-names block in LOCAL.md — hostnames and machine names were NOT checked"
      : `${names.length} local name(s) checked; a host or machine name outside them is not checked`;
  console.log(`✓ no private fact in the tracked tree (${blind})`);
}
