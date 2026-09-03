import { ChevronRight, Folder, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { NavigationRow, NavigationTree } from "../../../fleet/ui/native-navigation/model.ts";
import type { NativeNavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { nativeNavigationPreferences } from "../../../fleet/ui/native-navigation/preferences.ts";
import { AgentIcon } from "@/components/agent-icon";
import { StatusDot } from "@/components/status-badge";
import { Collapse } from "@/components/ui/collapse";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface NativeNavigationTreeProps {
  tree: NavigationTree;
  selectedSpaceId?: string;
  onOpenSpace: (spaceId: string) => void;
  onOpenPane: (paneId: string) => void;
  preferenceStore?: NativeNavigationPreferenceStore;
}

export function NativeNavigationTree({
  tree,
  selectedSpaceId,
  onOpenSpace,
  onOpenPane,
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
  onOpenSpace: (spaceId: string) => void;
  onOpenPane: (paneId: string) => void;
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
    else if (row.target?.kind === "space") onOpenSpace(row.target.workspaceId);
    else if (row.target?.kind === "pane") onOpenPane(row.target.paneId);
  };

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex min-h-11 min-w-0 items-stretch rounded-md xl:min-h-7",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        )}
      >
        {disclosureId !== undefined ? (
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
            className="grid w-5 shrink-0 place-items-center rounded-l-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
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
          onClick={activate}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-r-md pl-1 pr-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring xl:text-[13px]"
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
        </button>
      </div>

      {row.children.length > 0 && (
        <div id={childrenId}>
          <Collapse open={open}>
            {/* HALF A CHEVRON OUT, HALF A CHEVRON IN. The guide line lands on the centre of the
                control that opened this level — `ml-2.5` against the `w-5` chevron above — and the
                children begin a further half in, so a child's row starts exactly one chevron right
                of its parent's. A leaf draws no chevron at all, so the first thing inside its
                highlight is its own icon rather than an empty column. */}
            <div className="ml-2.5 flex flex-col border-l border-border/70 pl-2.5">
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
                />
              ))}
            </div>
          </Collapse>
        </div>
      )}
    </div>
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
