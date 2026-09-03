import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";
import {
  FLEET_RAIL_WIDTHS,
  fleetRailResize,
  fleetRailWidthPreferences,
  fleetRailWidths,
} from "../model/layout.ts";

export function installLayout(ctx: FleetClientContext): void {
  ctx.services.fitRailWidths = function (
    preferred,
    viewportWidth = ctx.runtime.viewportWidth(),
  ) {
    return fleetRailWidths(preferred, viewportWidth);
  };

  ctx.services.readRailWidthPreferences = function () {
    let serialized: string | null = null;
    try {
      serialized = ctx.runtime.storage.getItem(constants.RAIL_STORAGE_KEY);
    } catch {}
    return (
      fleetRailWidthPreferences(serialized) ?? {
        left: FLEET_RAIL_WIDTHS.leftDefault,
        right: FLEET_RAIL_WIDTHS.rightDefault,
      }
    );
  };

  ctx.services.persistRailWidthPreferences = function () {
    try {
      ctx.runtime.storage.setItem(
        constants.RAIL_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          left: ctx.state.preferredRailWidths.left,
          right: ctx.state.preferredRailWidths.right,
        }),
      );
    } catch {}
  };

  ctx.services.railMaximum = function (
    side,
    widths = ctx.state.appliedRailWidths,
    viewportWidth = ctx.runtime.viewportWidth(),
  ) {
    const minimum =
      side === "left" ? FLEET_RAIL_WIDTHS.leftMin : FLEET_RAIL_WIDTHS.rightMin;
    const staticMaximum =
      side === "left" ? FLEET_RAIL_WIDTHS.leftMax : FLEET_RAIL_WIDTHS.rightMax;
    const other = side === "left" ? widths.right : widths.left;
    return Math.max(
      minimum,
      Math.min(
        staticMaximum,
        Math.floor(viewportWidth) - FLEET_RAIL_WIDTHS.centreMin - other,
      ),
    );
  };

  ctx.services.updateRailSeparator = function (handle, side) {
    const minimum =
      side === "left" ? FLEET_RAIL_WIDTHS.leftMin : FLEET_RAIL_WIDTHS.rightMin;
    const maximum = ctx.services.railMaximum(side);
    const value =
      side === "left"
        ? ctx.state.appliedRailWidths.left
        : ctx.state.appliedRailWidths.right;
    handle.setAttribute("aria-valuemin", String(minimum));
    handle.setAttribute("aria-valuemax", String(maximum));
    handle.setAttribute("aria-valuenow", String(value));
    handle.setAttribute("aria-valuetext", value + " pixels");
  };

  ctx.services.renderRailWidths = function () {
    ctx.elements.shell.style.setProperty(
      "--fleet-host-rail-width",
      ctx.state.appliedRailWidths.left + "px",
    );
    ctx.elements.shell.style.setProperty(
      "--fleet-agent-rail-width",
      ctx.state.appliedRailWidths.right + "px",
    );
    ctx.services.updateRailSeparator(ctx.elements.hostRailResizer, "left");
    ctx.services.updateRailSeparator(ctx.elements.agentRailResizer, "right");
  };

  ctx.services.applyRailWidthPreferences = function () {
    if (!ctx.desktopMedia.matches) {
      ctx.elements.shell.style.removeProperty("--fleet-host-rail-width");
      ctx.elements.shell.style.removeProperty("--fleet-agent-rail-width");
      return;
    }
    ctx.state.appliedRailWidths = ctx.services.fitRailWidths(
      ctx.state.preferredRailWidths,
    );
    ctx.services.renderRailWidths();
  };

  ctx.services.setRailWidth = function (side, requestedWidth, persist = false) {
    const resized = fleetRailResize(
      ctx.state.appliedRailWidths,
      side,
      requestedWidth,
      ctx.runtime.viewportWidth(),
    );
    ctx.state.appliedRailWidths = resized;
    ctx.state.preferredRailWidths =
      side === "left"
        ? { left: resized.left, right: ctx.state.preferredRailWidths.right }
        : { left: ctx.state.preferredRailWidths.left, right: resized.right };
    ctx.services.renderRailWidths();
    if (persist) ctx.services.persistRailWidthPreferences();
  };

  ctx.services.railWidthFromPointer = function (side, event) {
    const bounds = ctx.elements.shell.getBoundingClientRect();
    return side === "left"
      ? event.clientX - bounds.left
      : bounds.right - event.clientX;
  };

  ctx.services.finishRailDrag = function (handle, persist) {
    if (!ctx.state.railDrag || ctx.state.railDrag.handle !== handle) return;
    if (persist) ctx.services.persistRailWidthPreferences();
    ctx.state.railDrag = null;
    delete ctx.elements.shell.dataset.resizing;
  };

  ctx.services.bindRailResizer = function (handle, side) {
    handle.addEventListener("pointerdown", (event: PointerEvent) => {
      if (!ctx.desktopMedia.matches || event.button !== 0) return;
      event.preventDefault();
      ctx.state.railDrag = { handle, side, pointerId: event.pointerId };
      ctx.elements.shell.dataset.resizing = "true";
      handle.setPointerCapture(event.pointerId);
      ctx.services.setRailWidth(
        side,
        ctx.services.railWidthFromPointer(side, event),
      );
    });
    handle.addEventListener("pointermove", (event: PointerEvent) => {
      const drag = ctx.state.railDrag;
      if (drag && drag.handle === handle && drag.pointerId === event.pointerId)
        ctx.services.setRailWidth(
          side,
          ctx.services.railWidthFromPointer(side, event),
        );
    });
    handle.addEventListener("pointerup", (event: PointerEvent) => {
      const drag = ctx.state.railDrag;
      if (!drag || drag.handle !== handle || drag.pointerId !== event.pointerId)
        return;
      ctx.services.setRailWidth(
        side,
        ctx.services.railWidthFromPointer(side, event),
      );
      ctx.services.finishRailDrag(handle, true);
    });
    handle.addEventListener("pointercancel", () =>
      ctx.services.finishRailDrag(handle, false),
    );
    handle.addEventListener("lostpointercapture", () =>
      ctx.services.finishRailDrag(handle, false),
    );
    handle.addEventListener("keydown", (event: KeyboardEvent) => {
      if (
        !ctx.desktopMedia.matches ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
      )
        return;
      event.preventDefault();
      const physicalDelta =
        (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 32 : 8);
      const widthDelta = side === "left" ? physicalDelta : -physicalDelta;
      ctx.services.setRailWidth(
        side,
        (side === "left"
          ? ctx.state.appliedRailWidths.left
          : ctx.state.appliedRailWidths.right) + widthDelta,
        true,
      );
    });
  };
}
