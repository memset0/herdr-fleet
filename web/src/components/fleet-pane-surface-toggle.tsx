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
 * Two segments and no third state, so there is nothing to read: the selected side is the surface
 * every Pane is drawn as. Selection changes colour and nothing else — DESIGN.md §2 — because a
 * weight change would re-measure the label and move the segment beside it every time you switched.
 */
export function FleetPaneSurfaceToggle() {
  useLocale();
  const surface = useSyncExternalStore(
    paneSurfaceStore.subscribe,
    paneSurfaceStore.snapshot,
    () => DEFAULT_PANE_SURFACE,
  );
  return (
    <div className="px-3 py-2">
      <div
        role="radiogroup"
        aria-label={t("fleet.settings.surface.title")}
        // One frame, one hairline down the middle: `--border` is a component's own edge, and the
        // segment divider is inside that component rather than a cut between two regions (§4).
        className="grid grid-cols-2 overflow-hidden rounded-md border border-border"
      >
        <Segment surface="mirror" label="Collie" selected={surface === "mirror"} />
        <Segment surface="terminal" label="TTYD" selected={surface === "terminal"} divided />
      </div>
    </div>
  );
}

function Segment({
  surface,
  label,
  selected,
  divided = false,
}: {
  surface: PaneSurface;
  label: string;
  selected: boolean;
  divided?: boolean;
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
        "min-h-11 px-2 text-xs font-medium transition-colors",
        divided && "border-l border-border",
        // The rail's own selected-row idiom, so the switch reads as part of the rail it sits in.
        selected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
