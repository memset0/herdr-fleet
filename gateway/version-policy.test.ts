import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const script = join(import.meta.dir, "..", "scripts", "version-policy.sh");

function run(
  command: "classify" | "check",
  previous: string,
  current: string,
  approval?: { minor?: string; major?: string },
) {
  const env = { ...process.env };
  delete env.WEB_REMOTE_MINOR_RELEASE_APPROVAL;
  delete env.WEB_REMOTE_MAJOR_RELEASE_APPROVAL;
  if (approval?.minor !== undefined) env.WEB_REMOTE_MINOR_RELEASE_APPROVAL = approval.minor;
  if (approval?.major !== undefined) env.WEB_REMOTE_MAJOR_RELEASE_APPROVAL = approval.major;

  return Bun.spawnSync({
    cmd: ["bash", script, command, previous, current],
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("release version policy", () => {
  test.each([
    ["2.0.3", "2.0.4", "patch"],
    ["2.0.3", "2.1.0", "minor"],
    ["2.0.3", "3.0.0", "major"],
  ])("classifies %s -> %s as %s", (previous, current, bump) => {
    const result = run("classify", previous, current);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe(bump);
  });

  test.each([
    ["2.0.3", "2.0.3"],
    ["2.0.3", "2.0.5"],
    ["2.0.3", "2.1.1"],
    ["2.0.3", "2.2.0"],
    ["2.0.3", "3.1.0"],
    ["2.0.3", "4.0.0"],
    ["2.0.3", "1.9.9"],
    ["2.0.3", "02.1.0"],
  ])("rejects invalid release transition %s -> %s", (previous, current) => {
    expect(run("classify", previous, current).exitCode).not.toBe(0);
  });

  test("allows the next patch without an approval token", () => {
    expect(run("check", "2.0.3", "2.0.4").exitCode).toBe(0);
  });

  test("requires the exact target version for a minor release", () => {
    expect(run("check", "2.0.3", "2.1.0").exitCode).not.toBe(0);
    expect(run("check", "2.0.3", "2.1.0", { minor: "2.2.0" }).exitCode).not.toBe(0);
    expect(run("check", "2.0.3", "2.1.0", { minor: "2.1.0" }).exitCode).toBe(0);
  });

  test("requires the exact target version for an owner-directed major release", () => {
    expect(run("check", "2.0.3", "3.0.0").exitCode).not.toBe(0);
    expect(run("check", "2.0.3", "3.0.0", { major: "4.0.0" }).exitCode).not.toBe(0);
    expect(run("check", "2.0.3", "3.0.0", { major: "3.0.0" }).exitCode).toBe(0);
  });
});
