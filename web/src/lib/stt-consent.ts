import type { MessageKey } from "@/lib/i18n";

// ── THE CODEX CONSENT, AS THIS APP SHOWS IT (ADR 0097) ──────────────────────────────────────────
//
// The words are the ones `collie stt setup --provider codex` prints. Their one source is
// `bridge/stt/codex-setup.ts`; this app cannot import bridge code, so it keeps the English in its
// catalogue (`settings.speech.provider.consent.p1` to `.p4`, translated like any other line) and the
// two literals below. `bridge/stt/codex-setup.test.ts` reads this file and `en.ts` as text and fails
// when either differs from the bridge: change the words there, and this id with them.
//
// The id goes back to the host with the "I accept" tap. The host refuses a Codex switch with any other
// id, so a phone that showed an older text cannot consent to a newer one.

/** The version of the consent text this app shows. Equal to `CODEX_CONSENT_ID` in bridge/stt/codex-setup.ts. */
export const CODEX_CONSENT_ID = "codex-consent-80d08bef89cd";

/** The endpoint the consent names. Equal to `CODEX_TRANSCRIBE_URL` in bridge/stt/codex.ts. */
export const CODEX_TRANSCRIBE_URL = "https://chatgpt.com/backend-api/transcribe";

/** The consent's paragraphs, in order. Each takes `{url}` and `{codexBin}`. */
export const CODEX_CONSENT_KEYS = [
  "settings.speech.provider.consent.p1",
  "settings.speech.provider.consent.p2",
  "settings.speech.provider.consent.p3",
  "settings.speech.provider.consent.p4",
] as const satisfies readonly MessageKey[];
