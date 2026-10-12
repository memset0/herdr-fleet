import { createHash } from "node:crypto";

import { renderTemplate } from "../template.ts";
import { CODEX_TRANSCRIBE_URL, probeCodexIdentity } from "./codex.ts";
import type { CodexSttSettings, SttSettingsDocument, SttWireIdentity } from "./config.ts";

// ── THE CODEX PROVIDER'S CONSENT AND ITS PROBE, ONCE, FOR THE CLI AND FOR SETTINGS ──────────────
//
// Two surfaces may turn the codex provider on: `collie stt setup --provider codex` on the host's
// keyboard (ADR 0029), and the Host speech provider card in Settings → Voice on a write device
// (ADR 0097). Both must say the same words before anything runs, and both must record the same
// verdict afterwards, or the second surface would be a weaker copy of the consent ADR 0029 rests on.
// So the words and the probe live HERE, and both surfaces read them:
//
//   • {@link CODEX_CONSENT_PARAGRAPHS} is the text. The CLI prints it line by line; the web app shows
//     each paragraph as one string from its message catalogue, and `codex-setup.test.ts` reads
//     `web/src/lib/i18n/messages/en.ts` off disk and fails when an English paragraph there is not
//     exactly the lines here joined by one space. A translation may say it in another language; the
//     English may not say it differently.
//   • {@link CODEX_CONSENT_ID} names this version of the text. Settings sends it back with the "I
//     accept" tap, and the bridge refuses a codex switch that names any other id: a phone showing an
//     older text has not consented to this one. It is a hash of the template, so any change to the
//     words is a new id, and the web app's literal copy (`web/src/lib/stt-consent.ts`) fails the
//     same test until someone re-reads the text and updates it.
//   • {@link probeCodexSetup} is the probe and the document it earns. Honest identity first, the
//     Codex CLI's headers only when that is refused, and the verdict written as `wireIdentity`.
//
// The slots are `{url}` (the one endpoint, fixed) and `{codexBin}` (the binary whose sign-in pays),
// spelled the way `web/src/lib/i18n/` spells them, so the catalogue entry is the template verbatim.

/** The consent, paragraph by paragraph, each paragraph as the lines the terminal prints. */
export const CODEX_CONSENT_PARAGRAPHS: readonly (readonly string[])[] = [
  [
    "Recordings would be sent to {url}.",
    "That endpoint is PRIVATE and UNSUPPORTED. It is undocumented, nobody owes Collie",
    "compatibility with it, and it may stop working at any time without notice.",
  ],
  [
    "Every request is authorised by a short-lived token from YOUR sign-in at {codexBin}.",
    "So YOUR ChatGPT account carries the exposure: the rate limits are yours, and so is",
    "any suspension or ban that comes of using a private endpoint this way.",
  ],
  [
    "Collie asks the endpoint under its OWN name first. If that is refused, the fallback",
    "wears the Codex CLI's headers. That is impersonation, and accepting here is what",
    "permits it. Whichever identity is accepted gets written into the config, in a word",
    "you can read back with `collie stt status`.",
  ],
  ["Nothing has run yet. Nothing is written unless you accept."],
];

/** Each paragraph as one string, its lines joined by a space: what the web catalogue holds. */
export const CODEX_CONSENT_TEXT: readonly string[] = CODEX_CONSENT_PARAGRAPHS.map((lines) => lines.join(" "));

/**
 * This version of the consent: `codex-consent-` and the first twelve hex digits of the sha256 of the
 * template's paragraphs, joined by a blank line. Derived, never typed, so the words cannot change
 * without the id changing with them.
 */
export const CODEX_CONSENT_ID = `codex-consent-${createHash("sha256").update(CODEX_CONSENT_TEXT.join("\n\n")).digest("hex").slice(0, 12)}`;

/** The consent's lines with the slots filled, paragraph by paragraph, for the terminal. */
export function codexConsentLines(codexBin: string): string[][] {
  return CODEX_CONSENT_PARAGRAPHS.map((lines) =>
    lines.map((line) => renderTemplate(line, { url: CODEX_TRANSCRIBE_URL, codexBin })),
  );
}

/** The probe, as `probeCodexIdentity` takes it. A seam so no test dials `chatgpt.com`. */
export type CodexIdentityProbe = (settings: CodexSttSettings) => Promise<SttWireIdentity>;

/**
 * Probe the endpoint and build the `stt.json` document the verdict earns. The ONE way the codex
 * provider is set up, from either surface: honest first, the fallback only when the endpoint refused
 * the honest identity, and the identity it accepted recorded in `wireIdentity`. Throws what the probe
 * throws (a sign-in failure, both identities refused); nothing is written by this function.
 */
export async function probeCodexSetup(
  codexBin: string,
  probe: CodexIdentityProbe = probeCodexIdentity,
): Promise<{ document: SttSettingsDocument; identity: SttWireIdentity }> {
  const identity = await probe({ provider: "codex", codexBin, wireIdentity: "honest" });
  return { document: { provider: "codex", codexBin, wireIdentity: identity }, identity };
}
