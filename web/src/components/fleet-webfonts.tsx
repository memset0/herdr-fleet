import { ChevronDown, Languages } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import {
  CJK_FALLBACK_NONE,
  FLEET_WEBFONTS,
  fleetCjkFallback,
  fleetUiCjkFallback,
  type CjkRole,
  isCjkFallback,
} from "../../../fleet/ui/webfonts.ts";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { applyFleetWebfont, applyFleetUiWebfont, neededWebfont, neededUiWebfont } from "@/lib/fleet-webfonts";
import { useDesignPrefs } from "@/lib/design";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";

/** Apply the two independent browser-local font roles for the app lifetime. */
export function FleetWebfonts() {
  const cjkFallback = useSyncExternalStore(
    fleetCjkFallback.subscribe,
    fleetCjkFallback.snapshot,
    fleetCjkFallback.snapshot,
  );
  const uiFallback = useSyncExternalStore(fleetUiCjkFallback.subscribe, fleetUiCjkFallback.snapshot, fleetUiCjkFallback.snapshot);
  const uiOnly = useSyncExternalStore(fleetUiCjkFallback.subscribe, fleetUiCjkFallback.only, fleetUiCjkFallback.only);
  const terminalOnly = useSyncExternalStore(fleetCjkFallback.subscribe, fleetCjkFallback.only, fleetCjkFallback.only);
  const design = useDesignPrefs();
  const { prefs } = useDisplayPrefs();

  useEffect(() => {
    const fallback = neededWebfont({ cjkFallback, uiFallback, designFont: design.font, terminalFont: prefs.fontFamily });
    applyFleetWebfont(fallback, FLEET_WEBFONTS.find(font => font.id === cjkFallback) ?? null, terminalOnly);
    applyFleetUiWebfont(neededUiWebfont(uiFallback), fallback, uiOnly);
  }, [cjkFallback, uiFallback, uiOnly, terminalOnly, design.font, prefs.fontFamily]);

  return null;
}

/** Role selectors and exclusive switches stay together below native settings. */
export function FleetCjkFallbackControl() {
  useFleetLocale();
  return <Card className="gap-0 py-0">
    <div className="flex items-start gap-3 p-4">
      <Languages className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0"><div className="font-medium">{ft("settings.cjk.title")}</div><p className="text-sm text-muted-foreground">{ft("settings.cjk.description")}</p></div>
    </div>
    <div className="divide-y divide-border border-t border-border">
      <CjkRoleControl fontRole="ui" />
      <CjkRoleControl fontRole="terminal" />
    </div>
    <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{ft("settings.cjk.note.provider")}</p>
  </Card>;
}

function CjkRoleControl({ fontRole: role }: { fontRole: CjkRole }) {
  const store = role === "ui" ? fleetUiCjkFallback : fleetCjkFallback;
  const chosen = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const only = useSyncExternalStore(store.subscribe, store.only, store.only);
  const label = ft(role === "ui" ? "settings.cjk.ui" : "settings.cjk.terminal");
  const id = `pref-cjk-${role}`;
  return <div className="space-y-2 px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 text-sm font-medium">{label}</label>
      <div className="relative min-w-0 shrink-0">
        <select id={id} value={chosen} onChange={event => { if (isCjkFallback(event.target.value, role)) store.set(event.target.value); }}
          className="min-h-11 max-w-[min(55vw,18rem)] appearance-none rounded-md border border-border/60 bg-background py-2 pl-3 pr-9 text-sm font-medium text-foreground">
          <option value={CJK_FALLBACK_NONE}>{ft("settings.cjk.none")}</option>
          {FLEET_WEBFONTS.filter(font => role === "ui" || font.monospace).map(font => <option key={font.id} value={font.id}>{font.label}</option>)}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={`${id}-only`} className="text-xs text-muted-foreground">{ft("settings.cjk.only")}</label>
      <Switch id={`${id}-only`} aria-label={`${label}: ${ft("settings.cjk.only")}`} checked={only} disabled={chosen === CJK_FALLBACK_NONE} onCheckedChange={value => store.setOnly(value)} />
    </div>
  </div>;
}
