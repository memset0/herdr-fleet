import { opencodeAdapter } from ".";
import { collapsesAsPaste, isPasteTokenOnly, pasteCarriesSend } from "./paste";
import { opencodeReplyChunks } from "./reply-chunks";

// The limits and the token shape are opencode 1.19.0's, probed live (see paste.ts).
const line = (n: number) => "x".repeat(n);
const longUrl = `https://example.org/download?id=0123456789abcdef${"&mirror=https://mirror.example.org:8443/files".repeat(100)}`;

describe("collapsesAsPaste", () => {
  it("is the length limit on one line: 150 literal, 151 a token", () => {
    expect(collapsesAsPaste(line(150))).toBe(false);
    expect(collapsesAsPaste(line(151))).toBe(true);
  });

  it("is the line limit on short text: two lines literal, three a token", () => {
    expect(collapsesAsPaste("one\ntwo")).toBe(false);
    expect(collapsesAsPaste("one\ntwo\nthree")).toBe(true);
    expect(collapsesAsPaste("one\r\ntwo\r\nthree")).toBe(true);
  });

  it("measures the paste the way opencode does, without the outer whitespace", () => {
    expect(collapsesAsPaste(`\n\n${line(150)}\n`)).toBe(false);
    expect(collapsesAsPaste(`  ${line(150)}  `)).toBe(false);
  });
});

describe("pasteCarriesSend", () => {
  it("accepts the lone token whose line count is the send's", () => {
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines]")).toBe(true);
    expect(pasteCarriesSend(`${longUrl}\nsecond\nthird`, "[Pasted ~3 lines]")).toBe(true);
    expect(pasteCarriesSend("one\ntwo\nthree", "  [Pasted ~3 lines]  ")).toBe(true);
  });

  it("rejects a token with another line count", () => {
    expect(pasteCarriesSend(longUrl, "[Pasted ~2 lines]")).toBe(false);
    expect(pasteCarriesSend("one\ntwo\nthree", "[Pasted ~1 lines]")).toBe(false);
  });

  it("rejects a token for a send opencode would have inserted literally", () => {
    expect(pasteCarriesSend("ship it", "[Pasted ~1 lines]")).toBe(false);
    expect(pasteCarriesSend(line(150), "[Pasted ~1 lines]")).toBe(false);
  });

  it("rejects anything beside the token, and anything that only resembles it", () => {
    expect(pasteCarriesSend(longUrl, "leftover [Pasted ~1 lines]")).toBe(false);
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines] and more")).toBe(false);
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines][Pasted ~1 lines]")).toBe(false);
    expect(pasteCarriesSend(longUrl, "[Pasted text #1 +1 lines]")).toBe(false);
    expect(pasteCarriesSend(longUrl, "")).toBe(false);
  });

  it("counts a lone CR as a line break, as opencode does", () => {
    const cr = `${line(151)}\rsecond\rthird`;
    expect(pasteCarriesSend(cr, "[Pasted ~3 lines]")).toBe(true);
    expect(pasteCarriesSend(cr, "[Pasted ~1 lines]")).toBe(false);
    expect(pasteCarriesSend(`${line(151)}\r\nsecond\rthird\nfourth`, "[Pasted ~4 lines]")).toBe(true);
    expect(collapsesAsPaste("a\rb\rc")).toBe(true);
    expect(collapsesAsPaste("a\rb")).toBe(false);
  });

  it("rejects a token when the box already held something before the paste", () => {
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines]", "[Pasted ~1 lines]")).toBe(false);
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines]", "leftover")).toBe(false);
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines]", null)).toBe(true);
    expect(pasteCarriesSend(longUrl, "[Pasted ~1 lines]", undefined)).toBe(true);
  });
});

describe("isPasteTokenOnly", () => {
  it("is true for the token alone and false for real text", () => {
    expect(isPasteTokenOnly("[Pasted ~12 lines]")).toBe(true);
    expect(isPasteTokenOnly("see [Pasted ~12 lines]")).toBe(false);
    expect(isPasteTokenOnly("ship it")).toBe(false);
  });
});

describe("the opencode reply transport", () => {
  // The regression: this 4.4KB unbroken link used to go out as nine typed 512-char parts, and
  // opencode took longer to echo the later ones than the guard waits (2.8s at 2.5KB, 8.0s at 4.1KB).
  it("sends a collapsing reply as one bracketed paste", () => {
    expect(opencodeReplyChunks(longUrl)).toEqual([longUrl]);
    expect(opencodeAdapter.bracketedPaste?.(longUrl)).toBe(true);
    expect(opencodeAdapter.draftCarriesSend?.(longUrl, "[Pasted ~1 lines]")).toBe(true);
    expect(opencodeAdapter.draftIsOpaque?.("[Pasted ~1 lines]")).toBe(true);
  });

  it("still types a short reply bare, in one part", () => {
    expect(opencodeReplyChunks("ship it")).toEqual(["ship it"]);
    expect(opencodeAdapter.bracketedPaste?.("ship it")).toBe(false);
    expect(opencodeAdapter.draftIsOpaque?.("ship it")).toBe(false);
  });
});
