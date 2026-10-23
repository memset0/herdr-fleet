import { fleetCjkFallback, fleetUiCjkFallback } from "../../../fleet/ui/webfonts.ts";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FROM_BROWSER, readBrowserMessage } from "../../../fleet/terminal/browser.ts";

interface OscHandler {
  (data: string): boolean;
}

/** The options the surface passes the terminal, as the fake needs to read them back. */
interface FakeTerminalOptions {
  readonly disableStdin?: boolean;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  readonly scrollback?: number;
}

class FakeTerminal {
  static instances: FakeTerminal[] = [];
  readonly options: FakeTerminalOptions;
  /** How many times the surface asked for a fresh DOM measurement. */
  opened = 0;
  readonly written: Uint8Array[] = [];
  readonly dataHandlers: ((data: string) => void)[] = [];
  readonly oscHandlers = new Map<number, OscHandler>();
  modes = { mouseTrackingMode: "none", bracketedPasteMode: false };
  selection = "";
  disposed = false;
  readonly parsedHandlers = new Set<() => void>();
  readonly viewport = { width: 800, height: 600 };
  /** The emulator's own element, where its wheel listeners live, and the row count it draws. */
  element: HTMLElement | undefined;
  rows = 30;
  readonly wheels: WheelEvent[] = [];
  readonly parser = {
    registerOscHandler: (id: number, handler: OscHandler) => {
      this.oscHandlers.set(id, handler);
      return { dispose: () => undefined };
    },
  };

  constructor(options: FakeTerminalOptions) {
    this.options = options;
    FakeTerminal.instances.push(this);
  }

  loadAddon(): void {}
  open(element: HTMLElement): void {
    this.opened += 1;
    if (this.element === undefined) {
      const own = document.createElement("div");
      const screenElement = document.createElement("div");
      screenElement.className = "xterm-screen";
      // Thirty rows of 20px: one cell is 20px of finger travel.
      Object.defineProperty(screenElement, "clientHeight", { configurable: true, get: () => this.rows * 20 });
      own.append(screenElement);
      own.addEventListener("wheel", (event) => this.wheels.push(event));
      element.append(own);
      this.element = own;
    }
    Object.defineProperties(element, {
      clientWidth: { configurable: true, get: () => this.viewport.width },
      clientHeight: { configurable: true, get: () => this.viewport.height },
    });
  }
  focus(): void {}
  write(data: Uint8Array): void {
    this.written.push(data);
  }
  onWriteParsed(handler: () => void) {
    this.parsedHandlers.add(handler);
    return { dispose: () => this.parsedHandlers.delete(handler) };
  }
  onData(handler: (data: string) => void) {
    this.dataHandlers.push(handler);
    return { dispose: () => undefined };
  }
  getSelection(): string {
    return this.selection;
  }
  dispose(): void {
    this.disposed = true;
  }
}

let proposed: { cols: number; rows: number } | undefined = { cols: 100, rows: 30 };

class FakeFitAddon {
  proposeDimensions() {
    return proposed;
  }
  fit(): void {}
}

class FakeSocket {
  static instances: FakeSocket[] = [];
  binaryType = "";
  readonly sent: ArrayBuffer[] = [];
  closed = false;
  private readonly listeners = new Map<string, ((event: { data: unknown }) => void)[]>();

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(data: ArrayBuffer): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  addEventListener(type: string, handler: (event: { data: unknown }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  fire(type: string, event: { data: unknown } = { data: undefined }): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
  frames() {
    return this.sent.map((buffer) => readBrowserMessage(new Uint8Array(buffer)));
  }
}


vi.mock("@xterm/xterm", () => ({ Terminal: FakeTerminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: FakeFitAddon }));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import { DEAD_DEBOUNCE_MS, LIVE_CAP_MS, isLive } from "@/lib/liveness";
import { TERMINAL_COMPOSER_STORAGE_KEY, terminalComposerPreference } from "../../../fleet/ui/terminal/composer.ts";
import { terminalSpacingPreference } from "../../../fleet/ui/terminal/spacing.ts";

const { FleetTerminal } = await import("./fleet-terminal");

const writeText = vi.fn<(text: string) => Promise<void>>();

let paneCounter = 0;
/** Every live ResizeObserver callback, so a rotation or a type-size change can be driven by hand. */
const resizes: (() => void)[] = [];

const bodyControls = {
  zen: false,
  find: { open: false, query: "", current: 0, onMatchCount: () => undefined },
  onOutputChange: () => undefined,
};

function mount(over: { readOnly?: boolean } = {}) {
  paneCounter += 1;
  const paneId = `w1:p${paneCounter}`;
  const view = render(
    <FleetTerminal
      paneId={paneId}
      scope={{}}
      {...bodyControls}
      readOnly={over.readOnly === true}
      device={over.readOnly === true ? { enforced: true, device: "phone", authorized: false } : undefined}
    />,
  );
  const socket = FakeSocket.instances.at(-1)!;
  const terminal = FakeTerminal.instances.at(-1)!;
  return { view, socket, terminal, paneId };
}

beforeEach(() => {
  act(() => { fleetCjkFallback.set("none"); fleetCjkFallback.setOnly(false); fleetUiCjkFallback.set("none"); fleetUiCjkFallback.setOnly(false); });
  FakeTerminal.instances.length = 0;
  FakeSocket.instances.length = 0;
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  proposed = { cols: 100, rows: 30 };
  vi.stubGlobal("WebSocket", FakeSocket);
  resizes.length = 0;
  act(() => terminalComposerPreference.set(false));
  act(() => {
    terminalSpacingPreference.set("lineHeight", null);
    terminalSpacingPreference.set("letterSpacing", null);
  });
  // jsdom ships no FontFaceSet, which is why the surface reaches for it optionally. The one case
  // that is ABOUT fonts arriving needs one, so it gets the two members the surface uses.
  // SAFETY: the object is an EventTarget and the line below gives it the only other member the
  // surface touches, so the asserted shape is the shape it has by the time anything reads it.
  const fonts = new EventTarget() as EventTarget & { ready: Promise<unknown> };
  fonts.ready = Promise.resolve();
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizes.push(callback);
      }
      observe(): void {}
      disconnect(): void {}
    },
  );
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("the face it draws and measures with", () => {
  it("is the operator's own two font settings, resolved — never a custom property", () => {
    document.documentElement.style.setProperty(
      "--font-mono",
      '"Nerd Font Symbols", "JetBrains Mono", var(--font-cjk), monospace',
    );
    act(() => fleetCjkFallback.set("maple-mono-cn"));
    const { terminal } = mount();
    expect(terminal.options.fontFamily).toBe(
      '"Nerd Font Symbols", "JetBrains Mono", "Maple Mono NF CN", monospace',
    );
    // A grid measured from an unresolved term is a grid measured from nothing.
    expect(terminal.options.fontFamily).not.toContain("var(");
    expect(terminal.options.fontSize).toBe(10);
  });

  it("measures again when a font finishes loading, because that is what spaces the letters out", () => {
    const { terminal, socket } = mount();
    socket.fire("open");
    const measured = terminal.opened;
    proposed = { cols: 80, rows: 24 };
    document.fonts.dispatchEvent(new Event("loadingdone"));
    // `open` is the emulator's own "measure again"; without it the cell keeps the width it was
    // given before the face arrived, and the narrower glyphs sit inside it.
    expect(terminal.opened).toBeGreaterThan(measured);
    expect(socket.frames().at(-1)).toEqual({ kind: "viewport", viewport: { columns: 80, rows: 24 } });
  });

  it("starts at the defaults, and a spacing change is applied in place and refitted live", () => {
    const { terminal, socket } = mount();
    expect(terminal.options.lineHeight).toBe(1);
    expect(terminal.options.letterSpacing).toBe(0);
    socket.fire("open");
    const measured = terminal.opened;
    proposed = { cols: 90, rows: 20 };
    act(() => {
      terminalSpacingPreference.set("lineHeight", 1.5);
      terminalSpacingPreference.set("letterSpacing", 1);
    });
    // The same instance and the same connection: the screen is kept, nothing reconnects.
    expect(FakeTerminal.instances).toHaveLength(1);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(terminal.options.lineHeight).toBe(1.5);
    expect(terminal.options.letterSpacing).toBe(1);
    expect(terminal.opened).toBeGreaterThan(measured);
    expect(socket.frames().at(-1)).toEqual({ kind: "viewport", viewport: { columns: 90, rows: 20 } });
  });
});

describe("connecting", () => {
  it("opens one same-origin connection naming the Pane, and states the viewport first", () => {
    const { socket, paneId } = mount();
    const url = new URL(socket.url);
    expect(url.protocol).toBe("ws:");
    expect(url.pathname).toBe("/fleet/api/terminal");
    expect(url.searchParams.get("pane")).toBe(paneId);
    expect([...url.searchParams.keys()]).toEqual(["pane"]);

    socket.fire("open");
    expect(socket.frames()).toEqual([{ kind: "viewport", viewport: { columns: 100, rows: 30 } }]);
  });

  it("makes the geometry legible, because it has just taken somebody else's terminal", async () => {
    const { socket } = mount();
    socket.fire("open");
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-geometry").textContent).toBe("100×30"));
  });

  it("writes terminal output to the terminal and nowhere else", () => {
    const { socket, terminal } = mount();
    socket.fire("open");
    const frame = new Uint8Array([0x6f, 0x68, 0x69]);
    socket.fire("message", { data: frame.buffer.slice(0) });
    expect(terminal.written).toHaveLength(1);
    expect(new TextDecoder().decode(terminal.written[0]!)).toBe("hi");
  });

  // Collie 1.18 withholds a Pane's structural rows (rename, close, focus) unless the Pane is live,
  // and only the mirror's read marks it. The terminal's open stream is this surface's read.
  it("marks the Pane live while its stream is open, and not live once it closes", async () => {
    vi.useFakeTimers();
    try {
      const { socket, paneId } = mount();
      expect(isLive(paneId, {})).toBe(false);
      socket.fire("open");
      expect(isLive(paneId, {})).toBe(true);
      // Kept live past Collie's own cap while the stream stays open.
      act(() => vi.advanceTimersByTime(LIVE_CAP_MS + 1_000));
      expect(isLive(paneId, {})).toBe(true);
      socket.fire("close");
      act(() => vi.advanceTimersByTime(DEAD_DEBOUNCE_MS + 10));
      expect(isLive(paneId, {})).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the Gateway's lifecycle word when it ends the connection", async () => {
    const { socket } = mount();
    socket.fire("open");
    const notice = new Uint8Array([0x6e, ...new TextEncoder().encode("busy")]);
    socket.fire("message", { data: notice.buffer.slice(0) });
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-notice").textContent).toBe("busy"));
  });
});

describe("the viewport while attached", () => {
  it("is restated when the browser is resized, rotated, or its type size changes", async () => {
    const { socket } = mount();
    socket.fire("open");
    expect(socket.frames()).toHaveLength(1);

    proposed = { cols: 60, rows: 80 };
    for (const fire of resizes) fire();
    expect(socket.frames()).toEqual([
      { kind: "viewport", viewport: { columns: 100, rows: 30 } },
      { kind: "viewport", viewport: { columns: 60, rows: 80 } },
    ]);
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-geometry").textContent).toBe("60×80"));
  });

  it("is not restated when nothing about it changed", () => {
    const { socket } = mount();
    socket.fire("open");
    for (const fire of resizes) fire();
    expect(socket.frames()).toHaveLength(1);
  });
});

describe("typing", () => {
  it("reaches the terminal once the connection is open", () => {
    const { socket, terminal } = mount();
    socket.fire("open");
    terminal.dataHandlers[0]!("ls\n");
    const frames = socket.sent.map((buffer) => new Uint8Array(buffer));
    expect(frames[1]![0]).toBe(FROM_BROWSER.input);
    expect(new TextDecoder().decode(frames[1]!.subarray(1))).toBe("ls\n");
  });

  it("is not wired at all on a device that may not write, and the surface says so", () => {
    const { terminal } = mount({ readOnly: true });
    expect(terminal.dataHandlers).toHaveLength(0);
    expect(terminal.options.disableStdin).toBe(true);
    expect(screen.getByTestId("fleet-terminal-readonly")).toBeInTheDocument();
  });
});

describe("the clipboard", () => {
  it("copies a completed selection and says it did", async () => {
    const { terminal } = mount();
    terminal.selection = "some terminal text";
    fireEvent.pointerUp(screen.getByTestId("fleet-terminal-host"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("some terminal text"));
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-copy").textContent).toBe("Copied"));
  });

  it("reports a refusal and leaves the selection where it is", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { terminal } = mount();
    terminal.selection = "still selected";
    fireEvent.pointerUp(screen.getByTestId("fleet-terminal-host"));
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-copy").textContent).toContain("refused"));
    expect(terminal.selection).toBe("still selected");
  });

  it("is the document's own — the terminal is never inside a frame", () => {
    const { view } = mount();
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("copies nothing when nothing is selected", () => {
    mount();
    fireEvent.pointerUp(screen.getByTestId("fleet-terminal-host"));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("honours a program's copy request and refuses its read request", async () => {
    const { terminal } = mount();
    const handler = terminal.oscHandlers.get(52)!;
    expect(handler).toBeTypeOf("function");
    expect(handler(`c;${btoa("from the program")}`)).toBe(true);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("from the program"));
    writeText.mockClear();
    expect(handler("c;?")).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("a drag that does nothing", () => {
  it("explains itself when the program is consuming mouse events", async () => {
    const { terminal } = mount();
    terminal.modes.mouseTrackingMode = "vt200";
    fireEvent.pointerDown(screen.getByTestId("fleet-terminal-host"));
    await waitFor(() => expect(screen.getByTestId("fleet-terminal-shift-hint")).toBeInTheDocument());
  });

  it("says nothing when the modifier is already held, or when nothing is consuming them", () => {
    const { terminal } = mount();
    terminal.modes.mouseTrackingMode = "vt200";
    fireEvent.pointerDown(screen.getByTestId("fleet-terminal-host"), { shiftKey: true });
    expect(screen.queryByTestId("fleet-terminal-shift-hint")).toBeNull();

    terminal.modes.mouseTrackingMode = "none";
    fireEvent.pointerDown(screen.getByTestId("fleet-terminal-host"));
    expect(screen.queryByTestId("fleet-terminal-shift-hint")).toBeNull();
  });
});

describe("a swipe on a touch screen", () => {
  const touch = (clientX: number, clientY: number) => ({ clientX, clientY });

  it("reaches the emulator as one wheel step per cell, at the swipe's start, and keeps the page still", () => {
    const { terminal } = mount();
    const host = screen.getByTestId("fleet-terminal-host");
    fireEvent.touchStart(host, { touches: [touch(50, 300)] });
    const moved = fireEvent.touchMove(host, { touches: [touch(52, 240)] });
    // Finger up three cells: three wheel-DOWN lines, the path a desktop wheel takes.
    expect(terminal.wheels.map((event) => [event.deltaY, event.deltaMode, event.clientX, event.clientY])).toEqual([
      [1, 1, 50, 300],
      [1, 1, 50, 300],
      [1, 1, 50, 300],
    ]);
    expect(moved).toBe(false);
    fireEvent.touchMove(host, { touches: [touch(52, 290)] });
    expect(terminal.wheels.slice(3).map((event) => event.deltaY)).toEqual([-1, -1]);
    fireEvent.touchEnd(host, { touches: [] });
  });

  it("leaves a tap, a sideways swipe and a pinch to the browser", () => {
    const { terminal } = mount();
    const host = screen.getByTestId("fleet-terminal-host");
    fireEvent.touchStart(host, { touches: [touch(50, 300)] });
    expect(fireEvent.touchMove(host, { touches: [touch(53, 304)] })).toBe(true);
    fireEvent.touchEnd(host, { touches: [] });

    fireEvent.touchStart(host, { touches: [touch(50, 300)] });
    expect(fireEvent.touchMove(host, { touches: [touch(150, 280)] })).toBe(true);
    fireEvent.touchEnd(host, { touches: [] });

    fireEvent.touchStart(host, { touches: [touch(50, 300), touch(80, 300)] });
    expect(fireEvent.touchMove(host, { touches: [touch(50, 100), touch(80, 100)] })).toBe(true);
    fireEvent.touchEnd(host, { touches: [] });
    expect(terminal.wheels).toHaveLength(0);
  });
});

describe("leaving and coming back", () => {
  it("keeps the terminal, so a return is a return and not an opening", () => {
    const { view, socket, terminal, paneId } = mount();
    socket.fire("open");
    view.unmount();
    expect(terminal.disposed).toBe(false);

    render(
      <FleetTerminal paneId={paneId} scope={{}} {...bodyControls} device={undefined} readOnly={false} />,
    );
    expect(FakeTerminal.instances).toHaveLength(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("does not resize a held terminal from a detached host", () => {
    const { view, socket, paneId } = mount();
    socket.fire("open");
    const oldReport = resizes.at(-1)!;
    view.unmount();
    proposed = { cols: 2, rows: 1 };
    oldReport();
    expect(socket.frames()).toEqual([{ kind: "viewport", viewport: { columns: 100, rows: 30 } }]);

    proposed = { cols: 80, rows: 24 };
    render(<FleetTerminal paneId={paneId} scope={{}} {...bodyControls} device={undefined} readOnly={false} />);
    expect(socket.frames().at(-1)).toEqual({ kind: "viewport", viewport: { columns: 80, rows: 24 } });
    proposed = { cols: 20, rows: 5 };
    oldReport();
    expect(socket.frames()).toHaveLength(2);
    resizes.at(-1)!();
    expect(socket.frames().at(-1)).toEqual({ kind: "viewport", viewport: { columns: 20, rows: 5 } });
  });

  it("waits for a real content area and then reports even a valid minimum viewport", () => {
    const { socket, terminal } = mount();
    socket.fire("open");
    terminal.viewport.width = 0;
    terminal.viewport.height = 0;
    proposed = { cols: 20, rows: 5 };
    resizes.at(-1)!();
    expect(socket.frames()).toEqual([{ kind: "viewport", viewport: { columns: 100, rows: 30 } }]);
    terminal.viewport.width = 128;
    terminal.viewport.height = 80;
    resizes.at(-1)!();
    expect(socket.frames().at(-1)).toEqual({ kind: "viewport", viewport: { columns: 20, rows: 5 } });
  });

  it("offers to reconnect in place once the connection closed, and opens one new connection", async () => {
    const { view, socket, paneId } = mount();
    socket.fire("open");
    expect(view.container.querySelector('[data-testid="fleet-terminal-reconnect"]')).toBeNull();
    socket.fire("close");
    const button = await waitFor(() => {
      const found = view.container.querySelector<HTMLButtonElement>('[data-testid="fleet-terminal-reconnect"]');
      expect(found?.textContent).toBe("Reconnect");
      return found!;
    });
    expect(view.container.textContent).toContain("The terminal connection ended.");
    fireEvent.click(button);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1]!.url).toContain(`pane=${encodeURIComponent(paneId)}`);
    expect(FakeTerminal.instances).toHaveLength(2);
    await waitFor(() => expect(view.container.querySelector('[data-testid="fleet-terminal-reconnect"]')).toBeNull());
  });

  it("offers Take over on a busy notice, and only there it asks to displace the holder", async () => {
    const { view, socket } = mount();
    socket.fire("open");
    const busy = new Uint8Array([0x6e, ...new TextEncoder().encode("busy")]);
    act(() => {
      socket.fire("message", { data: busy.buffer.slice(0) });
      socket.fire("close");
    });
    const button = await waitFor(() => {
      const found = view.container.querySelector<HTMLButtonElement>('[data-testid="fleet-terminal-take-over"]');
      expect(found?.textContent).toBe("Take over");
      return found!;
    });
    expect(FakeSocket.instances[0]!.url).not.toContain("takeover");
    fireEvent.click(button);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1]!.url).toContain("takeover=1");

    // Displaced: its own sentence and Reconnect, never Take over, and a reconnect asks for nothing.
    const taken = new Uint8Array([0x6e, ...new TextEncoder().encode("taken")]);
    act(() => {
      FakeSocket.instances[1]!.fire("message", { data: taken.buffer.slice(0) });
      FakeSocket.instances[1]!.fire("close");
    });
    await waitFor(() => expect(view.container.textContent).toContain("Another browser took over this terminal."));
    expect(view.container.querySelector('[data-testid="fleet-terminal-take-over"]')).toBeNull();
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-testid="fleet-terminal-reconnect"]')!);
    expect(FakeSocket.instances[2]!.url).not.toContain("takeover");
  });

  it("builds a new one when the connection ended while it was away", () => {
    const { view, socket, paneId } = mount();
    socket.fire("open");
    socket.fire("close");
    view.unmount();

    render(
      <FleetTerminal paneId={paneId} scope={{}} {...bodyControls} device={undefined} readOnly={false} />,
    );
    expect(FakeTerminal.instances).toHaveLength(2);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});


it("updates real terminal font measurement when its exclusive mode changes, independently of UI", async () => {
  document.documentElement.style.setProperty("--font-mono", '"Nerd Font Symbols", "JetBrains Mono", var(--font-cjk), monospace');
  const { terminal } = mount();
  act(() => fleetCjkFallback.set("maple-mono-cn"));
  await waitFor(() => expect(terminal.options.fontFamily).toContain("Maple Mono NF CN"));
  expect(terminal.options.fontFamily).toContain("JetBrains Mono");
  act(() => fleetCjkFallback.setOnly(true));
  await waitFor(() => expect(terminal.options.fontFamily).not.toContain("JetBrains Mono"));
  expect(terminal.options.fontFamily).toContain("Nerd Font Symbols");
  const family = terminal.options.fontFamily;
  act(() => { fleetUiCjkFallback.set("lxgw-wenkai"); fleetUiCjkFallback.setOnly(true); });
  expect(terminal.options.fontFamily).toBe(family);
  act(() => fleetCjkFallback.set("none"));
  await waitFor(() => expect(terminal.options.fontFamily).toContain("JetBrains Mono"));
  expect(terminal.options.fontFamily).not.toContain("Maple Mono NF CN");
});

describe("the input box under the terminal", () => {
  const output = (socket: FakeSocket): void => {
    const frame = new Uint8Array([0x6f, 0x24]);
    socket.fire("message", { data: frame.buffer.slice(0) });
  };
  const inputs = (socket: FakeSocket): string[] =>
    socket.frames().flatMap((frame) => (frame.kind === "input" ? [new TextDecoder().decode(frame.data)] : []));
  const sendButton = (container: HTMLElement) =>
    container.querySelector<HTMLButtonElement>('[data-testid="fleet-terminal-composer-send"]');

  it("is shown by its toggle, remembered on this device, and absent on a read-only one", () => {
    const { view } = mount();
    expect(view.container.querySelector('[data-testid="fleet-terminal-composer"]')).toBeNull();
    const toggle = view.container.querySelector<HTMLButtonElement>('[aria-label="Input box"]')!;
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.querySelector('[data-testid="fleet-terminal-composer"]')).not.toBeNull();
    expect(window.localStorage.getItem(TERMINAL_COMPOSER_STORAGE_KEY)).toBe("1");
    view.unmount();

    const readOnly = mount({ readOnly: true });
    expect(readOnly.view.container.querySelector('[aria-label="Input box"]')).toBeNull();
    expect(readOnly.view.container.querySelector('[data-testid="fleet-terminal-composer"]')).toBeNull();
  });

  it("refuses to send until the terminal answers, and keeps the draft when it closes", async () => {
    act(() => terminalComposerPreference.set(true));
    const { view, socket } = mount();
    const field = view.container.querySelector("textarea")!;
    fireEvent.change(field, { target: { value: "hello" } });
    expect(sendButton(view.container)!.disabled).toBe(true);
    socket.fire("open");
    expect(sendButton(view.container)!.disabled).toBe(true);
    act(() => output(socket));
    await waitFor(() => expect(sendButton(view.container)!.disabled).toBe(false));
    act(() => socket.fire("close"));
    await waitFor(() => expect(sendButton(view.container)!.disabled).toBe(true));
    expect(field.value).toBe("hello");
    expect(inputs(socket)).toEqual([]);
  });

  it("writes the draft and then Enter, and clears only after the write", async () => {
    act(() => terminalComposerPreference.set(true));
    const { view, socket } = mount();
    socket.fire("open");
    act(() => output(socket));
    const field = view.container.querySelector("textarea")!;
    fireEvent.change(field, { target: { value: "line one\nline two" } });
    await waitFor(() => expect(sendButton(view.container)!.disabled).toBe(false));
    fireEvent.keyDown(field, { key: "Enter" });
    expect(inputs(socket)).toEqual([]);
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(inputs(socket)).toEqual(["line one\rline two", "\r"]));
    await waitFor(() => expect(field.value).toBe(""));
  });
});
