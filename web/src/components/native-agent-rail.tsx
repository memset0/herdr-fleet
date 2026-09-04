import { Check, Inbox, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

import { agentFavoriteStore, favoriteFirst } from "../../../fleet/ui/agent-favorites.ts";
import { ATTENTION } from "@/components/agent-list";
import { NativeAgentCard } from "@/components/native-agent-card";
import { SectionHeader } from "@/components/section-header";
import { ListGroup } from "@/components/ui/list-group";
import { clockTime } from "@/lib/format";
import { paneRowKey } from "@/lib/hosts";
import { sectionHeaderProps, triage, type TriageKey } from "@/lib/triage";
import type { AgentView, BridgeStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

interface NativeAgentRailProps {
  agents: AgentView[];
  bridge?: BridgeStatus | undefined;
  error?: boolean;
  lastSeenAt?: number;
  onOpen: (agent: AgentView) => void;
}

/** Which timestamp a section's rows date themselves by — Collie's own rule, unchanged: a blocked
 *  agent's age is noise beside the fact that it is blocked. */
const AGE_BY_SECTION = new Map<TriageKey, "seen" | "active">([
  ["ready", "active"],
  ["working", "active"],
  ["recent", "seen"],
]);

/**
 * The Agent surface, in the rail and — on a narrow viewport — in the Pane page's switcher sheet.
 *
 * WHAT IS COLLIE'S AND STAYS COLLIE'S: the order. `triage` decides the sections and their contents,
 * `sectionHeaderProps` names them, and `SectionHeader` draws them, so "what needs me" is answered
 * here exactly as it is on the dashboard. What the fork owns is the ROW — see NativeAgentCard for
 * why a 320px rail beside the work reads its two lines in the other order from a full-width list.
 *
 * FAVOURITES ARE UNCHANGED: the same browser-local store, the same favourite-first ordering inside
 * each section, and the same toggle, now on the row itself.
 *
 * SO IS THE EMPHASIS. `ATTENTION` — Collie's own set, read rather than copied — decides which
 * sections are drawn as cards with air between them and which are flat rows in one bordered group.
 * Every row a card was the fork's mistake and the dashboard's file already warned about it: card
 * chrome on 100% of rows is wallpaper, not emphasis, and it throws away the priority `triage()` has
 * just computed. Ready·unseen stands out here for exactly the reason it stands out there.
 *
 * The shortcut ordinal is numbered across the WHOLE rail rather than per section, because a key the
 * operator presses addresses one row on screen and does not know which heading it fell under.
 */
export function NativeAgentRail({
  agents,
  bridge,
  error = false,
  lastSeenAt,
  onOpen,
}: NativeAgentRailProps) {
  useLocale();
  useSyncExternalStore(
    agentFavoriteStore.subscribe,
    agentFavoriteStore.snapshot,
    agentFavoriteStore.snapshot,
  );

  if (agents.length === 0) {
    return (
      <section aria-label={t("fleet.navigation.agents")} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-muted-foreground">
          {error ? <WifiOff className="size-6" /> : <Inbox className="size-6" />}
          {/* An empty herd on a stale render means "we do not know", never "nothing is running" —
              Collie's own distinction, kept word for word. */}
          <span className="text-center text-xs">
            {error
              ? lastSeenAt === undefined
                ? t("home.empty.disconnected")
                : t("home.empty.disconnectedAt", { time: clockTime(lastSeenAt) })
              : bridge === "connected"
                ? t("home.empty.noAgents")
                : t("home.empty.waiting")}
          </span>
        </div>
      </section>
    );
  }

  const all = triage(agents, "newest");
  for (const section of all) {
    section.agents = favoriteFirst(section.agents, agentFavoriteStore.isFavorite);
  }
  const sections = all.filter((s) => s.agents.length > 0);
  const allClear = all.find((s) => s.key === "needs")?.agents.length === 0;
  let ordinal = -1;

  return (
    <section aria-label={t("fleet.navigation.agents")} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 p-1.5">
        {allClear === true && (
          <p className="flex items-center gap-2 px-1.5 text-xs font-medium">
            <Check className="size-4 shrink-0 text-status-done" aria-hidden />
            {t("home.allClear")}
          </p>
        )}
        {sections.map((section) => {
          const age = AGE_BY_SECTION.get(section.key);
          const attention = ATTENTION.has(section.key);
          // A gap list for the cards, one bordered group for the flat rows — the dashboard's own
          // pairing, and `ListGroup`'s own rule: a card already IS the container, so wrapping a run
          // of them would be a box inside a box.
          const Body = attention ? "div" : ListGroup;
          const rows = section.agents.map((agent) => {
            ordinal += 1;
            return (
                  <NativeAgentCard
                    // The FULL row identity: a pane id is unique only within one session on one
                    // machine, so keyed by the id alone React would recycle one row's element for
                    // another's between polls and a tap would land in a different terminal.
                    key={paneRowKey(agent)}
                    agent={agent}
                    index={ordinal}
                    density={attention ? "card" : "row"}
                    favorite={agentFavoriteStore.isFavorite(agent)}
                    onFavoriteToggle={() => agentFavoriteStore.toggle(agent)}
                    onOpen={() => onOpen(agent)}
                    {...(age ? { age } : {})}
                  />
            );
          });
          return (
            <section key={section.key} className="flex flex-col gap-2">
              <SectionHeader {...sectionHeaderProps(section)} />
              <Body className={attention ? "flex flex-col gap-2" : undefined}>{rows}</Body>
            </section>
          );
        })}
      </div>
    </section>
  );
}
