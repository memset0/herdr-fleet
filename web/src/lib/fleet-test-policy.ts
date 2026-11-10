// Native fixtures retain upstream profiles; Fleet fixtures select their normal build flag.
import { afterEach, vi } from "vitest";
import { isFleetBuild } from "./fleet-build";
import { profileTuning } from "../../../fleet/profile-tunes.ts";

profileTuning.resolve = isFleetBuild;
afterEach(() => vi.unstubAllEnvs());
