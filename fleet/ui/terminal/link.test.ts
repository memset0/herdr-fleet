import { describe, expect, test } from "bun:test";

import { FROM_BROWSER, TO_BROWSER, VIEWPORT_BOUNDS, readBrowserMessage } from "../../terminal/browser.ts";
import { TerminalLink, boundedViewport, terminalUrl, type SocketLike } from "./link.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fakeSocket() {
  const listeners = new Map<string, ((event: { data: unknown }) => void)[]>();
  const sent: Uint8Array[] = [];
  let closed = false;
  const socket: SocketLike = {
    binaryType: "",
    send: (data) => {
      sent.push(new Uint8Array(data instanceof ArrayBuffer ? data : new Uint8Array()));
    },
    close: () => {
      closed = true;
    },
    addEventListener: (type: string, handler: (event: { data: unknown }) => void) => {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
  };
  const fire = (type: string, event: { data: unknown } = { data: undefined }) => {
    for (const handler of listeners.get(type) ?? []) handler(event);
  };
  return {
    socket,
    sent,
    closed: () => closed,
    messages: () => sent.map((frame) => readBrowserMessage(frame)),
    open: () => fire("open"),
    deliver: (frame: Uint8Array) => fire("message", { data: frame.buffer.slice(0) }),
    end: () => fire("close"),
    fail: () => fire("error"),
  };
}

function handlers() {
  const output: string[] = [];
  const titles: string[] = [];
  const notices: string[] = [];
  let opened = 0;
  let closed = 0;
  return {
    record: {
      onOpen: () => {
        opened += 1;
      },
      onOutput: (data: Uint8Array) => output.push(decoder.decode(data)),
      onTitle: (title: string) => titles.push(title),
      onNotice: (notice: string) => notices.push(notice),
      onClose: () => {
        closed += 1;
      },
    },
    output,
    titles,
    notices,
    opened: () => opened,
    closed: () => closed,
  };
}

describe("the address a browser connects at", () => {
  test("is the app's own origin, upgraded, naming the Pane and nothing else", () => {
    expect(terminalUrl("https://fleet.example.com", "w1:p1")).toBe(
      "wss://fleet.example.com/fleet/api/terminal?pane=w1%3Ap1",
    );
    expect(terminalUrl("http://localhost:8787", "w1:p1")).toBe(
      "ws://localhost:8787/fleet/api/terminal?pane=w1%3Ap1",
    );
  });

  test("carries the scope parameters the app already uses, and only when they are set", () => {
    const url = new URL(terminalUrl("https://fleet.example.com", "w1:p1", { host: "laptop", session: "work" }));
    expect([...url.searchParams.keys()].toSorted()).toEqual(["h", "pane", "s"]);
    expect(url.searchParams.get("h")).toBe("laptop");
    expect(new URL(terminalUrl("https://fleet.example.com", "w1:p1", { host: "", session: undefined })).searchParams
      .size).toBe(1);
  });
});

describe("a viewport this browser may report", () => {
  test("is clamped rather than refused — the Gateway is what refuses one", () => {
    expect(boundedViewport({ columns: 10_000, rows: 10_000 })).toEqual({
      columns: VIEWPORT_BOUNDS.maxColumns,
      rows: VIEWPORT_BOUNDS.maxRows,
    });
    expect(boundedViewport({ columns: 0, rows: 0 })).toEqual({
      columns: VIEWPORT_BOUNDS.minColumns,
      rows: VIEWPORT_BOUNDS.minRows,
    });
    expect(boundedViewport({ columns: Number.NaN, rows: 30.9 })).toEqual({
      columns: VIEWPORT_BOUNDS.minColumns,
      rows: 30,
    });
  });
});

describe("what the link sends", () => {
  test("the first frame is the viewport, held until the socket is open", () => {
    const s = fakeSocket();
    const h = handlers();
    const link = new TerminalLink(s.socket, h.record);
    link.report({ columns: 100, rows: 30 });
    expect(s.sent).toHaveLength(0);
    s.open();
    expect(s.messages()).toEqual([{ kind: "viewport", viewport: { columns: 100, rows: 30 } }]);
    expect(h.opened()).toBe(1);
  });

  test("only the newest viewport is held, so the terminal starts at the size it is now", () => {
    const s = fakeSocket();
    const link = new TerminalLink(s.socket, handlers().record);
    link.report({ columns: 100, rows: 30 });
    link.report({ columns: 120, rows: 40 });
    s.open();
    expect(s.messages()).toEqual([{ kind: "viewport", viewport: { columns: 120, rows: 40 } }]);
  });

  test("a viewport that has not changed is not restated", () => {
    const s = fakeSocket();
    const link = new TerminalLink(s.socket, handlers().record);
    link.report({ columns: 100, rows: 30 });
    s.open();
    link.report({ columns: 100, rows: 30 });
    link.report({ columns: 100.4, rows: 30 });
    expect(s.sent).toHaveLength(1);
    link.report({ columns: 101, rows: 30 });
    expect(s.sent).toHaveLength(2);
    expect(link.geometry()).toEqual({ columns: 101, rows: 30 });
  });

  test("input is sent verbatim once the socket is open, and dropped before it", () => {
    const s = fakeSocket();
    const link = new TerminalLink(s.socket, handlers().record);
    link.type(encoder.encode("early"));
    expect(s.sent).toHaveLength(0);
    link.report({ columns: 100, rows: 30 });
    s.open();
    link.type(encoder.encode("ls\n"));
    link.type(new Uint8Array());
    expect(s.sent).toHaveLength(2);
    expect(s.sent[1]![0]).toBe(FROM_BROWSER.input);
    expect(decoder.decode(s.sent[1]!.subarray(1))).toBe("ls\n");
  });

  test("nothing is sent after it closes", () => {
    const s = fakeSocket();
    const link = new TerminalLink(s.socket, handlers().record);
    link.report({ columns: 100, rows: 30 });
    s.open();
    link.close();
    link.type(encoder.encode("x"));
    link.report({ columns: 120, rows: 40 });
    expect(s.sent).toHaveLength(1);
    expect(s.closed()).toBe(true);
  });
});

describe("what the link hears", () => {
  test("output, a title and a notice each reach their own handler", () => {
    const s = fakeSocket();
    const h = handlers();
    const link = new TerminalLink(s.socket, h.record);
    expect(link.geometry()).toBeNull();
    s.open();
    s.deliver(new Uint8Array([TO_BROWSER.output, ...encoder.encode("hello")]));
    s.deliver(new Uint8Array([TO_BROWSER.title, ...encoder.encode("root@host")]));
    s.deliver(new Uint8Array([TO_BROWSER.notice, ...encoder.encode("busy")]));
    expect(h.output).toEqual(["hello"]);
    expect(h.titles).toEqual(["root@host"]);
    expect(h.notices).toEqual(["busy"]);
  });

  test("a frame in a command nobody defined is ignored rather than guessed at", () => {
    const s = fakeSocket();
    const h = handlers();
    const link = new TerminalLink(s.socket, h.record);
    expect(link.geometry()).toBeNull();
    s.open();
    s.deliver(new Uint8Array([0x7a, 1, 2, 3]));
    s.deliver(new Uint8Array());
    expect(h.output).toEqual([]);
    expect(h.notices).toEqual([]);
  });

  test("a close and an error both end it, exactly once each", () => {
    const closing = fakeSocket();
    const closingHandlers = handlers();
    const closingLink = new TerminalLink(closing.socket, closingHandlers.record);
    expect(closingLink.geometry()).toBeNull();
    closing.end();
    expect(closingHandlers.closed()).toBe(1);

    const failing = fakeSocket();
    const failingHandlers = handlers();
    const failingLink = new TerminalLink(failing.socket, failingHandlers.record);
    expect(failingLink.geometry()).toBeNull();
    failing.fail();
    expect(failingHandlers.closed()).toBe(1);
  });
});
