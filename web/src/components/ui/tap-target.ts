/**
 * The 44px tap floor, bought back as HIT AREA by the two buttons inside the composer's box.
 *
 * DESIGN.md §6 states the floor and also states this trade: where drawn height is expensive, a
 * control may measure less and reach out with a transparent `::before`, exactly as
 * `STRIP_TAP_TARGET` does for the strips. It is expensive here. The two buttons stand INSIDE the
 * composer's box, on the field's own row, so their face sets the height of an empty composer, and
 * every pixel of it is a pixel of mirror the operator stops seeing.
 *
 * The arithmetic, and it is the whole reason this is a constant and not a class at two call sites:
 * the face is `size-9`, 36px, and `-inset-1` reaches 4px out on all four sides, so 36 + 8 = 44 in
 * BOTH axes. The box's own `p-1` is 4px, so the reach stays inside the border and the box's inner
 * height is exactly that 44px: one row. Beside the field the reach runs into the row's `gap-1`, so
 * no hit box crosses the textarea's own edge. Change the face, the inset, the box's padding or the
 * gap and all of these facts must be re-checked together (ADR 0057, amended 2026-09-22).
 */
export const TOOLBAR_TAP_TARGET = "relative before:absolute before:-inset-1 before:content-['']";

// Also worn by the voice takeover's OK and trash (components/voice-takeover.tsx), so OK stands on the
// mic's own 44px reach, in the same box.
