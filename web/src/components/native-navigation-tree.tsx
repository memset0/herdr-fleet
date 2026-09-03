import { ChevronRight, Folder, TerminalSquare } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import type { NavigationRow, NavigationTree } from "../../../fleet/ui/native-navigation/model.ts";
import type { NativeNavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { nativeNavigationPreferences } from "../../../fleet/ui/native-navigation/preferences.ts";
import { AgentIcon } from "@/components/agent-icon";
import { Collapse } from "@/components/ui/collapse";
import { t } from "@/lib/i18n";
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

  useEffect(() => {
    if (tree.selection) preferenceStore.ensureDisclosed(tree.selection.ancestors);
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
            className="grid w-7 shrink-0 place-items-center rounded-l-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          aria-current={selected ? "page" : undefined}
          onClick={activate}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-r-md pr-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring xl:text-[13px]"
        >
          <RowIcon row={row} />
          <span className="truncate">{row.label}</span>
        </button>
      </div>

      {row.children.length > 0 && (
        <div id={childrenId}>
          <Collapse open={open}>
            <div className="ml-1.5 flex flex-col border-l border-border/70 pl-1">
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
