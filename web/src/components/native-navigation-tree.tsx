import { ChevronDown, ChevronRight, Folder, TerminalSquare } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import type {
  NavigationTree,
} from "../../../fleet/ui/native-navigation/model.ts";
import type {
  NativeNavigationPreferenceStore,
} from "../../../fleet/ui/native-navigation/preferences.ts";
import { nativeNavigationPreferences } from "../../../fleet/ui/native-navigation/preferences.ts";
import { AgentIcon } from "@/components/agent-icon";
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
    if (tree.selection) {
      preferenceStore.ensureDisclosed(
        tree.selection.spaceDisclosureId,
        tree.selection.tabDisclosureId,
      );
    }
  }, [preferenceStore, tree.selection]);

  if (tree.spaces.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">{t("fleet.navigation.empty")}</p>;
  }

  return (
    <nav aria-label={t("fleet.navigation.hierarchy")} className="flex flex-col gap-1 p-2">
      {tree.spaces.map((space) => {
        const spaceOpen =
          preferences.disclosedSpaces.includes(space.disclosureId) ||
          tree.selection?.spaceDisclosureId === space.disclosureId;
        const selectedSpace =
          selectedSpaceId === space.workspaceId ||
          tree.selection?.spaceDisclosureId === space.disclosureId;
        const spaceChildrenId = `fleet-navigation-${space.disclosureId}`;
        return (
          <section key={space.workspaceId} className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                aria-expanded={spaceOpen}
                aria-controls={spaceChildrenId}
                aria-label={
                  spaceOpen
                    ? t("fleet.navigation.collapseSpace", { name: space.label })
                    : t("fleet.navigation.expandSpace", { name: space.label })
                }
                onClick={() => preferenceStore.toggleDisclosure("space", space.disclosureId)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {spaceOpen ? (
                  <ChevronDown className="size-4" aria-hidden />
                ) : (
                  <ChevronRight className="size-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-current={selectedSpace && !tree.selection ? "page" : undefined}
                onClick={() => onOpenSpace(space.workspaceId)}
                className={cn(
                  "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent px-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selectedSpace ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{space.label}</span>
              </button>
            </div>

            <div
              id={spaceChildrenId}
              hidden={!spaceOpen}
              aria-hidden={!spaceOpen}
              inert={!spaceOpen ? true : undefined}
              className="ml-4 border-l border-border pl-2"
            >
              {space.tabs.map((tab) => {
                const tabOpen =
                  preferences.disclosedTabs.includes(tab.disclosureId) ||
                  tree.selection?.tabDisclosureId === tab.disclosureId;
                const tabChildrenId = `fleet-navigation-${tab.disclosureId}`;
                return (
                  <div key={tab.tabId} className="min-w-0">
                    <button
                      type="button"
                      aria-expanded={tabOpen}
                      aria-controls={tabChildrenId}
                      onClick={() => preferenceStore.toggleDisclosure("tab", tab.disclosureId)}
                      className="flex min-h-9 w-full min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {tabOpen ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="truncate">{tab.label}</span>
                    </button>
                    <div
                      id={tabChildrenId}
                      hidden={!tabOpen}
                      aria-hidden={!tabOpen}
                      inert={!tabOpen ? true : undefined}
                      className="ml-4 border-l border-border pl-2"
                    >
                      {tab.panes.map((pane) => (
                        <button
                          key={pane.paneId}
                          type="button"
                          aria-current={pane.selected ? "page" : undefined}
                          onClick={() => onOpenPane(pane.paneId)}
                          className={cn(
                            "flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md border border-transparent px-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            pane.selected
                              ? "border-border bg-accent text-accent-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          {pane.kind === "shell" ? (
                            <TerminalSquare
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          ) : (
                            <span aria-hidden>
                              <AgentIcon agent={pane.agent} className="size-4 shrink-0" />
                            </span>
                          )}
                          <span className="truncate">{pane.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
