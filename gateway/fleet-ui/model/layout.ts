export interface FleetRailWidths {
  left: number;
  right: number;
}

export const FLEET_RAIL_WIDTHS = {
  leftDefault: 224,
  leftMin: 176,
  leftMax: 480,
  rightDefault: 336,
  rightMin: 256,
  rightMax: 576,
  centreMin: 640,
} as const;

function clampRailWidth(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function fleetRailWidths(
  preferred: Partial<FleetRailWidths> | null | undefined,
  viewportWidth: number,
): FleetRailWidths {
  const viewport =
    Number.isFinite(viewportWidth) && viewportWidth > 0
      ? Math.floor(viewportWidth)
      : 1_200;
  let left = clampRailWidth(
    Number.isFinite(preferred?.left)
      ? Number(preferred?.left)
      : FLEET_RAIL_WIDTHS.leftDefault,
    FLEET_RAIL_WIDTHS.leftMin,
    FLEET_RAIL_WIDTHS.leftMax,
  );
  let right = clampRailWidth(
    Number.isFinite(preferred?.right)
      ? Number(preferred?.right)
      : FLEET_RAIL_WIDTHS.rightDefault,
    FLEET_RAIL_WIDTHS.rightMin,
    FLEET_RAIL_WIDTHS.rightMax,
  );
  const minimumRailTotal =
    FLEET_RAIL_WIDTHS.leftMin + FLEET_RAIL_WIDTHS.rightMin;
  const railBudget = Math.max(
    minimumRailTotal,
    viewport - FLEET_RAIL_WIDTHS.centreMin,
  );
  let overflow = Math.max(0, left + right - railBudget);
  if (overflow > 0) {
    const leftFlex = left - FLEET_RAIL_WIDTHS.leftMin;
    const rightFlex = right - FLEET_RAIL_WIDTHS.rightMin;
    const flexTotal = leftFlex + rightFlex;
    const leftReduction =
      flexTotal > 0
        ? Math.min(leftFlex, Math.floor((overflow * leftFlex) / flexTotal))
        : 0;
    left -= leftReduction;
    overflow -= leftReduction;
    const rightReduction = Math.min(rightFlex, overflow);
    right -= rightReduction;
    overflow -= rightReduction;
    left -= Math.min(left - FLEET_RAIL_WIDTHS.leftMin, overflow);
  }
  return { left, right };
}

export function fleetRailResize(
  current: FleetRailWidths,
  side: "left" | "right",
  requestedWidth: number,
  viewportWidth: number,
): FleetRailWidths {
  const viewport =
    Number.isFinite(viewportWidth) && viewportWidth > 0
      ? Math.floor(viewportWidth)
      : 1_200;
  const other = side === "left" ? current.right : current.left;
  const minimum =
    side === "left" ? FLEET_RAIL_WIDTHS.leftMin : FLEET_RAIL_WIDTHS.rightMin;
  const staticMaximum =
    side === "left" ? FLEET_RAIL_WIDTHS.leftMax : FLEET_RAIL_WIDTHS.rightMax;
  const maximum = Math.max(
    minimum,
    Math.min(staticMaximum, viewport - FLEET_RAIL_WIDTHS.centreMin - other),
  );
  const fallback = side === "left" ? current.left : current.right;
  const width = clampRailWidth(
    Number.isFinite(requestedWidth) ? requestedWidth : fallback,
    minimum,
    maximum,
  );
  return side === "left"
    ? { left: width, right: current.right }
    : { left: current.left, right: width };
}

export function fleetRailWidthPreferences(
  serialized: string | null,
): FleetRailWidths | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !Number.isFinite(record.left) ||
      !Number.isFinite(record.right)
    )
      return null;
    const left = Number(record.left);
    const right = Number(record.right);
    return left > 0 && right > 0 ? { left, right } : null;
  } catch {
    return null;
  }
}
