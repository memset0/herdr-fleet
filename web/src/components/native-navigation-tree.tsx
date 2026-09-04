import { ChevronRight, Folder, Server, ServerOff, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type {
  NavigationRow,
  NavigationSubject,
  NavigationTree,
  NavigationHostFault,
} from "../../../fleet/ui/native-navigation/model.ts";
import type { NativeNavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { nativeNavigationPreferences } from "../../../fleet/ui/native-navigation/preferences.ts";
import { AgentIcon } from "@/components/agent-icon";
import { usePack } from "@/components/pack-provider";
import { StatusDot } from "@/components/status-badge";
import { HOST_TEXT_CLASSES, hostSlot } from "@/lib/hosts";
import { Collapse } from "@/components/ui/collapse";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { useLongPress } from "@/hooks/use-long-press";

interface NativeNavigationTreeProps {
  tree: NavigationTree;
  selectedSpaceId?: string;
  onOpenSpace: (spaceId: string, host?: string) => void;
  onOpenPane: (paneId: string, host?: string) => void;
  /** Open the row's own actions — a right-click on a pointer, a long press on a thumb. */
  onRowActions?: (subject: NavigationSubject) => void;
  preferenceStore?: NativeNavigationPreferenceStore;
}

export function NativeNavigationTree({
  tree,
  selectedSpaceId,
  onOpenSpace,
  onOpenPane,
  onRowActions,
  preferenceStore = nativeNavigationPreferences,
}: NativeNavigationTreeProps) {
  useLocale();
  const preferences = useSyncExternalStore(
    preferenceStore.subscribe,
    preferenceStore.snapshot,
    preferenceStore.snapshot,
  );

  // AUTO-DISCLOSURE FIRES ON A CHANGE OF PANE, AND ON NOTHING ELSE.
  //
  // It used to run whenever the derived tree changed identity — which is every poll that moves any
  // field on any row — so collapsing the branch you are standing in was undone by the next snapshot
  // a second later. The operator collapses; the effect re-opens; nobody wins. Keyed on the selected
  // Pane's id instead, it does the one job it was written for: arriving at a Pane (a deep link, a
  // row in the Agent rail, a tap in this tree) reveals where you have arrived. Once you are there,
  // the branch is yours.
  const revealedFor = useRef<string | null>(null);
  useEffect(() => {
    const selection = tree.selection;
    if (selection === null || selection.paneId === revealedFor.current) return;
    revealedFor.current = selection.paneId;
    preferenceStore.ensureDisclosed(selection.ancestors);
  }, [preferenceStore, tree.selection]);

  const empty = tree.rows.every((row) => row.children.length === 0);
  if (empty) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">{t("fleet.navigation.empty")}</p>;
  }

  const disclosed = new Set(preferences.disclosed);
  const spaceIsCurrent = tree.selection === null;

  return (
    <nav aria-label={t("fleet.navigation.hierarchy")} className="flex flex-col p-1.5">
      {tree.rows.map((row) => (
        <Row
          key={row.key}
          row={row}
          disclosed={disclosed}
          spaceIsCurrent={spaceIsCurrent}
          selectedSpaceId={selectedSpaceId}
          onToggle={(id) => preferenceStore.toggleDisclosure(id)}
          onOpenSpace={onOpenSpace}
          onOpenPane={onOpenPane}
          onRowActions={onRowActions}
        />
      ))}
    </nav>
  );
}

interface RowProps {
  row: NavigationRow;
  disclosed: ReadonlySet<string>;
  spaceIsCurrent: boolean;
  selectedSpaceId: string | undefined;
  onToggle: (disclosureId: string) => void;
  onOpenSpace: (spaceId: string, host?: string) => void;
  onOpenPane: (paneId: string, host?: string) => void;
  onRowActions: ((subject: NavigationSubject) => void) | undefined;
}

/**
 * ONE row shape for every depth.
 *
 * The highlight lives on the row BOX, not on the label control, which is what makes it cover the
 * disclosure chevron as well — the previous tree put the chevron in a sibling button outside the
 * highlighted element, so a selected row was lit from its icon rightwards and dark under its own
 * arrow. The two controls stay separate elements because a button inside a button is invalid HTML;
 * the box that contains both is what carries the colour.
 *
 * The chevron column is the same width on a leaf as on a parent, so every label at a given depth
 * starts at the same x. That is also why the chevron is ONE icon rotated rather than two different
 * glyphs: a `ChevronRight` at 90° is the same drawing at the same size in both states, so nothing
 * shifts by a pixel when a row opens, and the rotation is the disclosure's own motion.
 */
function Row({
  row,
  disclosed,
  spaceIsCurrent,
  selectedSpaceId,
  onToggle,
  onOpenSpace,
  onOpenPane,
  onRowActions,
}: RowProps) {
  const disclosureId = row.disclosureId;
  // A Host's identity means CONCEALED (model.ts, `hostCollapseId`), so the same set answers both
  // kinds of row without the store knowing there are two.
  const open =
    disclosureId !== undefined &&
    (row.disclosureInverted === true ? !disclosed.has(disclosureId) : disclosed.has(disclosureId));
  const childrenId = disclosureId === undefined ? undefined : `fleet-navigation-${disclosureId}`;
  const selected =
    row.selected ||
    (spaceIsCurrent &&
      row.target?.kind === "space" &&
      row.target.workspaceId === selectedSpaceId);

  // A ROW THAT CAN DISCLOSE, DISCLOSES. A row wearing a disclosure control on its left and
  // navigating away when its label is tapped is two promises from one surface; the operator asked
  // for the tree to open rather than leave. The Space route stays reachable from the one Space row
  // that has nothing to open — and from every native surface that already offers it.
  const activate = () => {
    if (disclosureId !== undefined) onToggle(disclosureId);
    else if (row.target?.kind === "space") onOpenSpace(row.target.workspaceId, row.target.host);
    else if (row.target?.kind === "pane") onOpenPane(row.target.paneId, row.target.host);
  };

  // A row's own actions, reached the two ways a row is asked for them: a pointer's context menu and
  // a thumb's long press. Both resolve to the same sheet Collie already opens from its strips, so a
  // rename here is the rename the pane pill does — one write, one set of rules, one place.
  const subject = row.subject;
  const openActions =
    subject !== undefined && onRowActions !== undefined ? () => onRowActions(subject) : undefined;
  const longPress = useLongPress(openActions);

  return (
    <div className="min-w-0">
      {/* The gesture handlers sit on the ROW, not on one of its controls: a right-click or a long
          press anywhere in the row — the chevron included — asks for the same actions, and the
          hook's own capture-phase guard is what stops the long press from also activating the row. */}
      <div
        {...longPress}
        className={cn(
          // ONE DENSITY EVERYWHERE. The row used to be touch-sized below the rails' breakpoint and
          // compact above it, which made the phone's hierarchy a different surface from the
          // desktop's — the same list, read twice as tall. It is a tree of names, scanned rather
          // than aimed at, and its whole value is how much of the herd fits on one screen. The
          // rows that ARE aimed at on a phone — the Agent rail's, the strips, the composer's
          // controls — keep their own floors.
          "flex min-h-7 min-w-0 items-stretch rounded-md px-1.5",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        )}
      >
        {/* THE MACHINE TAKES THE ARROW'S COLUMN, on a Host row and only there.
            A Host row is the one row whose identity is worth more than its disclosure state. Every
            member of the roster is a row here — present or not, holding panes or not — so this list
            is scanned for "which machine is this, and is it up?", and an arrow answers neither. The
            glyph carries both: the machine's own tint (the same slot every other host-aware surface
            in Collie tints by) and, when it stops answering, a different glyph in the refusal colour.
            The row still discloses on click; what moved is where that state is announced — onto the
            label control below, which is the only control left on the row. */}
        {row.icon === "host" ? (
          <span className="grid w-5 shrink-0 place-items-center">
            <HostGlyph hostId={row.hostId ?? ""} fault={row.fault} />
          </span>
        ) : disclosureId !== undefined ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={childrenId}
            aria-label={
              open
                ? t("fleet.navigation.collapse", { name: row.label })
                : t("fleet.navigation.expand", { name: row.label })
            }
            onClick={() => onToggle(disclosureId)}
            className="grid w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
          </button>
        ) : null}
        <button
          type="button"
          aria-current={selected ? "page" : undefined}
          // The disclosure state rides the LABEL on a Host row, because the arrow that used to carry
          // it is gone and a disclosure with no announced state is one a screen reader cannot use.
          {...(row.icon === "host" && disclosureId !== undefined
            ? { "aria-expanded": open, "aria-controls": childrenId }
            : {})}
          onClick={activate}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <RowIcon row={row} />
          <span className="truncate">{row.label}</span>
          {/* The Agent's own logo took the leading slot, so the state moved to the trailing one —
              the SAME dot the Tab row draws (components/tab-strip.tsx), so one colour means one
              thing wherever it appears. `surface` is the rail's ground, because a resting state is
              a hollow ring and a ring filled with the wrong colour reads as a notch. */}
          {row.status !== undefined && (
            <>
              <StatusDot status={row.status} surface="bg-chrome" className="ml-auto size-2 shrink-0" />
              <span className="sr-only">{statusLabel(row.status)}</span>
            </>
          )}
          {/* …and the machine's own reading, in the same trailing position a Pane's state takes. A
              tinted glyph says WHICH machine but cannot say a machine is down without relying on
              colour alone (WCAG 1.4.1), so the word stands here when there is one to say. */}
          {row.icon === "host" && <HostState fault={row.fault} />}
        </button>
      </div>

      {row.children.length > 0 && (
        <div id={childrenId}>
          <Collapse open={open}>
            {/* THE LINE LANDS ON THE CHEVRON'S CENTRE, and the arithmetic is stated because it has
                two inputs and both have moved once already. The row above carries `px-1.5`, so its
                `w-5` chevron occupies 6..26px and its centre is at 16px — hence `ml-4`. The children
                then begin one chevron-width in from where that chevron STARTED (6 + 20 = 26px),
                which is `pl-2` past the line's own 1px: 16 + 1 + 8 = 25px, the same column the
                parent's label sits in. Change the row's padding or the chevron's width and both
                numbers move together; neither is a taste choice.

                A leaf draws no chevron at all, so the first thing inside its highlight is its own
                icon rather than an empty column. */}
            <div className="ml-4 flex flex-col border-l border-border/70 pl-2">
              {row.children.map((child) => (
                <Row
                  key={child.key}
                  row={child}
                  disclosed={disclosed}
                  spaceIsCurrent={spaceIsCurrent}
                  selectedSpaceId={selectedSpaceId}
                  onToggle={onToggle}
                  onOpenSpace={onOpenSpace}
                  onOpenPane={onOpenPane}
                  onRowActions={onRowActions}
                />
              ))}
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );
}

/**
 * A member that is not answering, and the word for why.
 *
 * THE FACT ARRIVES ON THE ROW rather than being derived here, because it was being derived in two
 * places and the two disagreed. The shell decides it once, from the lead's own refusal corroborated
 * by a receipt old enough that it is not a single missed sweep, and the model carries it down.
 *
 * What this row must never do is spell a stale receipt "unreachable". `lib/host-health.ts` states
 * the rule at the definition of the state itself: a stale receipt is about the RECEIPT, never about
 * reachability. Collie's own chip made that mistake once and fixed it; this row made it again, and a
 * member answering every single request was repainted down on every sweep.
 */
function faultWord(fault: NavigationHostFault | undefined): string | null {
  if (fault === "incompatible") return t("connection.host.incompatible");
  if (fault === "refused") return t("connection.host.unreachablePlain");
  return null;
}

function HostGlyph({ hostId, fault }: { hostId: string; fault?: NavigationHostFault }) {
  const { servers } = usePack();
  const slot = hostSlot(servers, hostId === "" ? undefined : hostId);
  const degraded = fault !== undefined;
  const Glyph = degraded ? ServerOff : Server;
  return (
    <Glyph
      className={cn(
        "size-3.5 shrink-0",
        // Alert outranks identity, the same order `AddressTag` keeps: which machine matters less
        // than the machine not being there.
        degraded
          ? "text-status-blocked"
          : slot !== null
            ? HOST_TEXT_CLASSES[slot]
            : "text-muted-foreground",
      )}
      aria-hidden
    />
  );
}

function HostState({ fault }: { fault?: NavigationHostFault }) {
  useLocale();
  const word = faultWord(fault);
  if (word === null) return null;
  return (
    <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-status-blocked">
      {word}
    </span>
  );
}

function RowIcon({ row }: { row: NavigationRow }) {
  if (row.icon === "group") {
    return <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (row.icon === "shell") {
    return <TerminalSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (row.icon === "agent") {
    return (
      <span aria-hidden>
        <AgentIcon agent={row.agent ?? ""} className="size-3.5 shrink-0" />
      </span>
    );
  }
  return null;
}
