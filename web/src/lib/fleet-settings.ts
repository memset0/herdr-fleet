// The browser's half of Fleet's own settings document.
//
// It talks to Fleet's Gateway, not to Collie's bridge: nothing under `bridge/` knows this document
// exists, and `lib/api.ts` is untouched. A Collie mounted without a Fleet Gateway in front of it
// answers 404 here, which is why "unavailable" is a first-class answer rather than an error — the
// settings page then simply does not offer the editor.

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
