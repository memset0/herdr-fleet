import { describe, expect, test } from "bun:test";

import {
  TO_BROWSER,
  VIEWPORT_BOUNDS,
  inputMessage,
  noticeFrame,
  outputFrame,
  readBrowserMessage,
  titleFrame,
  viewportMessage,
} from "./browser.ts";

const encoder = new TextEncoder();

describe("what a browser may send", () => {
  test("terminal input, verbatim and as bytes", () => {
    const bytes = new Uint8Array([0x1b, 0x5b, 0x41, 0x00, 0xff]);
    const read = readBrowserMessage(inputMessage(bytes));
    expect(read.kind).toBe("input");
    if (read.kind !== "input") throw new Error("unreachable");
    expect([...read.data]).toEqual([...bytes]);
  });

  test("a viewport within bounds", () => {
    expect(readBrowserMessage(viewportMessage({ columns: 100, rows: 30 })))
      .toEqual({ kind: "viewport", viewport: { columns: 100, rows: 30 } });
  });

  test("input that is not valid UTF-8 survives the round trip", () => {
    const lone = new Uint8Array([0xc3]);
    const read = readBrowserMessage(inputMessage(lone));
    if (read.kind !== "input") throw new Error("unreachable");
    expect([...read.data]).toEqual([0xc3]);
  });
});

describe("what a browser may not send", () => {
  test("a third message kind is rejected rather than forwarded", () => {
    expect(readBrowserMessage(new Uint8Array([0x70, 1, 2])))
      .toEqual({ kind: "rejected", why: "unknown-command" });
  });

  test("the terminal server's own pause and resume are not part of this grammar", () => {
    // "2" and "3" are that protocol's PAUSE and RESUME. They mean nothing here.
    expect(readBrowserMessage(new Uint8Array([0x32])).kind).toBe("rejected");
    expect(readBrowserMessage(new Uint8Array([0x33])).kind).toBe("rejected");
  });

  test("an empty frame is rejected", () => {
    expect(readBrowserMessage(new Uint8Array())).toEqual({ kind: "rejected", why: "empty" });
  });
});

describe("the viewport's bounds", () => {
  test.each([
    ["too few columns", VIEWPORT_BOUNDS.minColumns - 1, 30],
    ["too many columns", VIEWPORT_BOUNDS.maxColumns + 1, 30],
    ["too few rows", 100, VIEWPORT_BOUNDS.minRows - 1],
    ["too many rows", 100, VIEWPORT_BOUNDS.maxRows + 1],
  ])("%s is refused, never clamped", (_label, columns, rows) => {
    expect(readBrowserMessage(viewportMessage({ columns, rows })))
      .toEqual({ kind: "rejected", why: "viewport-out-of-range" });
  });

  test("the bounds themselves are accepted", () => {
    const { minColumns, maxColumns, minRows, maxRows } = VIEWPORT_BOUNDS;
    expect(readBrowserMessage(viewportMessage({ columns: minColumns, rows: minRows })).kind).toBe("viewport");
    expect(readBrowserMessage(viewportMessage({ columns: maxColumns, rows: maxRows })).kind).toBe("viewport");
  });

  test.each([
    ["not JSON", "not json at all"],
    ["not an object", "42"],
    ["an array", "[100,30]"],
    ["missing rows", '{"columns":100}'],
    ["fractional", '{"columns":100.5,"rows":30}'],
    ["a string", '{"columns":"100","rows":"30"}'],
    ["null", "null"],
  ])("a %s viewport is rejected", (_label, body) => {
    const frame = new Uint8Array([0x76, ...encoder.encode(body)]);
    expect(readBrowserMessage(frame)).toEqual({ kind: "rejected", why: "malformed-viewport" });
  });
});

describe("what the Gateway sends back", () => {
  test("output carries bytes under its own command", () => {
    const frame = outputFrame(new Uint8Array([1, 2, 3]));
    expect(frame[0]).toBe(TO_BROWSER.output);
    expect([...frame.subarray(1)]).toEqual([1, 2, 3]);
  });

  test("a title and a notice are distinguishable from output and from each other", () => {
    expect(titleFrame("root@host")[0]).toBe(TO_BROWSER.title);
    expect(noticeFrame("this terminal has closed")[0]).toBe(TO_BROWSER.notice);
    expect(TO_BROWSER.title).not.toBe(TO_BROWSER.output);
    expect(TO_BROWSER.notice).not.toBe(TO_BROWSER.output);
  });
});
