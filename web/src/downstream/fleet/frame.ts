export const FLEET_FRAME_ATTRIBUTE = "data-fleet-frame";

/** Mark presentation context before React mounts. Cosmetic only; never an authorization signal. */
export function markFleetFrame(root: HTMLElement, framed: boolean): void {
  if (framed) root.setAttribute(FLEET_FRAME_ATTRIBUTE, "");
  else root.removeAttribute(FLEET_FRAME_ATTRIBUTE);
}

export function isFleetFrame(target: Window = window): boolean {
  return target.parent !== target;
}
