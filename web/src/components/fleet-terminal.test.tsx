import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FROM_BROWSER, readBrowserMessage } from "../../../fleet/terminal/browser.ts";

interface OscHandler {
  (data: string): boolean;
}

/** The options the surface passes the terminal, as the fake needs to read them back. */
interface FakeTerminalOptions {
  readonly disableStdin?: boolean;
  readonly fontSize?: number;
  readonly scrollback?: number;
}

class FakeTerminal {
  static instances: FakeTerminal[] = [];
  readonly options: FakeTerminalOptions;
  readonly written: Uint8Array[] = [];
  readonly dataHandlers: ((data: string) => void)[] = [];
  readonly oscHandlers = new Map<number, OscHandler>();
  modes = { mouseTrackingMode: "none" };
  selection = "";
  disposed = false;
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
  open(): void {}
  focus(): void {}
  write(data: Uint8Array): void {
    this.written.push(data);
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

// The one header is the shell's, and mounting it here would drag a data router in for a row this
// surface only portals a Pane name into. What the header does has its own tests.
vi.mock("@/components/app-header", () => ({
  RouteHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="route-header">{children}</div>,
}));

vi.mock("@xterm/xterm", () => ({ Terminal: FakeTerminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: FakeFitAddon }));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

const { FleetTerminal } = await import("./fleet-terminal");

const writeText = vi.fn<(text: string) => Promise<void>>();

let paneCounter = 0;
/** Every live ResizeObserver callback, so a rotation or a type-size change can be driven by hand. */
const resizes: (() => void)[] = [];

function mount(over: { readOnly?: boolean } = {}) {
  paneCounter += 1;
  const paneId = `w1:p${paneCounter}`;
  const view = render(
    <FleetTerminal
      paneId={paneId}
      scope={{}}
      label="claude"
      device={over.readOnly === true ? { enforced: true, device: "phone", authorized: false } : undefined}
      onBack={() => undefined}
    />,
  );
  const socket = FakeSocket.instances.at(-1)!;
  const terminal = FakeTerminal.instances.at(-1)!;
  return { view, socket, terminal, paneId };
}

beforeEach(() => {
  FakeTerminal.instances.length = 0;
  FakeSocket.instances.length = 0;
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  proposed = { cols: 100, rows: 30 };
  vi.stubGlobal("WebSocket", FakeSocket);
  resizes.length = 0;
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

describe("leaving and coming back", () => {
  it("keeps the terminal, so a return is a return and not an opening", () => {
    const { view, socket, terminal, paneId } = mount();
    socket.fire("open");
    view.unmount();
    expect(terminal.disposed).toBe(false);

    render(
      <FleetTerminal paneId={paneId} scope={{}} label="claude" device={undefined} onBack={() => undefined} />,
    );
    expect(FakeTerminal.instances).toHaveLength(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("builds a new one when the connection ended while it was away", () => {
    const { view, socket, paneId } = mount();
    socket.fire("open");
    socket.fire("close");
    view.unmount();

    render(
      <FleetTerminal paneId={paneId} scope={{}} label="claude" device={undefined} onBack={() => undefined} />,
    );
    expect(FakeTerminal.instances).toHaveLength(2);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
