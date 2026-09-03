export const MIN_TERMINAL_COLS = 20;
export const MAX_TERMINAL_COLS = 500;

const PROBE_CHARS = 100;

/** Pure grid math: use only complete cells and keep the controller request inside its safe bounds. */
export function columnsForWidth(widthPx: number, cellWidthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(cellWidthPx) || cellWidthPx <= 0) {
    throw new Error("Terminal width is not ready to measure");
  }
  return Math.max(
    MIN_TERMINAL_COLS,
    Math.min(MAX_TERMINAL_COLS, Math.floor(widthPx / cellWidthPx)),
  );
}

/**
 * Measure the exact Collie mirror content box at its active text size. This is invoked only by the
 * Display → Resize click — deliberately no ResizeObserver/window listener, so later layout changes
 * cannot mutate the shared PTY behind the operator's back.
 */
export function measureTerminalColumns(scrollport: HTMLElement, fontSize: number): number {
  const style = getComputedStyle(scrollport);
  const padding = px(style.paddingLeft) + px(style.paddingRight);
  const contentWidth = scrollport.clientWidth - padding;

  // A real DOM probe follows the browser's selected fallback font and sub-pixel glyph advance. The
  // same utility classes/inline size as AnsiOutput keep this coupled to the visible mirror without
  // exposing a ref through the renderer or adding a canvas/font dependency.
  const probe = document.createElement("span");
  probe.className = "font-mono tracking-normal [font-variant-ligatures:none]";
  probe.textContent = "M".repeat(PROBE_CHARS);
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "pre",
    fontSize: `${fontSize}px`,
    left: "-10000px",
    top: "0",
  });
  document.body.appendChild(probe);
  const cellWidth = probe.getBoundingClientRect().width / PROBE_CHARS;
  probe.remove();

  return columnsForWidth(contentWidth, cellWidth);
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
