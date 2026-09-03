export const MAX_NAVIGATION_SPACES = 256;
export const MAX_NAVIGATION_TABS = 512;
export const MAX_NAVIGATION_PANES = 2048;
export const MAX_NAVIGATION_ID_LENGTH = 256;

export interface NavigationWorkspaceInput {
  workspaceId: string;
  label: string;
}

export interface NavigationTabInput {
  tabId: string;
  workspaceId: string;
  label: string;
}

export interface NavigationPaneInput {
  paneId: string;
  workspaceId: string;
  tabId: string;
  label: string;
  agent: string;
  kind?: "agent" | "shell";
}

export interface NavigationPaneNode extends NavigationPaneInput {
  selected: boolean;
}

export interface NavigationTabNode extends NavigationTabInput {
  disclosureId: string;
  panes: NavigationPaneNode[];
}

export interface NavigationSpaceNode extends NavigationWorkspaceInput {
  disclosureId: string;
  tabs: NavigationTabNode[];
}

export interface NavigationSelection {
  paneId: string;
  spaceDisclosureId: string;
  tabDisclosureId: string;
}

export interface NavigationTree {
  spaces: NavigationSpaceNode[];
  selection: NavigationSelection | null;
}

function validId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_NAVIGATION_ID_LENGTH;
}

export function spaceDisclosureId(workspaceId: string): string {
  return JSON.stringify(["space", workspaceId]);
}

export function tabDisclosureId(workspaceId: string, tabId: string): string {
  return JSON.stringify(["tab", workspaceId, tabId]);
}

export function deriveNavigationTree(input: {
  workspaces: readonly NavigationWorkspaceInput[];
  tabs: readonly NavigationTabInput[];
  agents: readonly NavigationPaneInput[];
  shellPanes: readonly NavigationPaneInput[];
  selectedPaneId?: string;
}): NavigationTree {
  const panes = [...input.agents, ...input.shellPanes]
    .filter(
      (pane) =>
        validId(pane.paneId) &&
        validId(pane.workspaceId) &&
        validId(pane.tabId) &&
        pane.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_PANES);
  const tabs = input.tabs
    .filter(
      (tab) =>
        validId(tab.tabId) &&
        validId(tab.workspaceId) &&
        tab.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_TABS);

  let selection: NavigationSelection | null = null;
  const spaces = input.workspaces
    .filter(
      (workspace) =>
        validId(workspace.workspaceId) && workspace.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_SPACES)
    .map((workspace): NavigationSpaceNode => {
      const spaceId = spaceDisclosureId(workspace.workspaceId);
      const spaceTabs = tabs
        .filter((tab) => tab.workspaceId === workspace.workspaceId)
        .map((tab): NavigationTabNode => {
          const tabId = tabDisclosureId(workspace.workspaceId, tab.tabId);
          const tabPanes = panes
            .filter(
              (pane) =>
                pane.workspaceId === workspace.workspaceId && pane.tabId === tab.tabId,
            )
            .map((pane): NavigationPaneNode => {
              const selected = pane.paneId === input.selectedPaneId;
              if (selected) {
                selection = {
                  paneId: pane.paneId,
                  spaceDisclosureId: spaceId,
                  tabDisclosureId: tabId,
                };
              }
              return {
                paneId: pane.paneId,
                workspaceId: pane.workspaceId,
                tabId: pane.tabId,
                label: pane.label,
                agent: pane.agent,
                kind: pane.kind,
                selected,
              };
            });
          return {
            tabId: tab.tabId,
            workspaceId: tab.workspaceId,
            label: tab.label,
            disclosureId: tabId,
            panes: tabPanes,
          };
        });
      return {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        disclosureId: spaceId,
        tabs: spaceTabs,
      };
    });

  return { spaces, selection };
}
