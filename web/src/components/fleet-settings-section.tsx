import { Keyboard, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { DEFAULT_COMMAND_PREFIX } from "../../../fleet/ui/commands/catalog.ts";
import { commandRows, resolveBindings } from "../../../fleet/ui/commands/effective.ts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FleetCjkFallbackControl } from "@/components/fleet-webfonts";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import {
  fetchFleetSettings,
  notifyFleetSettingsSaved,
  saveFleetSettings,
  type FleetSettingsDocument,
} from "@/lib/fleet-settings";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PANE_SURFACE,
  paneSurfaceStore,
} from "../../../fleet/ui/terminal/switch.ts";

/**
 * Everything this fork adds to Settings, in one group, at the head of the page.
 *
 * COLLIE'S SETTINGS PAGE HAS NO HEADINGS, and that is written down at the line this group now sits
 * above: a flat stack of cards, on the argument that the first heading implies four more. This is
 * the deliberate exception, and it is narrow — ONE heading, for the one boundary a reader of this
 * page cannot otherwise see, which is which settings belong to the fork and which to Collie. Every
 * card below the group stays exactly where it was.
 *
 * Each card also says whose it is. Two answers exist and they are genuinely different: a preference
 * about how THIS BROWSER presents things stays in this browser, and a document about how this
 * INSTALLATION behaves is one file every browser reads.
 */
export function FleetSettingsSection() {
  useLocale();
  return (
    <section aria-labelledby="fleet-settings-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          id="fleet-settings-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("fleet.settings.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("fleet.settings.description")}</p>
      </div>
      <FleetCjkFallbackControl />
      <FleetPaneSurfaceControl />
      <FleetShortcutsControl />
    </section>
  );
}

/**
 * The one switch that chooses what a Pane is drawn as.
 *
 * ONE switch, global, and here rather than on the Pane: a per-Pane control would be a per-Pane
 * memory to maintain, and a control ON the terminal would be a control the terminal's own program
 * can be drawn over. It reaches every Pane in this browser and no other browser at all, which is
 * what the scope label says.
 */
export function FleetPaneSurfaceControl() {
  useLocale();
  const surface = useSyncExternalStore(
    paneSurfaceStore.subscribe,
    paneSurfaceStore.snapshot,
    () => DEFAULT_PANE_SURFACE,
  );
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <SquareTerminal className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{t("fleet.settings.surface.title")}</div>
            <p className="text-sm text-muted-foreground">{t("fleet.settings.surface.description")}</p>
          </div>
        </div>
        <FleetSettingScope scope="browser" />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
        <label htmlFor="pref-pane-surface" className="text-sm font-medium">
          {t("fleet.settings.surface.label")}
        </label>
        <select
          id="pref-pane-surface"
          value={surface}
          // A DOM value is a plain string whatever the options say, so it is checked against the two
          // this switch has rather than asserted into one.
          onChange={(event) => paneSurfaceStore.set(event.target.value === "terminal" ? "terminal" : "mirror")}
          className="min-h-11 shrink-0 appearance-none rounded-md border border-border/60 bg-background py-2 pl-3 pr-9 text-sm font-medium text-foreground"
        >
          <option value="mirror">{t("fleet.settings.surface.mirror")}</option>
          <option value="terminal">{t("fleet.settings.surface.terminal")}</option>
        </select>
      </div>
    </Card>
  );
}

/** The small label a Fleet card wears so its reach is never a guess. */
export function FleetSettingScope({ scope }: { scope: "browser" | "install" }) {
  useLocale();
  return (
    <span className="shrink-0 rounded border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {scope === "browser" ? t("fleet.settings.scope.browser") : t("fleet.settings.scope.install")}
    </span>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "invalid"; at: string; message: string }
  | { kind: "conflict" }
  | { kind: "unavailable" };

/**
 * The binding document, edited as text.
 *
 * A text area rather than a per-command editor because the catalog is long and an operator who wants
 * to change one binding wants to change it, not to walk a list of fifty rows to find it. The
 * contract is the same either way — the document is validated WHOLE and refused whole — so the
 * surface can grow later without the file's rules changing.
 *
 * Saving sends back the version it read. A refusal on that version means the file moved underneath —
 * somebody edited it on disk — and the answer carries what is actually there, so nothing is lost.
 */
function FleetShortcutsControl() {
  useLocale();
  const [loaded, setLoaded] = useState<FleetSettingsDocument | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const version = useRef("");

  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const document = await fetchFleetSettings(abort.signal);
        if (abort.signal.aborted) return;
        setLoaded(document);
        if (document !== null) {
          version.current = document.version;
          setDraft(document.document === "" ? EXAMPLE_DOCUMENT : document.document);
        }
      } catch {
        if (!abort.signal.aborted) setLoaded(null);
      }
    })();
    return () => abort.abort();
  }, []);

  // The reference an operator writing this document actually needs: what the command ids ARE, and
  // what each is bound to right now.
  const reference = commandRows(resolveBindings(), DEFAULT_COMMAND_PREFIX);

  if (loaded === undefined || loaded === null) return null;

  const save = async () => {
    setState({ kind: "saving" });
    const result = await saveFleetSettings(draft, version.current);
    if (result.ok) {
      version.current = result.document.version;
      setState({ kind: "saved" });
      // The keyboard reads the document too. Telling it now is what makes a save take effect
      // without a reload.
      notifyFleetSettingsSaved();
      return;
    }
    if (result.kind === "conflict") {
      version.current = result.document.version;
      setDraft(result.document.document);
      setState({ kind: "conflict" });
      return;
    }
    if (result.kind === "invalid") {
      setState({ kind: "invalid", at: result.at, message: result.message });
      return;
    }
    setState({ kind: "unavailable" });
  };

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Keyboard className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <div className="font-medium">{t("fleet.settings.shortcuts.title")}</div>
            <p className="text-sm text-muted-foreground">
              {t("fleet.settings.shortcuts.description")}
            </p>
          </div>
        </div>
        <FleetSettingScope scope="install" />
      </div>

      <div className="border-t border-border p-4">
        <textarea
          aria-label={t("fleet.settings.shortcuts.title")}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setState({ kind: "idle" });
          }}
          className="h-64 w-full resize-y rounded-md border border-input bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring"
        />

        {/* One reserved line, so a message appearing does not push the button down the page
            (DESIGN.md §2). */}
        <p
          className={cn(
            "mt-2 min-h-8 text-xs",
            state.kind === "invalid" || state.kind === "unavailable"
              ? "text-status-blocked"
              : "text-muted-foreground",
          )}
        >
          <SaveMessage state={state} risky={loaded.risky} />
        </p>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={state.kind === "saving"}>
            {t("fleet.settings.shortcuts.save")}
          </Button>
        </div>
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          {t("fleet.settings.shortcuts.reference")}
        </summary>
        <ul className="max-h-72 overflow-y-auto px-4 pb-4">
          {reference.map((row) => (
            <li
              key={row.command.id}
              className="flex items-baseline justify-between gap-3 border-t border-border/60 py-1.5 first:border-t-0"
            >
              <span className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground">{row.command.id}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {row.labels.length === 0 ? t("fleet.command.bar.noBinding") : row.labels.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function SaveMessage({ state, risky }: { state: SaveState; risky: readonly string[] }) {
  if (state.kind === "saving") return <>{t("fleet.settings.shortcuts.saving")}</>;
  if (state.kind === "saved") return <>{t("fleet.settings.shortcuts.saved")}</>;
  if (state.kind === "conflict") return <>{t("fleet.settings.shortcuts.conflict")}</>;
  if (state.kind === "unavailable") return <>{t("fleet.settings.shortcuts.unavailable")}</>;
  if (state.kind === "invalid") {
    return (
      <>
        {state.at === "" ? state.message : `${state.at}: ${state.message}`}
      </>
    );
  }
  if (risky.length > 0) {
    return <>{t("fleet.settings.shortcuts.risky", { bindings: risky.join(", ") })}</>;
  }
  return null;
}

/** What a first-time operator is shown, so the shape is legible before they have written one. */
const EXAMPLE_DOCUMENT = `{
  "schemaVersion": 1,
  "shortcuts": {
    "prefix": "Ctrl+B",
    "bindings": {}
  }
}
`;
