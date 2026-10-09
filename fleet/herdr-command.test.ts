import { afterAll, describe, expect, test } from "bun:test";

import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHerdrCommand } from "./herdr-command.ts";

const STATED = "/synthetic/stated/herdr";
const ON_PATH = "/synthetic/path/herdr";

function deps(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly onPath?: string | null;
  readonly executable?: readonly string[];
}) {
  const lookups: Array<{ name: string; searchPath: string }> = [];
  return {
    lookups,
    deps: {
      env: options.env,
      which: (name: string, searchPath: string) => {
        lookups.push({ name, searchPath });
        return options.onPath ?? null;
      },
      isExecutable: (path: string) => (options.executable ?? []).includes(path),
    },
  };
}

describe("which herdr Fleet runs", () => {
  test("the binary Herdr stated wins, even when PATH holds no herdr", () => {
    const h = deps({ env: { HERDR_BIN_PATH: STATED, PATH: "/usr/bin" }, executable: [STATED] });
    expect(resolveHerdrCommand(h.deps)).toEqual({ ok: true, path: STATED });
    expect(h.lookups).toEqual([]);
  });

  test("the stated binary wins over a different herdr on PATH", () => {
    const h = deps({ env: { HERDR_BIN_PATH: ` ${STATED} `, PATH: "/p" }, onPath: ON_PATH, executable: [STATED, ON_PATH] });
    expect(resolveHerdrCommand(h.deps)).toEqual({ ok: true, path: STATED });
  });

  test.each([
    ["unset", {}],
    ["empty", { HERDR_BIN_PATH: "  " }],
    ["relative", { HERDR_BIN_PATH: "bin/herdr" }],
    ["not executable", { HERDR_BIN_PATH: STATED }],
  ])("a stated binary that is %s falls back to PATH", (_label, stated) => {
    const h = deps({ env: { ...stated, PATH: "/a:/b" }, onPath: ON_PATH, executable: [ON_PATH] });
    expect(resolveHerdrCommand(h.deps)).toEqual({ ok: true, path: ON_PATH });
    expect(h.lookups).toEqual([{ name: "herdr", searchPath: "/a:/b" }]);
  });

  test("neither source yields a diagnostic naming both", () => {
    const result = resolveHerdrCommand(deps({ env: { HERDR_BIN_PATH: STATED, PATH: "/usr/bin" } }).deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostic).toContain(`HERDR_BIN_PATH (${STATED}) is not an executable file`);
    expect(result.diagnostic).toContain("no herdr on PATH");
  });

  test("a PATH answer must itself be an absolute executable", () => {
    const relative = resolveHerdrCommand(deps({ env: {}, onPath: "herdr", executable: ["herdr"] }).deps);
    expect(relative.ok).toBe(false);
    const stale = resolveHerdrCommand(deps({ env: {}, onPath: ON_PATH }).deps);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.diagnostic).toContain("HERDR_BIN_PATH is not set");
  });
});

describe("against a real filesystem", () => {
  const made: string[] = [];
  afterAll(async () => {
    for (const dir of made) await rm(dir, { recursive: true, force: true });
  });

  test("a stated executable outside PATH is used, and a non-executable one is refused", async () => {
    const dir = await mkdtemp(join(tmpdir(), "herdr-fleet-herdr-command-"));
    made.push(dir);
    const binary = join(dir, "herdr");
    await writeFile(binary, "#!/bin/sh\n");
    await chmod(binary, 0o755);
    expect(resolveHerdrCommand({ env: { HERDR_BIN_PATH: binary, PATH: join(dir, "empty") } })).toEqual({
      ok: true,
      path: binary,
    });
    // The same file found through PATH alone.
    expect(resolveHerdrCommand({ env: { PATH: dir } })).toEqual({ ok: true, path: binary });

    await chmod(binary, 0o644);
    const refused = resolveHerdrCommand({ env: { HERDR_BIN_PATH: binary, PATH: join(dir, "empty") } });
    expect(refused.ok).toBe(false);
    // A directory is not an executable file either.
    expect(resolveHerdrCommand({ env: { HERDR_BIN_PATH: dir, PATH: join(dir, "empty") } }).ok).toBe(false);
  });
});
