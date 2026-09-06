import { describe, expect, test } from "bun:test";

import {
  CLIENT,
  SERVER,
  authFrame,
  decodeServerFrame,
  inputFrame,
  resizeFrame,
} from "./protocol.ts";

const decoder = new TextDecoder();

/**
 * The recorded shape, taken from the terminal server's own shipped frontend rather than from a live
 * server: that frontend is what the server is known to interoperate with, and pinning it here means a
 * server upgrade that changes the wire fails this file rather than a live terminal.
 */
const RECORDED = {
  serverEnum: { OUTPUT: "0", SET_WINDOW_TITLE: "1", SET_PREFERENCES: "2" },
  clientEnum: { INPUT: "0", RESIZE_TERMINAL: "1", PAUSE: "2", RESUME: "3" },
  firstFrame: (token: string, columns: number, rows: number) =>
    JSON.stringify({ AuthToken: token, columns, rows }),
  resizePayload: (columns: number, rows: number) => JSON.stringify({ columns, rows }),
};

describe("terminal wire constants", () => {
  test("match the command characters the server's own frontend uses", () => {
    expect(String.fromCharCode(SERVER.output)).toBe(RECORDED.serverEnum.OUTPUT);
    expect(String.fromCharCode(SERVER.title)).toBe(RECORDED.serverEnum.SET_WINDOW_TITLE);
    expect(String.fromCharCode(SERVER.preferences)).toBe(RECORDED.serverEnum.SET_PREFERENCES);
    expect(String.fromCharCode(CLIENT.input)).toBe(RECORDED.clientEnum.INPUT);
    expect(String.fromCharCode(CLIENT.resize)).toBe(RECORDED.clientEnum.RESIZE_TERMINAL);
    expect(String.fromCharCode(CLIENT.pause)).toBe(RECORDED.clientEnum.PAUSE);
    expect(String.fromCharCode(CLIENT.resume)).toBe(RECORDED.clientEnum.RESUME);
  });

  test("output and input share a byte, which is why direction has to disambiguate", () => {
    expect(SERVER.output).toBe(CLIENT.input);
  });
});

describe("frames the Gateway sends", () => {
  test("the first frame authenticates and states the geometry together", () => {
    const frame = authFrame("", { columns: 100, rows: 30 });
    expect(decoder.decode(frame)).toBe(RECORDED.firstFrame("", 100, 30));
  });

  test("the first frame carries a token when there is one", () => {
    expect(decoder.decode(authFrame("abc", { columns: 80, rows: 24 })))
      .toBe(RECORDED.firstFrame("abc", 80, 24));
  });

  test("input is prefixed and otherwise verbatim, bytes and all", () => {
    const bytes = new Uint8Array([0x1b, 0x5b, 0x41, 0x00, 0xff, 0xc3, 0xa9]);
    const frame = inputFrame(bytes);
    expect(frame[0]).toBe(CLIENT.input);
    expect([...frame.subarray(1)]).toEqual([...bytes]);
  });

  test("empty input still produces a well-formed frame", () => {
    const frame = inputFrame(new Uint8Array());
    expect(frame.length).toBe(1);
    expect(frame[0]).toBe(CLIENT.input);
  });

  test("resize carries the geometry as the server's own JSON", () => {
    const frame = resizeFrame({ columns: 120, rows: 40 });
    expect(frame[0]).toBe(CLIENT.resize);
    expect(decoder.decode(frame.subarray(1))).toBe(RECORDED.resizePayload(120, 40));
  });
});

describe("frames the Gateway reads", () => {
  test("output is returned as bytes, not text", () => {
    const payload = new Uint8Array([0x1b, 0x5b, 0x32, 0x4a, 0xff]);
    const read = decodeServerFrame(inputFrame(payload)); // same byte, server direction
    expect(read.kind).toBe("output");
    if (read.kind !== "output") throw new Error("unreachable");
    expect([...read.data]).toEqual([...payload]);
  });

  test("a title frame decodes its text", () => {
    const frame = new Uint8Array([SERVER.title, ...new TextEncoder().encode("root@host: ~")]);
    const read = decodeServerFrame(frame);
    expect(read).toEqual({ kind: "title", title: "root@host: ~" });
  });

  test("preferences are kept raw rather than parsed here", () => {
    const frame = new Uint8Array([SERVER.preferences, ...new TextEncoder().encode('{"fontSize":13}')]);
    const read = decodeServerFrame(frame);
    expect(read).toEqual({ kind: "preferences", raw: '{"fontSize":13}' });
  });

  test("an unknown command is reported rather than thrown, so a live terminal survives it", () => {
    const read = decodeServerFrame(new Uint8Array([0x39, 0x61]));
    expect(read).toEqual({ kind: "unknown", command: 0x39 });
  });

  test("an empty frame is reported the same way", () => {
    expect(decodeServerFrame(new Uint8Array())).toEqual({ kind: "unknown", command: -1 });
  });

  test("a frame with a command and no payload decodes to an empty payload", () => {
    const read = decodeServerFrame(new Uint8Array([SERVER.output]));
    expect(read.kind).toBe("output");
    if (read.kind !== "output") throw new Error("unreachable");
    expect(read.data.length).toBe(0);
  });
});
