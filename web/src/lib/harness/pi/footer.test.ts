import { describe, expect, it } from "vitest";
import { parsePiFooter } from "./footer";

describe("parsePiFooter: the footers the corpus prints", () => {
  it.each([
    // [footer, arrowsMove, enter, digitsSelect, spaceToggles, escapeVerb, tabs]
    ["↑↓ navigate • Enter to select • Esc to cancel", true, "select", false, false, "cancel", false],
    ["↑↓ navigate • Enter select • Esc cancel", true, "select", false, false, "cancel", false],
    ["Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel", true, "select", false, false, "cancel", true],
    ["Enter to submit • Esc to go back", false, "submit", false, false, "go back", false],
    ["Enter to submit • Esc to cancel", false, "submit", false, false, "cancel", false],
    [
      "↑↓ navigate • Enter to select • Tab to add note • type a number or an answer • Esc to cancel",
      true, "select", false, false, "cancel", false,
    ],
    [
      "↑↓ navigate • Space to tick • Enter to confirm • type numbers (1,3) or an answer • Esc to cancel",
      true, "select", false, true, "cancel", false,
    ],
    ["←→ tabs • ↑↓ navigate • Enter select • type a number or text • Esc cancel", true, "select", false, false, "cancel", true],
    ["←→ tabs • Enter submit • Esc cancel", false, "submit", false, false, "cancel", true],
    ["←→ tabs • Enter goes to the first unanswered • Esc cancel", false, "other", false, false, "cancel", true],
    [
      "↑↓ move  1-9 select  space select  enter next  tab next question  c comment  esc cancel",
      true, "other", true, false, "cancel", false,
    ],
    [
      "↑↓ move  1-9 select  space toggle  enter toggle  tab next question  c comment  esc cancel",
      true, "other", true, true, "cancel", false,
    ],
    ["Enter to select · Ctrl+S to set as default · Escape/Ctrl+C to cancel", false, "select", false, false, "cancel", false],
  ] as const)("%s", (text, arrowsMove, enter, digitsSelect, spaceToggles, escapeVerb, tabs) => {
    expect(parsePiFooter(text)).toEqual({ text, arrowsMove, enter, digitsSelect, spaceToggles, escapeVerb, tabs });
  });
});

describe("parsePiFooter: what is not a footer", () => {
  it.each([
    ["one hint alone", "Esc to cancel"],
    ["a status line", "~/projects/pi-demo (main)"],
    ["a countdown", "Ask user · 30m"],
    ["a counter", "Submit (0/1 answered) — Enter advances"],
    ["an unknown key", "↑↓ navigate • F5 to refresh • Esc to cancel"],
    ["a sentence", "Pick a color for the Collie probe?"],
    ["an empty row", ""],
    ["a key torn from its verb", "↑↓ navigate • Enter to select • Esc • to cancel"],
  ])("declines %s", (_name, text) => {
    expect(parsePiFooter(text)).toBeNull();
  });

  it("gives a key no role for a verb it does not know", () => {
    expect(parsePiFooter("↑↓ scroll • Enter to select • Esc to cancel")?.arrowsMove).toBe(false);
    expect(parsePiFooter("↑↓ navigate • 1-9 jump • Esc to cancel")?.digitsSelect).toBe(false);
    expect(parsePiFooter("↑↓ navigate • Space to preview • Esc to cancel")?.spaceToggles).toBe(false);
  });

  it("keeps the stricter reading when Enter is named twice with two roles", () => {
    expect(parsePiFooter("Enter to select • enter next • Esc to cancel")?.enter).toBe("other");
    expect(parsePiFooter("Enter to select • Enter confirm • Esc to cancel")?.enter).toBe("select");
  });

  it("does not take typed digits for a digit plan", () => {
    expect(parsePiFooter("↑↓ navigate • type a number • Esc to cancel")?.digitsSelect).toBe(false);
  });
});
