import { describe, expect, it, vi } from "vitest";

import { columnsForWidth, measureTerminalColumns } from "./terminal-resize";

describe("columnsForWidth", () => {
  it("uses only complete monospace cells", () => {
    expect(columnsForWidth(399, 8)).toBe(49);
    expect(columnsForWidth(400, 8)).toBe(50);
  });

  it("clamps tiny and enormous views to the bridge contract", () => {
    expect(columnsForWidth(40, 8)).toBe(20);
    expect(columnsForWidth(10_000, 8)).toBe(500);
  });

  it("refuses missing layout metrics instead of guessing", () => {
    expect(() => columnsForWidth(0, 8)).toThrow(/not ready/i);
    expect(() => columnsForWidth(400, 0)).toThrow(/not ready/i);
  });
});

describe("measureTerminalColumns", () => {
  it("subtracts the scrollport padding and measures the active monospace advance", () => {
    const scrollport = document.createElement("div");
    Object.defineProperty(scrollport, "clientWidth", { value: 416 });
    const style = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "8px",
      paddingRight: "8px",
    } as CSSStyleDeclaration);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 800 } as DOMRect);

    expect(measureTerminalColumns(scrollport, 11)).toBe(50);
    expect(document.body.querySelector("[aria-hidden='true']")).toBeNull();

    rect.mockRestore();
    style.mockRestore();
  });
});
