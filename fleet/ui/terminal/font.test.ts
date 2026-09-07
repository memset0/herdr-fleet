import { describe, expect, test } from "bun:test";

import { terminalFontFamily } from "./font.ts";

const reader = (values: Record<string, string>) => (property: string) => values[property] ?? "";

describe("the family a terminal is measured with", () => {
  test("is the app's own mono stack when the operator chose no face", () => {
    const read = reader({
      "--font-mono": ' "Nerd Font Symbols", "JetBrains Mono", var(--font-cjk), monospace ',
      "--font-cjk": '"Maple Mono NF CN"',
    });
    expect(terminalFontFamily(undefined, read)).toBe(
      '"Nerd Font Symbols", "JetBrains Mono", "Maple Mono NF CN", monospace',
    );
  });

  test("is their chosen face when they chose one, with the same fallback in it", () => {
    const read = reader({ "--font-cjk": '"Maple Mono NF CN"' });
    expect(terminalFontFamily('"Nerd Font Symbols", Menlo, var(--font-cjk), monospace', read)).toBe(
      '"Nerd Font Symbols", Menlo, "Maple Mono NF CN", monospace',
    );
  });

  test("drops the CJK term rather than leaving a hole where it was", () => {
    // An empty entry is a parse error, and a browser that meets one discards the rest of the list —
    // which would take the generic ending with it.
    const read = reader({ "--font-cjk": "" });
    expect(terminalFontFamily("Menlo, var(--font-cjk), monospace", read)).toBe("Menlo, monospace");
  });

  test("always ends somewhere real", () => {
    const read = reader({ "--font-cjk": '"Maple Mono NF CN"' });
    expect(terminalFontFamily("Menlo", read)).toBe("Menlo, monospace");
    expect(terminalFontFamily(undefined, reader({}))).toBe("monospace");
    expect(terminalFontFamily("   ", reader({}))).toBe("monospace");
  });

  test("carries no unresolved custom property into the measurement", () => {
    const read = reader({
      "--font-mono": '"JetBrains Mono", var(--font-cjk), monospace',
      "--font-cjk": '"Maple Mono NF CN"',
    });
    expect(terminalFontFamily(undefined, read)).not.toContain("var(");
  });
});
