import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
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
 * One track and one moving indicator make the mutually exclusive choice visible. The 44px
 * buttons own the hit area; the inset track spends only 36px on paint. Labels never move and
 * reduced motion removes the slide. Both navigation surfaces share this exact control.
 */
export function FleetPaneSurfaceToggle() {
  useLocale();
  const surface = useSyncExternalStore(
    paneSurfaceStore.subscribe,
    paneSurfaceStore.snapshot,
    () => DEFAULT_PANE_SURFACE,
  );
  return (
    <div role="radiogroup" aria-label={t("fleet.settings.surface.title")} className="relative mx-3 grid grid-cols-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 inset-y-1 rounded-md border border-border bg-muted/60 p-0.5">
        <div
          className={cn(
            "h-full w-1/2 rounded-md bg-primary shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
            surface === "terminal" && "translate-x-full",
          )}
        />
      </div>
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
    <Button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => paneSurfaceStore.set(surface)}
      variant="ghost"
      className={cn(
        "relative min-h-11 h-auto rounded-md px-3 py-2 text-xs font-medium hover:bg-transparent active:scale-100 motion-reduce:transition-none",
        selected ? "text-primary-foreground hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Button>
  );
}
