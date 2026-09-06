import { describe, expect, test } from "bun:test";

import { OSC_52_MAX_PAYLOAD, copyToClipboard, readOsc52 } from "./clipboard.ts";

const encode = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe("a program asking for the clipboard", () => {
  test("a write within the bound is honoured, whatever selection it names", () => {
    expect(readOsc52(`c;${encode("copied by the program")}`)).toEqual({
      kind: "write",
      text: "copied by the program",
    });
    expect(readOsc52(`p;${encode("primary")}`)).toEqual({ kind: "write", text: "primary" });
    expect(readOsc52(`;${encode("no selection named")}`)).toEqual({ kind: "write", text: "no selection named" });
  });

  test("non-ASCII survives the round trip as the bytes it was", () => {
    expect(readOsc52(`c;${encode("路径 → ~/项目")}`)).toEqual({ kind: "write", text: "路径 → ~/项目" });
  });

  test("an empty payload clears rather than being read as malformed", () => {
    expect(readOsc52("c;")).toEqual({ kind: "write", text: "" });
  });

  test("a read request is refused, and the refusal sends nothing back", () => {
    expect(readOsc52("c;?")).toEqual({ kind: "read-refused" });
    expect(readOsc52(";?")).toEqual({ kind: "read-refused" });
  });

  test("a payload past the bound is rejected rather than truncated onto the clipboard", () => {
    expect(readOsc52(`c;${"A".repeat(OSC_52_MAX_PAYLOAD + 1)}`)).toEqual({ kind: "rejected", why: "too-long" });
    expect(readOsc52(`c;${"A".repeat(OSC_52_MAX_PAYLOAD)}`).kind).toBe("write");
  });

  test("a payload that is not base64, or a sequence with no selection field, is rejected", () => {
    expect(readOsc52("c;not base64!")).toEqual({ kind: "rejected", why: "not-base64" });
    expect(readOsc52("nonsense")).toEqual({ kind: "rejected", why: "malformed" });
  });
});

describe("putting a selection on the clipboard", () => {
  test("says it copied", async () => {
    const written: string[] = [];
    expect(await copyToClipboard("hello", { writeText: async (text) => void written.push(text) })).toBe("copied");
    expect(written).toEqual(["hello"]);
  });

  test("a refusal and an absent clipboard are different words", async () => {
    expect(
      await copyToClipboard("hello", {
        writeText: async () => {
          throw new Error("the user denied clipboard access");
        },
      }),
    ).toBe("refused");
    expect(await copyToClipboard("hello", undefined)).toBe("unavailable");
  });

  test("an empty selection is not a copy and does not touch the clipboard", async () => {
    let called = false;
    expect(
      await copyToClipboard("", {
        writeText: async () => {
          called = true;
        },
      }),
    ).toBe("empty");
    expect(called).toBe(false);
  });
});
