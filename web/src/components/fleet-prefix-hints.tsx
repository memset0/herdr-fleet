import type { CommandScope } from "../../../fleet/ui/commands/catalog.ts";
import type { PrefixHints } from "../../../fleet/ui/commands/prefix-hints.ts";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * What the pending prefix leads to, while it is pending.
 *
 * THREE PROPERTIES DO ALL THE WORK HERE, and each is load-bearing rather than decorative.
 *
 * It holds NO SPACE. `fixed` at the bottom edge, so pressing the prefix cannot reflow, resize or
 * scroll a single pixel of what is underneath (DESIGN.md §2) — which matters more than usual here,
 * because the panel appears under the operator's hands at the moment their attention is on the
 * keyboard.
 *
 * It has NO TARGETS. `pointer-events: none`, nothing focusable, nothing scrollable. It therefore
 * cannot take the second chord the recognizer is waiting for, which is the one bug that would make
 * the feature worse than nothing.
 *
 * It is HIDDEN FROM ASSISTIVE TECHNOLOGY. A menu announced and then withdrawn inside two seconds is
 * noise, and the same information lives in the command bar — which IS a dialog, with real focus, and
 * is reached by the very prefix this panel is describing.
 */

const SCOPE_LABELS = {
  global: () => t("fleet.command.scope.global"),
  space: () => t("fleet.command.scope.space"),
  tab: () => t("fleet.command.scope.tab"),
  pane: () => t("fleet.command.scope.pane"),
  navigation: () => t("fleet.command.scope.navigation"),
} satisfies Record<CommandScope, () => string>;

export interface FleetPrefixHintsProps {
  /** `null` while nothing is pending, or the operator has not waited long enough to be shown this. */
  hints: PrefixHints | null;
  /** How the prefix is spelled, so the panel says which key it is completing. */
  prefixLabel: string;
  /** Whether a command's scope has a target right now. A row without one is shown, and dimmed. */
  isAvailable: (scope: CommandScope) => boolean;
}

export function FleetPrefixHints({ hints, prefixLabel, isAvailable }: FleetPrefixHintsProps) {
  useLocale();
  if (hints === null || hints.groups.length === 0) return null;

  return (
    <div
      data-slot="fleet-prefix-hints"
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-2"
    >
      <div className="w-full max-w-5xl rounded-lg border border-rule bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
        <div className="mb-1.5 flex items-baseline gap-2">
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {prefixLabel}
          </kbd>
          <span className="text-[11px] text-muted-foreground">{t("fleet.command.hints.waiting")}</span>
          {hints.elided > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {t("fleet.command.hints.more", { count: hints.elided })}
            </span>
          )}
        </div>

        {/* Columns rather than a grid: the groups are wildly uneven, and a column flow keeps a short
            group from spending a whole track's worth of empty rows. */}
        <div className="[column-gap:1.25rem] [columns:2] sm:[columns:3] lg:[columns:4]">
          {hints.groups.map((group) => (
            <div key={group.scope} className="mb-2 break-inside-avoid">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {SCOPE_LABELS[group.scope]()}
              </div>
              {group.hints.map((hint) => (
                <div
                  key={`${hint.chord}:${hint.id}`}
                  data-slot="fleet-prefix-hint"
                  className={cn(
                    "flex items-baseline gap-1.5 text-[11px] leading-5",
                    // Listed either way — the panel describes the keyboard, not only this moment —
                    // but an entry that would not act says so by weight rather than by absence.
                    isAvailable(group.scope) ? "text-foreground" : "opacity-40",
                  )}
                >
                  <span className="shrink-0 font-mono text-muted-foreground">{hint.chord}</span>
                  <span className="min-w-0 truncate">{hint.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
