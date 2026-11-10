import type { FleetConfig } from "./config.ts";

export interface StartupPolicy {
  readonly readyMs: number;
  readonly controlMs: number;
  readonly staleLockMs: number;
}

export function startupPolicy(config: Pick<FleetConfig, "collie">): StartupPolicy {
  return config.collie.mux === "herdr-core"
    ? { readyMs: 60_000, controlMs: 75_000, staleLockMs: 78_000 }
    : { readyMs: 10_000, controlMs: 12_000, staleLockMs: 15_000 };
}

interface StartupClock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

export async function waitForStartup(
  ready: () => Promise<boolean>,
  timeoutMs: number,
  clock: StartupClock = { now: Date.now, sleep: (milliseconds) => Bun.sleep(milliseconds) },
): Promise<void> {
  const deadline = clock.now() + timeoutMs;
  while (clock.now() < deadline) {
    if (await ready()) return;
    await clock.sleep(100);
  }
  throw new Error(`Fleet children did not become ready within ${timeoutMs / 1_000} seconds`);
}
