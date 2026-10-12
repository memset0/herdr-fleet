import { useEffect } from "react";

import { useStoredModel } from "@/hooks/use-stored-model";
import {
  phoneEngineBlock,
  phoneEngineEnv,
  runSttProbe,
  sttRecordingSupported,
  useSttEnginePreference,
  useSttProbeState,
} from "@/lib/stt";

/**
 * How "On this phone" stands for the next clip (ADR 0096 Decision 1 and 12):
 *
 *  - `phone`   the device asked for it, this phone holds a model, the browser passed the worker's
 *              probe, and this browser can record. The clip runs here.
 *  - `paused`  the device asked for it and the browser can run it, but the copy is gone (the browser
 *              cleared it, or it was removed). The clip still runs here and fails with the reason,
 *              and the takeover offers Send to host as one tap. It never goes to the host by itself:
 *              Settings → Voice says "Paused", and this is what makes that true.
 *  - `host`    anything else: the device chose the host, the browser cannot run the engine at all
 *              (never a choice there), or the first look for a copy has not answered yet.
 *
 * A probe that has not answered yet counts as passed, the way Settings reads it, so the microphone does
 * not flash away and back. The first dictation (or the probe this hook starts) settles it, and a probe
 * that says no takes the phone engine away with the sentence Settings already has for it.
 *
 * Cheap on a host-engine device: it reads one preference and never starts a worker.
 */
export type PhoneEngineUse = "phone" | "paused" | "host";

export function usePhoneEngineUse(): PhoneEngineUse {
  const preference = useSttEnginePreference();
  const probe = useSttProbeState();
  const { model } = useStoredModel();
  const wanted = preference === "phone" && model !== null && model !== undefined;
  useEffect(() => {
    if (wanted && probe === "unknown") void runSttProbe();
  }, [wanted, probe]);
  if (preference !== "phone" || model === undefined || !sttRecordingSupported()) return "host";
  if (phoneEngineBlock({ env: phoneEngineEnv(), probe, haveLocalModel: true, hostReady: false }) !== null) return "host";
  return model === null ? "paused" : "phone";
}
