import { afterEach, describe, expect, it, vi } from "vitest";

import { fleetPage, FLEET_JS } from "../../../gateway/fleet-ui";

function bodyOf(html: string): string {
  const match = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!match) throw new Error("Fleet page has no body");
  return match[1];
}

function keydown(code: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    ...modifiers,
  });
  document.dispatchEvent(event);
  return event;
}

describe("generated Fleet keyboard runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures Shift, Tab, Shift+Tab, and ? after the sequential prefix and runs the palette", async () => {
    const media = new Map<string, MediaQueryList>();
    vi.stubGlobal("matchMedia", (query: string) => {
      const value = {
        matches: query.includes("min-width: 1200px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      } as unknown as MediaQueryList;
      media.set(query, value);
      return value;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      generatedAt: 1_000,
      refresh: { nextAt: 61_000 },
      nodes: [],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    document.body.innerHTML = bodyOf(fleetPage(1, "development"));
    expect(() => new Function(FLEET_JS)()).not.toThrow();
    await Promise.resolve();

    for (const second of [
      { code: "KeyP", init: { key: "P", shiftKey: true } },
      { code: "Tab", init: { key: "Tab" } },
      { code: "Tab", init: { key: "Tab", shiftKey: true } },
    ]) {
      expect(keydown("KeyB", { key: "b", ctrlKey: true }).defaultPrevented).toBe(true);
      expect(keydown(second.code, second.init).defaultPrevented).toBe(true);
    }

    expect(keydown("KeyB", { key: "b", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(keydown("Slash", { key: "?", shiftKey: true }).defaultPrevented).toBe(true);
    const dialog = document.querySelector<HTMLElement>("#command-dialog");
    const input = document.querySelector<HTMLInputElement>("#command-dialog-input");
    const results = document.querySelector<HTMLElement>("#command-dialog-results");
    const hint = document.querySelector<HTMLElement>("#command-dialog-hint");
    expect(dialog?.hidden).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(48);

    input!.value = "/pane width";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(results?.textContent).toContain("Fit Current Pane Width");

    input!.value = "tabs";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(hint?.textContent).toContain("reserved");

    expect(keydown("Escape", { key: "Escape" }).defaultPrevented).toBe(true);
    expect(dialog?.hidden).toBe(true);

    expect(keydown("KeyP", { key: "P", ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(dialog?.hidden).toBe(false);
  });
});
