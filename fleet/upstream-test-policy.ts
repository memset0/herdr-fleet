// Run unchanged upstream bridge fixtures against their own policy; Fleet cases run separately.
import { BOUNDS } from "../bridge/surface/protocol.ts";
import { resetProfileLog } from "../web/src/lib/surface/profile.ts";
import { profileTuning } from "./profile-tunes.ts";
import { sendHolds } from "./send-holds.ts";
import { sendPolicy } from "./send-patience.ts";

profileTuning.enabled = false;
sendHolds.enabled = true;
sendPolicy.patient = false;
Object.assign(BOUNDS, { s0: { reads: 2, ms: 1200 }, probe: { reads: 3, ms: 900 }, s1: { reads: 6, ms: 2500 }, s2: { reads: 6, ms: 3000 }, notice: { reads: 6, ms: 2000 } });
resetProfileLog();
