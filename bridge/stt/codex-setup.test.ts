import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CODEX_TRANSCRIBE_URL } from "./codex.ts";
import {
  CODEX_CONSENT_ID,
  CODEX_CONSENT_PARAGRAPHS,
  CODEX_CONSENT_TEXT,
  codexConsentLines,
  probeCodexSetup,
} from "./codex-setup.ts";
import type { CodexSttSettings } from "./config.ts";

// THE DRIFT GUARD for the consent (ADR 0097). The CLI prints CODEX_CONSENT_PARAGRAPHS; the web app shows
// its catalogue's English, `settings.speech.provider.consent.p1` to `.p4`, and sends the id it holds in
// `web/src/lib/stt-consent.ts`. Neither web file can be imported here (the trees are type-checked apart,
// as `bridge/error-codes.test.ts` explains), so both are read as text.

const REPO = join(import.meta.dir, "..", "..");
const EN = readFileSync(join(REPO, "web", "src", "lib", "i18n", "messages", "en.ts"), "utf8");
const WEB_CONSENT = readFileSync(join(REPO, "web", "src", "lib", "stt-consent.ts"), "utf8");

/** One string value of a catalogue key, unescaped. The value may sit on the line after the key. */
function catalogueValue(source: string, key: string): string | null {
  const match = new RegExp(`"${key.replaceAll(".", "\\.")}":\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(source);
  // SAFETY: the capture is one JSON string literal by the pattern above; `JSON.parse` unescapes it.
  return match === null ? null : (JSON.parse(match[1]!) as string);
}

/** A `export const NAME = "value";` literal in a source file. */
function constValue(source: string, name: string): string | null {
  return new RegExp(`export const ${name} = "([^"]*)";`).exec(source)?.[1] ?? null;
}

describe("the codex consent is one text", () => {
  test("each English paragraph in the web catalogue is the CLI's lines joined by one space", () => {
    expect(CODEX_CONSENT_PARAGRAPHS).toHaveLength(4);
    CODEX_CONSENT_TEXT.forEach((paragraph, index) => {
      expect(catalogueValue(EN, `settings.speech.provider.consent.p${index + 1}`)).toBe(paragraph);
    });
  });

  test("the web app sends the id of this text, and names the same endpoint", () => {
    expect(CODEX_CONSENT_ID).toMatch(/^codex-consent-[0-9a-f]{12}$/);
    expect(constValue(WEB_CONSENT, "CODEX_CONSENT_ID")).toBe(CODEX_CONSENT_ID);
    expect(constValue(WEB_CONSENT, "CODEX_TRANSCRIBE_URL")).toBe(CODEX_TRANSCRIBE_URL);
  });

  test("the terminal's lines fill both slots and keep every word of the template", () => {
    const lines = codexConsentLines("/home/me/.local/bin/codex");
    expect(lines.flat().join(" ")).toContain(`sent to ${CODEX_TRANSCRIBE_URL}.`);
    expect(lines.flat().join(" ")).toContain("YOUR sign-in at /home/me/.local/bin/codex.");
    expect(lines.flat().join(" ")).not.toMatch(/\{\w+\}/);
    expect(lines.map((paragraph) => paragraph.length)).toEqual(CODEX_CONSENT_PARAGRAPHS.map((p) => p.length));
  });

  test("the words name the risks ADR 0029 requires, with no em dash", () => {
    const text = CODEX_CONSENT_TEXT.join(" ");
    for (const phrase of ["PRIVATE and UNSUPPORTED", "rate limits", "suspension or ban", "impersonation", "Nothing is written unless you accept"]) {
      expect(text).toContain(phrase);
    }
    expect(text).not.toContain("—");
  });
});

describe("probeCodexSetup", () => {
  test("asks honest first, and records the identity the endpoint accepted", async () => {
    const asked: CodexSttSettings[] = [];
    for (const verdict of ["honest", "codex-cli"] as const) {
      const result = await probeCodexSetup("/usr/bin/codex", async (settings) => {
        asked.push(settings);
        return verdict;
      });
      expect(result).toEqual({
        identity: verdict,
        document: { provider: "codex", codexBin: "/usr/bin/codex", wireIdentity: verdict },
      });
    }
    expect(asked).toEqual([
      { provider: "codex", codexBin: "/usr/bin/codex", wireIdentity: "honest" },
      { provider: "codex", codexBin: "/usr/bin/codex", wireIdentity: "honest" },
    ]);
  });

  test("a probe that fails throws its own sentence and builds no document", async () => {
    await expect(
      probeCodexSetup("/usr/bin/codex", async () => {
        throw new Error("Codex is not signed in — run `codex login`");
      }),
    ).rejects.toThrow("Codex is not signed in");
  });
});
