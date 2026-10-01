import { Inbox, WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { rosterEntryKey } from "../../../fleet/ui/pane-roster.ts";
import { paneRosterFrom, pinnedAgents, togglePanePin } from "@/lib/fleet-roster";
import { NativeAgentCard } from "@/components/native-agent-card";
import { SectionHeader } from "@/components/section-header";
import { StatusSummaryLine } from "@/components/status-counts";
import { ListGroup } from "@/components/ui/list-group";
import { clockTime } from "@/lib/format";
import { paneRowKey } from "@/lib/hosts";
import { usePins } from "@/lib/pins";
import { ATTENTION, bucketOf, triage, type TriageKey, type TriageSection } from "@/lib/triage";
import type { AgentView, BridgeStatus, ServerSummary, TabView } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

interface NativeAgentRailProps {
  agents: AgentView[];
  bridge?: BridgeStatus | undefined;
  error?: boolean;
  lastSeenAt?: number;
  /** The snapshot's tabs and machines, for Collie's own pinned (place) order. */
  tabs?: readonly TabView[] | undefined;
  servers?: readonly ServerSummary[] | undefined;
  /** `rosterEntryKey` of the Pane the route is showing, or null on any other route. */
  currentKey?: string | null;
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
 * The Agent surface, in the rail and — below the rail's breakpoint — in the Pane page's switcher.
 *
 * WHAT IS COLLIE'S AND STAYS COLLIE'S: the classification, the pins and the summary. `triage` decides
 * the sections, their labels and their contents; Collie's pin store decides what is pinned and its
 * Pinned order; and the line above them is the dashboard's own `StatusSummaryLine` with the
 * dashboard's own all-clear predicate, so the rail never says "nothing needs you" beside a dashboard
 * counting an unseen reply. (The dashboard lays rows out by workspace — upstream ADR 0063 — but this
 * rail is the fleet's attention view and keeps the buckets.)
 *
 * PINNED LEADS, AS ON EVERY COLLIE LIST (ADR 0070), and each pinned pane is listed there once. The
 * star on a row IS Collie's pin: one mechanism, two doors (the star, and Collie's hold or sheet). A
 * bucket heading still counts every pane of its bucket, pinned or not — Collie's "no two headings
 * count one pane" — and a bucket left with no rows is dropped. The Pinned heading is Collie's muted
 * caption, with no dot and no count; the bucket headings take Collie's workspace-heading voice.
 *
 * THE EMPHASIS IS COLLIE'S ALERT MARK, read rather than copied: the section triage marks with
 * `accent` (needs you) is drawn as cards with air between them; every other row is a flat 44px row
 * in one bordered group. An unseen reply is marked by Collie's square, not by a card.
 *
 * The shortcut ordinal is numbered across the WHOLE rail rather than per section, because a key the
 * operator presses addresses one row on screen and does not know which heading it fell under. The
 * ORDER comes from the roster (fleet/ui/pane-roster.ts), which the command layer walks too.
 */
export function NativeAgentRail({
  agents,
  bridge,
  error = false,
  lastSeenAt,
  tabs,
  servers,
  currentKey = null,
  onOpen,
}: NativeAgentRailProps) {
  useLocale();
  const pins = usePins();
  const container = useRef<HTMLElement>(null);
  // A star moves its row between Pinned and its bucket, which remounts it. Focus goes back to the
  // star in its new place — looked up inside THIS rail, because the same rows are also mounted in
  // the Pane page's switcher sheet and a document-wide id would find the other copy.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const key = refocus.current;
    if (key === null) return;
    refocus.current = null;
    for (const row of container.current?.querySelectorAll<HTMLElement>('[data-slot="native-agent-card"]') ?? []) {
      if (row.dataset.rowKey === key) row.querySelector<HTMLElement>(":scope > button[aria-pressed]")?.focus();
    }
  });

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
  const pinned = pinnedAgents(agents, pins, tabs, servers);
  const roster = paneRosterFrom(all, [], servers, pinned);
  const ordered = new Map(roster.sections.map((section) => [section.key, section.entries]));
  const byKey = new Map(agents.map((agent) => [rosterEntryKey(agent), agent]));
  const resolve = (entries: readonly { paneId: string; host?: string; session?: string }[]) =>
    entries
      .map((entry) => byKey.get(rosterEntryKey(entry)))
      .filter((agent): agent is AgentView => agent !== undefined);
  // Collie's sections keep their own metadata — label, dot, accent, and the full count — and take
  // only their ROWS from the roster. A section the roster dropped is one with nothing left in it.
  const sections = all
    .map((section) => {
      const entries = ordered.get(section.key);
      return entries === undefined ? null : { section, rows: resolve(entries) };
    })
    .filter((s): s is { section: TriageSection; rows: AgentView[] } => s !== null);
  const pinnedRows = resolve(ordered.get("pinned") ?? []);
  // The dashboard's own predicate (agent-list.tsx `allClear`): nothing in an ATTENTION bucket.
  const allClear = !all.some((section) => ATTENTION.has(section.key) && section.agents.length > 0);
  let ordinal = -1;

  const row = (agent: AgentView, density: "card" | "row", age?: "seen" | "active") => {
    ordinal += 1;
    const key = rosterEntryKey(agent);
    return (
      <NativeAgentCard
        // The FULL row identity: a pane id is unique only within one session on one machine, so
        // keyed by the id alone React would recycle one row's element for another's between polls
        // and a tap would land in a different terminal.
        key={paneRowKey(agent)}
        agent={agent}
        index={ordinal}
        density={density}
        current={key === currentKey}
        rowKey={key}
        pinned={pinnedRows.includes(agent)}
        onPinToggle={() => {
          refocus.current = key;
          togglePanePin(agent, agents);
        }}
        onOpen={() => onOpen(agent)}
        {...(age ? { age } : {})}
      />
    );
  };

  return (
    <section
      ref={container}
      aria-label={t("fleet.navigation.agents")}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-3 p-1.5">
        <StatusSummaryLine panes={agents} allClear={allClear} className="px-1.5" />
        {pinnedRows.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionHeader label={t("home.pinned.title")} className="px-1.5" />
            <ListGroup>{pinnedRows.map((agent) => row(agent, "row", AGE_BY_SECTION.get(bucketOf(agent))))}</ListGroup>
          </section>
        )}
        {sections.map(({ section, rows }) => {
          const age = AGE_BY_SECTION.get(section.key);
          const card = section.accent === true;
          // A gap list for the cards, one bordered group for the flat rows — the dashboard's own
          // pairing, and `ListGroup`'s own rule: a card already IS the container.
          const Body = card ? "div" : ListGroup;
          return (
            <section key={section.key} className="flex flex-col gap-2">
              <SectionHeader
                label={section.label}
                count={section.agents.length}
                dot={section.dot}
                accent={card}
                tone="strong"
                className="px-1.5"
              />
              <Body className={card ? "flex flex-col gap-2" : undefined}>
                {rows.map((agent) => row(agent, card ? "card" : "row", age))}
              </Body>
            </section>
          );
        })}
      </div>
    </section>
  );
}
