import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

const SCRIPT = resolve(import.meta.dir, "check-private-facts.ts");
const ROOT = resolve(import.meta.dir, "..");

/**
 * Run the real guard against a throwaway checkout holding exactly one file.
 *
 * A real `git ls-files` tree and the real script, not a stub: the scan set is the half most likely to
 * drift, and a stubbed one would never notice.
 *
 * Every planted value below is fabricated. This file is excluded from the guard's own scan for that
 * reason — it is the one place where a violating shape is the point.
 */
async function guard(
  content: string,
  options: { path?: string; localNames?: string[] } = {},
): Promise<{ code: number; out: string }> {
  const root = await mkdtemp(join(tmpdir(), "private-facts-"));
  try {
    const path = options.path ?? "fleet/sample.ts";
    await Bun.$`git -C ${root} init -q`.quiet();
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    // The guard reads the fork manifest for its scan set, so the fixture needs one that owns the file.
    await writeFile(
      join(root, "FORK.toml"),
      '[[owned]]\nid = "sample"\nintent = "fixture"\npaths = ["fleet/**"]\n',
    );
    if (options.localNames !== undefined) {
      await writeFile(
        join(root, "LOCAL.md"),
        `# local\n\n\`\`\`private-names\n${options.localNames.join("\n")}\n\`\`\`\n`,
      );
    }
    await Bun.$`git -C ${root} add -A`.quiet();
    const run = Bun.spawnSync(["bun", SCRIPT, root]);
    return {
      code: run.exitCode ?? 0,
      out: new TextDecoder().decode(run.stdout) + new TextDecoder().decode(run.stderr),
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("the private-fact guard", () => {
  test("refuses one planted violation per shape", async () => {
    for (const [rule, line] of [
      ["address", 'const host = "11.22.33.44";'],
      ["home", 'const key = "/home/notasyntheticname/.ssh/id_ed25519";'],
      ["home (root)", 'const state = "/root/.config/fleet";'],
      [
        "secret",
        'const v = "$argon2id$v=19$m=65536,t=3,p=1$dGhpc2lzYWZha2VzYWx0dmFsdWU$YnV0aXRpc2xvbmdlbm91Z2h0b2xvb2tyZWFs";',
      ],
      ["secret (key)", 'const k = "-----BEGIN OPENSSH PRIVATE KEY-----";'],
    ] as const) {
      const { code, out } = await guard(line);
      expect(`${rule}: ${code}`).toBe(`${rule}: 1`);
      expect(out).toContain("private facts:");
    }
  });

  test("passes one negative control per exemption", async () => {
    const { code, out } = await guard(
      [
        // address: loopback, "any", and the RFC 5737 documentation ranges.
        'const loopback = "127.0.0.1";',
        'const any = "0.0.0.0";',
        'const documented = "203.0.113.1";',
        // home: the placeholder accounts a public fixture is meant to use.
        'const mine = "/home/you/project";',
        'const theirs = "/Users/operator/project";',
        // secret: a placeholder verifier whose salt and hash are too short to be either.
        'const placeholder = "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA";',
      ].join("\n"),
    );
    expect(out).not.toContain("private facts:");
    expect(code).toBe(0);
  });

  test("reports a real address even on a line that names the publisher", async () => {
    // The publisher exemption covers the local-name check, not the shape rules.
    const { code } = await guard('// memset0/herdr-fleet runs at 11.22.33.44');
    expect(code).toBe(1);
  });

  test("with no local context file, says which case it could not cover", async () => {
    const { code, out } = await guard('const box = "thistlewood";');
    expect(code).toBe(0);
    // So a green run on a fresh clone is never read as proof that no hostname leaked.
    expect(out).toContain("NOT checked");
  });

  test("catches a shapeless name the local file records, without echoing it", async () => {
    const { code, out } = await guard('const box = "thistlewood";', { localNames: ["thistlewood"] });
    expect(code).toBe(1);
    // The finding names the file and the rule. The value came from LOCAL.md and must stay there.
    expect(out).not.toContain("thistlewood");
    expect(out).toContain("fleet/sample.ts:1");
  });

  test("exempts the publisher's own identity from the local-name check", async () => {
    const { code } = await guard('const id = "memset0.herdr-fleet";', { localNames: ["memset0"] });
    expect(code).toBe(0);
  });

  test("scans what the fork owns and leaves upstream's files to upstream", async () => {
    const { code } = await guard('const host = "11.22.33.44";', { path: "bridge/upstream.ts" });
    expect(code).toBe(0);
  });

  /**
   * Run the real pre-commit hook against a throwaway checkout, with the other three guards taken out
   * by their own hatches.
   *
   * The wiring is the part that broke once: guard D was first added INSIDE the lint guard's skip
   * branch, where it ran only when linting was skipped and never otherwise. A test that only calls
   * the script would have stayed green through that.
   */
  async function hook(env: Record<string, string>): Promise<number> {
    const root = await mkdtemp(join(tmpdir(), "private-facts-hook-"));
    try {
      await Bun.$`git -C ${root} init -q`.quiet();
      await Bun.$`cp -R ${join(ROOT, "scripts")} ${join(root, "scripts")}`.quiet();
      await writeFile(
        join(root, "FORK.toml"),
        '[[owned]]\nid = "sample"\nintent = "fixture"\npaths = ["fleet/**"]\n',
      );
      await mkdir(join(root, "fleet"), { recursive: true });
      await writeFile(join(root, "fleet", "sample.ts"), 'const host = "11.22.33.44";\n');
      await Bun.$`git -C ${root} add -A`.quiet();
      const run = Bun.spawnSync(["bash", join(root, "scripts/git-hooks/pre-commit")], {
        cwd: root,
        // Guard A needs a version tree, guard B needs node_modules, guard C needs a protocol doc.
        // Every one of them is off here, which is exactly what makes this an independence check.
        env: {
          ...process.env,
          SKIP_VERSION_CHECK: "1",
          SKIP_LINT_CHECK: "1",
          SKIP_PACK_WIRE_CHECK: "1",
          ...env,
        },
      });
      return run.exitCode ?? 0;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  test("the hook runs it even when all three other hatches are taken", async () => {
    expect(await hook({})).toBe(1);
  });

  test("its own hatch is the only one that disarms it", async () => {
    expect(await hook({ SKIP_PRIVACY_CHECK: "1" })).toBe(0);
  });

  test("the repository it ships in passes it", async () => {
    const run = Bun.spawnSync(["bun", SCRIPT, ROOT]);
    expect(new TextDecoder().decode(run.stderr)).not.toContain("private facts:");
    expect(run.exitCode).toBe(0);
  });
});
