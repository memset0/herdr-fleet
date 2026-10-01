import { useSyncExternalStore } from "react";

import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PANE_SURFACE,
  paneSurfaceStore,
  type PaneSurface,
} from "../../../fleet/ui/terminal/switch.ts";

/**
 * The pane-surface switch, where the operator is when they want it.
 *
 * It is the SAME switch Settings holds, not a second one: both read and write the one browser-local
 * store, so flipping either moves the other. It is here as well because the choice is about the
 * thing you are looking at, and Settings is two navigations away from it — the rail is the only
 * surface that is on screen no matter which Pane is.
 *
 * Two segments and no third state, drawn as COLLIE'S OWN SEGMENTED CONTROL (`theme-control.tsx`):
 * segments a gap apart inside the footer's padding, the selected one a filled primary pill. The
 * fork's first version tinted the selected segment with `--accent`, which is a hover ground and
 * barely separated from the rail, so which surface was on was a guess. The weight never changes
 * (DESIGN.md §2): a bold label is wider and would move the segment beside it on every switch.
 */
export function FleetPaneSurfaceToggle() {
  useLocale();
  const surface = useSyncExternalStore(
    paneSurfaceStore.subscribe,
    paneSurfaceStore.snapshot,
    () => DEFAULT_PANE_SURFACE,
  );
  return (
    <div role="radiogroup" aria-label={t("fleet.settings.surface.title")} className="flex gap-1 p-2">
      <Segment surface="mirror" label="Collie" selected={surface === "mirror"} />
      <Segment surface="terminal" label="TTYD" selected={surface === "terminal"} />
    </div>
  );
}

function Segment({
  surface,
  label,
  selected,
}: {
  surface: PaneSurface;
  label: string;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => paneSurfaceStore.set(surface)}
      // 44px floor, stated as a floor (§6): the label is one short word today and the row must not
      // shrink under it if it ever is not.
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
        selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted active:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
