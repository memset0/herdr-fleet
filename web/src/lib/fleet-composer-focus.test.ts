import {
  captureComposerCaret,
  returnFocusToComposer,
} from "./fleet-composer-focus";

/**
 * These drive the real DOM rather than a component, because what they are about IS the DOM: which
 * element holds the caret after a command, and where in it. A component test would prove the same
 * thing through three layers that have their own reasons to fail.
 */

function mountComposer(value: string): HTMLTextAreaElement {
  const input = document.createElement("textarea");
  input.setAttribute("data-slot", "chat-input");
  input.value = value;
  document.body.append(input);
  return input;
}

function mountPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.setAttribute("data-slot", "fleet-panel");
  document.body.append(panel);
  return panel;
}

/** Long enough for the whole settle window, so a test never races the loop it is checking. */
async function settle(ms = 900) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("capturing the caret", () => {
  it("reads the offsets when the composer holds it", () => {
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(3, 5);
    expect(captureComposerCaret()).toEqual({ start: 3, end: 5 });
  });

  it("answers null when the composer exists but does not hold it", () => {
    mountComposer("hello");
    expect(captureComposerCaret()).toBeNull();
  });

  it("answers null when there is no composer at all", () => {
    expect(captureComposerCaret()).toBeNull();
  });
});

describe("returning the caret", () => {
  it("puts it back at the same offset a command took it from", async () => {
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(4, 4);
    const caret = captureComposerCaret();
    // What a command does: the capture listener ate the key and focus ended up nowhere.
    input.blur();

    returnFocusToComposer(caret, "restore");
    await settle();

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(4);
  });

  it("puts it at the end when nothing held it before", async () => {
    const input = mountComposer("hello world");
    returnFocusToComposer(captureComposerCaret(), "restore");
    await settle();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe("hello world".length);
  });

  it("puts it at the end after a command that moved the operator, offset or not", async () => {
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(2, 2);
    const caret = captureComposerCaret();
    input.blur();

    returnFocusToComposer(caret, "end");
    await settle();

    expect(input.selectionStart).toBe("hello world".length);
  });

  it("waits for the composer of the pane being switched to", async () => {
    returnFocusToComposer(null, "end");
    // Nothing on screen yet: the route is still loading, exactly as it is on a real pane switch.
    await vi.advanceTimersByTimeAsync(200);
    const input = mountComposer("later");
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it("follows the composer when the pane swap replaces the element", async () => {
    const before = mountComposer("old draft");
    returnFocusToComposer(null, "end");
    await vi.advanceTimersByTimeAsync(100);
    expect(document.activeElement).toBe(before);

    before.remove();
    const after = mountComposer("");
    await settle();
    expect(document.activeElement).toBe(after);
  });

  it("gives up while one of our own panels is open, because the panel owns the caret", async () => {
    const input = mountComposer("hello");
    mountPanel();
    returnFocusToComposer(null, "restore");
    await settle();
    expect(document.activeElement).not.toBe(input);
  });

  it("never moves a caret the operator has already put back themselves", async () => {
    const input = mountComposer("hello world");
    returnFocusToComposer(null, "end");
    // The operator got there first and is typing mid-string.
    input.focus();
    input.setSelectionRange(2, 2);
    await settle();
    expect(input.selectionStart).toBe(2);
  });

  it("leaves a disabled composer alone and takes it the moment it is enabled", async () => {
    const input = mountComposer("hello");
    input.disabled = true;
    returnFocusToComposer(null, "end");
    await vi.advanceTimersByTimeAsync(200);
    expect(document.activeElement).not.toBe(input);

    input.disabled = false;
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it("stops when cancelled", async () => {
    const input = mountComposer("hello");
    const stop = returnFocusToComposer(null, "end");
    stop();
    await settle();
    expect(document.activeElement).not.toBe(input);
  });
});
