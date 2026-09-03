import { Loader2, Scaling } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  MAX_MANUAL_PANE_FIT_ROWS,
  MIN_MANUAL_PANE_FIT_ROWS,
  manualPaneFitRows,
  parsePaneFitRows,
} from "../../../fleet/ui/manual-pane-fit.ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

/** How long a typed row count has to hold still before it is taken as the answer. */
export const PANE_FIT_ROWS_SETTLE_MS = 700;

interface NativePaneFitControlsProps {
  busy: boolean;
  /** The write cannot land — a gone pane, a read-only device, an unreachable machine. */
  disabled: boolean;
  /** Fit the pane: columns are measured, rows are whatever this control has been given. */
  onFit: (rows: number | null) => void;
  /** How long the typed number must hold still. A seam for tests; nothing else passes it. */
  settleMs?: number;
}

/**
 * The two halves of fitting a pane, split because only one of them can be measured.
 *
 * COLUMNS ARE A MEASUREMENT. How many cells fit across the mirror is a fact about the viewport and
 * the font size, and asking the operator for it would be asking them to count pixels — so the
 * button takes it from the screen, exactly as it always has.
 *
 * ROWS ARE A CHOICE. How much of the terminal to see at once is a judgement against a keyboard that
 * takes half the phone, and the pane's current height is not an answer to it. So it is a field, and
 * an EMPTY field is a real value: "leave the pane's own height", which is what fitting did before
 * this control existed.
 *
 * WHY A SETTLE RATHER THAN A SUBMIT. A resize is a write to a live terminal, and one per keystroke
 * would send `2`, `24`, `240` on the way to typing 24. The number has to hold still first; then it
 * is applied, and only if it actually changed. The button applies the same pair at once, so both
 * paths end in one request with one shape.
 */
export function NativePaneFitControls({
  busy,
  disabled,
  onFit,
  settleMs = PANE_FIT_ROWS_SETTLE_MS,
}: NativePaneFitControlsProps) {
  useLocale();
  const stored = useSyncExternalStore(
    manualPaneFitRows.subscribe,
    manualPaneFitRows.snapshot,
    manualPaneFitRows.snapshot,
  );
  const [draft, setDraft] = useState(stored === null ? "" : String(stored));
  // What the pane was last asked for. A settle that resolves to the same number sends nothing —
  // the operator retyping 24 over 24 is not a resize.
  const applied = useRef<number | null>(stored);
  // Read through a ref so the timer is not restarted by a caller whose closure is new every render.
  const fit = useRef(onFit);
  fit.current = onFit;

  useEffect(() => {
    const parsed = parsePaneFitRows(draft);
    if (parsed === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = parsed;
      manualPaneFitRows.set(parsed);
      // Clearing the field is a preference, not a resize: there is no height to ask the pane for.
      if (parsed !== null && !disabled) fit.current(parsed);
    }, settleMs);
    return () => clearTimeout(timer);
  }, [draft, disabled, settleMs]);

  return (
    <div className="flex flex-col gap-2 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {t("settings.display.resize.label")}
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
            >
              {t("settings.display.resize.badge")}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {t("settings.display.resize.hint")}
          </p>
        </div>
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => fit.current(parsePaneFitRows(draft))}
          aria-label={t("settings.display.resize.aria")}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Scaling />}
          {busy ? t("settings.display.resize.busy") : t("settings.display.resize.label")}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* The hint is a SIBLING of the label, not inside it: a label's text is the field's
            accessible name, and a sentence of guidance appended to "Rows" is not that name. */}
        <div className="min-w-0">
          <label htmlFor="pane-fit-rows" className="text-sm">
            {t("settings.display.resize.rows")}
          </label>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {t("settings.display.resize.rowsHint")}
          </p>
        </div>
        <input
          id="pane-fit-rows"
          type="number"
          inputMode="numeric"
          min={MIN_MANUAL_PANE_FIT_ROWS}
          max={MAX_MANUAL_PANE_FIT_ROWS}
          value={draft}
          disabled={disabled}
          placeholder={t("settings.display.resize.rowsAuto")}
          onChange={(event) => setDraft(event.target.value)}
          className="h-9 w-24 shrink-0 rounded-md border border-border/60 bg-background px-2 text-sm tabular-nums text-foreground"
        />
      </div>
    </div>
  );
}
