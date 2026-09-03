export const MIN_MANUAL_PANE_FIT_COLS = 20;
export const MAX_MANUAL_PANE_FIT_COLS = 500;

const PROBE_CELLS = 100;

export interface ManualPaneFitGeometry {
  readonly scrollportWidth: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly cellWidth: number;
}

export type ManualPaneFitAttempt =
  | { readonly ok: true; readonly cols: number; readonly rows: number }
  | {
      readonly ok: false;
      readonly reason: "geometry" | "unsupported" | "conflict" | "failed";
    };

export interface ManualPaneFitRequestResult {
  readonly ok: boolean;
  readonly cols?: number;
  readonly rows?: number;
  readonly reason?: "unsupported" | "geometry" | "conflict" | "failed";
}

export function manualPaneFitColumns(geometry: ManualPaneFitGeometry): number {
  const { scrollportWidth, paddingLeft, paddingRight, cellWidth } = geometry;
  if (
    !Number.isFinite(scrollportWidth) ||
    scrollportWidth <= 0 ||
    !Number.isFinite(paddingLeft) ||
    paddingLeft < 0 ||
    !Number.isFinite(paddingRight) ||
    paddingRight < 0 ||
    !Number.isFinite(cellWidth) ||
    cellWidth <= 0
  ) {
    throw new Error("invalid terminal geometry");
  }
  const usableWidth = scrollportWidth - paddingLeft - paddingRight;
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) {
    throw new Error("invalid terminal geometry");
  }
  return Math.max(
    MIN_MANUAL_PANE_FIT_COLS,
    Math.min(MAX_MANUAL_PANE_FIT_COLS, Math.floor(usableWidth / cellWidth)),
  );
}

export function measureManualPaneFitColumns(scrollport: HTMLElement, fontSize: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error("invalid terminal geometry");
  const style = getComputedStyle(scrollport);
  const paddingLeft = cssPixels(style.paddingLeft);
  const paddingRight = cssPixels(style.paddingRight);
  const probe = document.createElement("span");
  probe.className = "font-mono tracking-normal [font-variant-ligatures:none]";
  probe.textContent = "M".repeat(PROBE_CELLS);
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
  scrollport.appendChild(probe);
  const cellWidth = probe.getBoundingClientRect().width / PROBE_CELLS;
  probe.remove();
  return manualPaneFitColumns({
    scrollportWidth: scrollport.clientWidth,
    paddingLeft,
    paddingRight,
    cellWidth,
  });
}

export async function runManualPaneFit(
  scrollport: HTMLElement | null,
  fontSize: number,
  request: (cols: number) => Promise<ManualPaneFitRequestResult>,
): Promise<ManualPaneFitAttempt> {
  if (scrollport === null) return { ok: false, reason: "geometry" };
  let cols: number;
  try {
    cols = measureManualPaneFitColumns(scrollport, fontSize);
  } catch {
    return { ok: false, reason: "geometry" };
  }
  try {
    const result = await request(cols);
    if (
      result.ok &&
      validResultDimension(result.cols) &&
      validResultDimension(result.rows)
    ) {
      return { ok: true, cols: result.cols, rows: result.rows };
    }
    return {
      ok: false,
      reason:
        result.reason === "unsupported" ||
        result.reason === "geometry" ||
        result.reason === "conflict"
          ? result.reason
          : "failed",
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

function cssPixels(value: string): number {
  if (value.trim() === "") throw new Error("invalid terminal geometry");
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("invalid terminal geometry");
  return parsed;
}

function validResultDimension(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}
