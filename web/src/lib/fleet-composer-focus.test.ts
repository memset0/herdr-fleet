import {
  __resetCaretPark,
  captureComposerCaret,
  isParkedElement,
  noteComposition,
  parkCaretForPrefix,
  parkedCaretForPrefix,
  returnFocusToComposer,
  unparkCaretForPrefix,
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
  __resetCaretPark();
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

describe("parking the caret while a prefix is armed", () => {
  it("takes the caret off the composer and remembers where it was", () => {
    // The whole point: an input method composes into the focused EDITABLE element, so while a prefix
    // is pending there must not be one.
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(4, 4);

    expect(parkCaretForPrefix()).toBe(true);
    expect(document.activeElement).not.toBe(input);
    expect(isParkedElement(document.activeElement)).toBe(true);
    expect(parkedCaretForPrefix()).toEqual({ start: 4, end: 4 });
  });

  it("gives it back at the offset it took", async () => {
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(4, 4);
    parkCaretForPrefix();

    unparkCaretForPrefix("restore");
    await settle();

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(4);
    expect(parkedCaretForPrefix()).toBeNull();
  });

  it("gives it back at the END when the command moved the operator", async () => {
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(2, 2);
    parkCaretForPrefix();

    unparkCaretForPrefix("end");
    await settle();

    expect(input.selectionStart).toBe("hello world".length);
  });

  it("is idempotent, so pressing the prefix twice keeps the first offset", () => {
    // A hand presses it twice when it is not sure the first one landed. The second call must not
    // overwrite the remembered caret with the parked element's non-caret.
    const input = mountComposer("hello world");
    input.focus();
    input.setSelectionRange(3, 3);
    parkCaretForPrefix();
    expect(parkCaretForPrefix()).toBe(true);
    expect(parkedCaretForPrefix()).toEqual({ start: 3, end: 3 });
  });

  it("refuses while a composition is in flight", () => {
    // Moving focus mid-word commits or discards it, which is worse than missing a shortcut.
    const input = mountComposer("你好");
    input.focus();
    input.setSelectionRange(2, 2);
    noteComposition(true);

    expect(parkCaretForPrefix()).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(parkedCaretForPrefix()).toBeNull();
  });

  it("parks again once the composition has finished", () => {
    const input = mountComposer("你好");
    input.focus();
    noteComposition(true);
    expect(parkCaretForPrefix()).toBe(false);
    noteComposition(false);
    expect(parkCaretForPrefix()).toBe(true);
  });

  it("does nothing when the composer never had the caret", () => {
    mountComposer("hello");
    expect(parkCaretForPrefix()).toBe(false);
    expect(parkedCaretForPrefix()).toBeNull();
  });

  it("unparking with nothing parked moves no caret", async () => {
    const input = mountComposer("hello");
    unparkCaretForPrefix("restore");
    await settle();
    expect(document.activeElement).not.toBe(input);
  });

  it("lands in the composer of a pane that arrives after the sequence ended", async () => {
    const first = mountComposer("old draft");
    first.focus();
    first.setSelectionRange(3, 3);
    parkCaretForPrefix();
    // The command switched pane; the composer it took the caret from is gone.
    first.remove();
    unparkCaretForPrefix("end");
    const second = mountComposer("");
    await settle();
    expect(document.activeElement).toBe(second);
  });

  it("a settle window still open from an earlier command does not un-park it", async () => {
    // THE RACE THIS FIXES, and it is the reported bug wearing a different hat. A command that moved
    // the operator leaves a return watching for up to SETTLE_MS; parking inside that window used to
    // be undone a tick later, and the second chord went straight back to the input method — but only
    // sometimes, depending on which command was run just before.
    const input = mountComposer("hello world");
    returnFocusToComposer(null, "end");
    await vi.advanceTimersByTimeAsync(100);
    expect(document.activeElement).toBe(input);

    input.setSelectionRange(4, 4);
    expect(parkCaretForPrefix()).toBe(true);
    // Let the earlier window run out. The caret must still be parked at the end of it.
    await settle();
    expect(isParkedElement(document.activeElement)).toBe(true);
    expect(parkedCaretForPrefix()).toEqual({ start: 4, end: 4 });
  });

  it("the parked element is not editable and is hidden from assistive technology", () => {
    const input = mountComposer("hello");
    input.focus();
    parkCaretForPrefix();
    const parked = document.activeElement;
    expect(parked?.tagName).toBe("DIV");
    expect(parked?.getAttribute("aria-hidden")).toBe("true");
    expect(parked?.hasAttribute("contenteditable")).toBe(false);
  });
});
