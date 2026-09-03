import { ChevronDown, Languages } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import {
  CJK_FALLBACK_NONE,
  FLEET_WEBFONTS,
  fleetCjkFallback,
  isCjkFallback,
} from "../../../fleet/ui/webfonts.ts";
import { Card } from "@/components/ui/card";
import { applyFleetWebfont, neededWebfont } from "@/lib/fleet-webfonts";
import { useDesignPrefs } from "@/lib/design";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/**
 * Keeps the document's webfont state matching the three choices that can name one. Renders nothing.
 *
 * Mounted by the navigation shell, which is on screen for the life of the app, so the face is
 * resolved once per change and not once per route.
 *
 * ONE LIMITATION, STATED. `useDisplayPrefs` is a per-component `useState` over localStorage rather
 * than a shared store, so the terminal family read here is the one this component mounted with. A
 * device that turns the CJK fallback OFF and then picks Maple Mono as its terminal face in the same
 * session gets it on the next load. With the fallback at its default the stylesheet is already
 * loaded, so the case needs both halves to be unusual before it is reachable at all.
 */
export function FleetWebfonts() {
  const cjkFallback = useSyncExternalStore(
    fleetCjkFallback.subscribe,
    fleetCjkFallback.snapshot,
    fleetCjkFallback.snapshot,
  );
  const design = useDesignPrefs();
  const { prefs } = useDisplayPrefs();

  useEffect(() => {
    applyFleetWebfont(
      neededWebfont({
        cjkFallback,
        designFont: design.font,
        terminalFont: prefs.fontFamily,
      }),
    );
  }, [cjkFallback, design.font, prefs.fontFamily]);

  return null;
}

/**
 * Settings card: the face that answers for the codepoints the chosen one does not draw.
 *
 * It sits beside the app's typeface and the terminal's font because it is the third answer to the
 * same question, and it is ONE setting rather than two on purpose: the fallback is the same face in
 * both places, and offering a separate one for chrome and for the mirror would be two ways to make
 * a Chinese line and a Latin line disagree about their own width.
 *
 * FAMILY NAMES ARE PROPER NOUNS and are not translated. The note under the select is a sentence
 * about a face rather than the name of one, so it goes through the dictionary.
 */
export function FleetCjkFallbackControl() {
  useLocale();
  const chosen = useSyncExternalStore(
    fleetCjkFallback.subscribe,
    fleetCjkFallback.snapshot,
    fleetCjkFallback.snapshot,
  );

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Languages className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{t("settings.cjk.title")}</div>
            <p className="text-sm text-muted-foreground">{t("settings.cjk.description")}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border border-t border-border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <label htmlFor="pref-cjk-fallback" className="text-sm font-medium">
            {t("settings.cjk.family")}
          </label>
          <div className="relative shrink-0">
            <select
              id="pref-cjk-fallback"
              value={chosen}
              // A DOM value is a plain string whatever the options say, so it is checked against the
              // closed catalog here rather than asserted — the value becomes a family name and a
              // stylesheet URL, and neither may come from unvalidated text.
              onChange={(event) => {
                const next = event.target.value;
                if (isCjkFallback(next)) fleetCjkFallback.set(next);
              }}
              className="min-h-11 appearance-none rounded-md border border-border/60 bg-background py-2 pl-3 pr-9 text-sm font-medium text-foreground"
            >
              <option value={CJK_FALLBACK_NONE}>{t("settings.cjk.none")}</option>
              {FLEET_WEBFONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <p className="px-4 py-2.5 text-xs text-muted-foreground">
          {t(chosen === CJK_FALLBACK_NONE ? "settings.cjk.note.none" : "settings.cjk.note.provider")}
        </p>
      </div>
    </Card>
  );
}
