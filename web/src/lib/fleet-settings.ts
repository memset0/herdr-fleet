// The browser's half of Fleet's own settings document.
//
// It talks to Fleet's Gateway, not to Collie's bridge: nothing under `bridge/` knows this document
// exists, and `lib/api.ts` is untouched. A Collie mounted without a Fleet Gateway in front of it
// answers 404 here, which is why "unavailable" is a first-class answer rather than an error — the
// settings page then simply does not offer the editor.

import { useEffect, useState } from "react";

import {
  DEFAULT_FLEET_SETTINGS,
  parseFleetSettingsText,
  type FleetSettings,
} from "../../../fleet/settings/document.ts";
import { asJsonObject, asJsonString, type JsonValue } from "@/lib/json";

/** Fleet's own API surface, matching `FLEET_SETTINGS_PATH` on the Gateway. */
const SETTINGS_URL = "/fleet/api/settings";

export interface FleetSettingsDocument {
  /** Opaque, and sent back on save. Empty when no document exists yet. */
  readonly version: string;
  /** The document's text, exactly as it is on disk. */
  readonly document: string;
  /** Bindings that work on some browsers and not others, for the editor to mark. */
  readonly risky: readonly string[];
}

export type FleetSettingsSave =
  | { readonly ok: true; readonly document: FleetSettingsDocument }
  /** The document was refused whole. `at` names the entry at fault in the document's own terms. */
  | { readonly ok: false; readonly kind: "invalid"; readonly at: string; readonly message: string }
  /** Somebody else wrote the file. `document` is what is actually there now. */
  | { readonly ok: false; readonly kind: "conflict"; readonly document: FleetSettingsDocument }
  | { readonly ok: false; readonly kind: "unavailable" };

/**
 * The route's answer, narrowed in one place.
 *
 * Every field goes through `lib/json.ts`'s readers rather than being asserted: this is the one
 * function that turns the Gateway's reply into a domain value, so a reply that is not one answers
 * `null` and the settings page simply does not offer the editor.
 */
function asDocument(value: JsonValue | undefined): FleetSettingsDocument | null {
  const body = asJsonObject(value);
  if (body === undefined) return null;
  const version = asJsonString(body.version);
  const document = asJsonString(body.document);
  if (version === undefined || document === undefined) return null;
  const raw = body.risky;
  const risky = Array.isArray(raw)
    ? raw.map((entry) => asJsonString(entry)).filter((entry): entry is string => entry !== undefined)
    : [];
  return { version, document, risky };
}

/** `null` means this installation serves no settings document. */
export async function fetchFleetSettings(signal?: AbortSignal): Promise<FleetSettingsDocument | null> {
  const response = await fetch(SETTINGS_URL, { signal, headers: { accept: "application/json" } });
  if (!response.ok) return null;
  // SAFETY: `Response.json()` answers with exactly a JsonValue by construction; `asDocument` is the
  // only reader of it and checks every field it names.
  return asDocument((await response.json()) as JsonValue);
}

export async function saveFleetSettings(
  document: string,
  version: string,
): Promise<FleetSettingsSave> {
  const response = await fetch(SETTINGS_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ document, version }),
  });
  if (response.ok) {
    // SAFETY: as above — the parse is `asDocument`, which believes nothing it has not checked.
    const parsed = asDocument((await response.json()) as JsonValue);
    return parsed === null ? { ok: false, kind: "unavailable" } : { ok: true, document: parsed };
  }
  if (response.status === 409) {
    // SAFETY: as above.
    const parsed = asDocument((await response.json()) as JsonValue);
    return parsed === null
      ? { ok: false, kind: "unavailable" }
      : { ok: false, kind: "conflict", document: parsed };
  }
  if (response.status === 422) {
    // SAFETY: as above; both fields are read through `asJsonString`, which answers undefined for
    // anything that is not one.
    const body = asJsonObject((await response.json()) as JsonValue) ?? {};
    return {
      ok: false,
      kind: "invalid",
      at: asJsonString(body.at) ?? "",
      message: asJsonString(body.message) ?? "",
    };
  }
  return { ok: false, kind: "unavailable" };
}

// ── THE DOCUMENT REACHING THE KEYBOARD ────────────────────────────────────────────────────────────
//
// This half was missing, and its absence is the whole reason a binding written on disk did nothing:
// the command provider took the operator's bindings as an input and nothing ever supplied them. The
// document was written, served, read and validated — and never applied.
//
// Read ONCE on mount, and again when a save says so. Not polled: a settings document is a person's
// decision, not a data feed, and a poll would spend a request every few seconds to notice something
// that changes twice a year.

const saved = new Set<() => void>();

/** Tell every reader the document on disk has changed, so a save lands without a reload. */
export function notifyFleetSettingsSaved(): void {
  for (const listener of saved) listener();
}

/**
 * The effective settings this browser should obey.
 *
 * Every failure answers the shipped defaults rather than an empty keyboard: no document, no Fleet
 * Gateway in front of this Collie at all (the route 404s, which is Collie's own tests and its
 * playground), a document the Gateway is holding because it stopped parsing, or a fetch that simply
 * did not complete. None of those is a state in which the operator should be left with nothing bound.
 *
 * Parsed with the SAME validator the Gateway uses, so what the browser obeys and what the server
 * accepted cannot come apart.
 */
export function useFleetSettings(): FleetSettings {
  const [settings, setSettings] = useState<FleetSettings>(DEFAULT_FLEET_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void (async () => {
        try {
          const document = await fetchFleetSettings();
          if (cancelled || document === null) return;
          const parsed = parseFleetSettingsText(document.document);
          if (parsed.ok) setSettings(parsed.settings);
        } catch {
          // Keep whatever is in force. The defaults are already the initial state.
        }
      })();
    };
    load();
    saved.add(load);
    return () => {
      cancelled = true;
      saved.delete(load);
    };
  }, []);

  return settings;
}
