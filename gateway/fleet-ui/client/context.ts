import { FLEET_RAIL_WIDTHS } from "../model/layout.ts";
import { DESKTOP_MEDIA, TERMINAL_DESKTOP_MEDIA } from "./constants.ts";
import {
  createFleetShortcutRecognizer,
  FLEET_SHORTCUT_SCHEMA_VERSION,
  type FleetEffectiveBinding,
  type FleetNodeState,
  type FleetShortcutRecognizer,
} from "../../../shared/fleet/index.ts";

export interface FleetShortcutBinding {
  commandId: string;
  kind: "direct" | "prefix";
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  label: string;
}

export interface FleetClientCommand {
  id: string;
  name: string;
  scope: string;
  bindings: FleetShortcutBinding[];
}

export interface FleetRoute {
  view: "home" | "pane";
  paneId?: string;
  spaceId?: string;
  tabId?: string;
  session?: string;
}

export interface FleetFrameEntry {
  id: string;
  origin: string;
  frame: HTMLIFrameElement;
  route: FleetRoute;
  frameKey: string | null;
  lastVisitedAt: number;
  loaded: boolean;
  loading: boolean;
  shortcutGeneration: number;
  shortcutProtocol: number | null;
  shortcutActions: Set<string>;
}

export interface FleetClientElements {
  shell: HTMLElement;
  hostSwitcher: HTMLElement;
  instances: HTMLElement;
  treeMenuToggle: HTMLButtonElement;
  treeMenuBackdrop: HTMLButtonElement;
  frameStage: HTMLElement;
  loading: HTMLElement;
  notice: HTMLElement;
  noticeText: HTMLElement;
  retryFrame: HTMLButtonElement;
  openNode: HTMLAnchorElement;
  empty: HTMLElement;
  emptyTitle: HTMLElement;
  emptyCopy: HTMLElement;
  retryInventory: HTMLButtonElement;
  fleetStatus: HTMLElement;
  agentMenu: HTMLElement;
  agentMenuToggle: HTMLButtonElement;
  agentMenuCount: HTMLElement;
  agentSections: HTMLElement;
  agentRefreshState: HTMLElement;
  hostRail: HTMLElement;
  hostRailFooter: HTMLElement;
  settingsAnchor: HTMLElement;
  hostRailResizer: HTMLElement;
  agentRailResizer: HTMLElement;
  settingsToggle: HTMLButtonElement;
  settingsPopover: HTMLElement;
  cacheSizeSelect: HTMLSelectElement;
  cacheReset: HTMLButtonElement;
  treeActionStatus: HTMLElement;
  shortcutToast: HTMLElement;
  commandDialog: HTMLElement;
  commandDialogBackdrop: HTMLButtonElement;
  commandDialogForm: HTMLFormElement;
  commandDialogTitle: HTMLElement;
  commandDialogInput: HTMLInputElement;
  commandDialogHint: HTMLElement;
  commandDialogError: HTMLElement;
  commandDialogResults: HTMLElement;
  commandDialogActions: HTMLElement;
  commandDialogCancel: HTMLButtonElement;
  commandDialogSave: HTMLButtonElement;
  spaceCloseDialog: HTMLElement;
  spaceCloseBackdrop: HTMLButtonElement;
  spaceCloseTitle: HTMLElement;
  spaceCloseImpact: HTMLElement;
  spaceCloseError: HTMLElement;
  spaceCloseCancel: HTMLButtonElement;
  spaceCloseConfirm: HTMLButtonElement;
  treeContextMenu: HTMLElement;
  treeContextRename: HTMLButtonElement;
  treeContextClose: HTMLButtonElement;
  treeContextError: HTMLElement;
}

export interface FleetClientRuntime {
  document: Document;
  window: Window;
  fetch: typeof globalThis.fetch;
  storage: Storage;
  location: Location;
  history: History;
  clipboard: Pick<Clipboard, "writeText"> | undefined;
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  matchMedia: (query: string) => MediaQueryList;
  viewportWidth: () => number;
}

const unavailableStorage: Storage = {
  length: 0,
  clear() {},
  getItem() {
    return null;
  },
  key() {
    return null;
  },
  removeItem() {},
  setItem() {},
};

function staticMediaQuery(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  };
}

type FleetClientService = (...args: any[]) => any;
type FleetClientServiceName =
  | "acknowledgeCommand"
  | "actionRequestId"
  | "activatePaletteCommand"
  | "activateTreeContextClose"
  | "activeEntry"
  | "agentFavoriteIcon"
  | "agentFavoriteKey"
  | "agentParts"
  | "announce"
  | "appendPaneTreatment"
  | "applyRailWidthPreferences"
  | "baseName"
  | "bindRailResizer"
  | "bindTreeContextActions"
  | "brand"
  | "broadcastFrameActivity"
  | "bucket"
  | "cancelDialogsForRoute"
  | "cancelShortcutPrefix"
  | "cancelSpaceClose"
  | "canonicalPaneRoute"
  | "chooseNode"
  | "clearRefreshTimer"
  | "closeAgentMenu"
  | "closeCommandDialog"
  | "closeSettings"
  | "closeTreeContextMenu"
  | "closeTreeMenu"
  | "commandAvailable"
  | "commandBindingLabel"
  | "commandBindingLabels"
  | "commandHasBinding"
  | "confirmSpaceClose"
  | "contextCloseLabel"
  | "contextTargetAffectsCurrent"
  | "copyCurrentPaneLink"
  | "createCurrentTab"
  | "createPaneFromSpace"
  | "createSpaceFromHost"
  | "currentRenameTarget"
  | "currentRouteAuthoritativelyMissing"
  | "currentRouteTargetKey"
  | "currentTreeContext"
  | "currentTreeRow"
  | "cycleAgentShortcut"
  | "cyclePaneShortcut"
  | "dialogTargetKey"
  | "disarmTreeContextClose"
  | "disclosureRow"
  | "dispatchCommand"
  | "dispatchNodeAction"
  | "dispatchSelectedShortcutAction"
  | "element"
  | "ensureFrame"
  | "evictionCandidate"
  | "exactMessageKeys"
  | "failPendingAction"
  | "finishPendingAction"
  | "finishPendingShortcutCommand"
  | "finishRailDrag"
  | "fitRailWidths"
  | "focusSelectedFrame"
  | "focusTreeKey"
  | "formatDelay"
  | "frameActivityActive"
  | "frameHref"
  | "handleActionMessage"
  | "handleDisclosureKey"
  | "handleShortcutMessage"
  | "healthLabel"
  | "initials"
  | "loadSelected"
  | "makeFrame"
  | "movePaletteSelection"
  | "navigateLastPane"
  | "navigatePaneInTab"
  | "navigateTab"
  | "nodeOrigin"
  | "openAgentMenu"
  | "openCommandPalette"
  | "openCurrentTreeClose"
  | "openRename"
  | "openSettings"
  | "openSpaceClose"
  | "openTreeContextMenu"
  | "openTreeMenu"
  | "paletteMatches"
  | "paletteResultButton"
  | "paneIdentityState"
  | "paneLabel"
  | "persistAgentFavorites"
  | "persistIframeCachePreference"
  | "persistRailWidthPreferences"
  | "placeTreeContextMenu"
  | "postActionProbe"
  | "postFrameActivity"
  | "postFrameShortcutConfig"
  | "prunePaneMru"
  | "quietCleanup"
  | "railMaximum"
  | "railWidthFromPointer"
  | "readAgentFavorites"
  | "readIframeCachePreference"
  | "readRailWidthPreferences"
  | "recognizeShortcut"
  | "reconcileFrames"
  | "recordPaneFocus"
  | "refresh"
  | "releaseFrame"
  | "remember"
  | "remembered"
  | "renderAgentCard"
  | "renderAgents"
  | "renderCommandPalette"
  | "renderHostSwitcher"
  | "renderInventory"
  | "renderRailWidths"
  | "renderTabs"
  | "renderTree"
  | "replaceUrl"
  | "requested"
  | "requestedRoute"
  | "routeIdentity"
  | "routeKey"
  | "routeTargetKey"
  | "scheduleQuietCleanup"
  | "scheduleRefresh"
  | "selectAgent"
  | "selectAgentShortcut"
  | "selectCanonicalPaneTarget"
  | "selectNode"
  | "selectTreeNode"
  | "selectedNode"
  | "selectedPaneCommandAvailable"
  | "sendPendingAction"
  | "setIframeCacheSize"
  | "setRailWidth"
  | "setSidebarsCollapsed"
  | "shortCwd"
  | "shortcutFrameActive"
  | "shortcutPaneKey"
  | "showCommandToast"
  | "showEmpty"
  | "showOnlyFrame"
  | "showTreeActionStatus"
  | "shrinkFrameCache"
  | "sortAgentEntries"
  | "statusColor"
  | "statusLabel"
  | "submitRename"
  | "syncAgentMenuLayout"
  | "syncCurrentAgentControl"
  | "syncTerminalEntry"
  | "syncTreePresentation"
  | "terminalHref"
  | "timeAgo"
  | "toggleAgentFavorite"
  | "toggleTree"
  | "trapDialogFocus"
  | "treeChevron"
  | "treeChildrenGroup"
  | "treeFocusKeyForRoute"
  | "treeKey"
  | "updateHealth"
  | "updateRailSeparator"
  | "validActionResult"
  | "validCorrelationId"
  | "validPane"
  | "validSession"
  | "validShortcutResult"
  | "validTabPanes"
  | "validTerminalSession"
  | "visitFrame";

export type FleetClientServices = Record<
  FleetClientServiceName,
  FleetClientService
> &
  Record<string, FleetClientService>;

export interface FleetClientState {
  iframeCacheSize: number;
  defaultCacheSize: number;
  agentFavorites: Set<string>;
  frameRegistry: Map<string, FleetFrameEntry>;
  expandedTreeKeys: Set<string>;
  initializedHostKeys: Set<string>;
  nodes: FleetNodeState[];
  selectedId: string | null;
  refreshing: boolean;
  queuedManualRefresh: boolean;
  refreshTimer: number | null;
  quietTimer: number | null;
  lastFrameVisitAt: number;
  desktopMode: boolean;
  treeOpen: boolean;
  preferredRailWidths: { left: number; right: number };
  appliedRailWidths: { left: number; right: number };
  railDrag: {
    handle: HTMLElement;
    side: "left" | "right";
    pointerId: number;
  } | null;
  sidebarsCollapsed: boolean;
  pendingAction: any;
  commandDialogState: any;
  spaceCloseState: any;
  spaceCloseTimer: number | null;
  treeContextTarget: any;
  treeContextInvoker: HTMLElement | null;
  treeContextArmedTimer: number | null;
  actionStatusTimer: number | null;
  shortcutToastTimer: number | null;
  pendingFavoriteFocusKey: string | null;
  paneShortcutTargets: any[];
  agentShortcutTargets: any[];
  paneMru: any[];
  shortcutGeneration: number;
  pendingShortcutCommand: any;
  shortcutPendingAt: number | null;
  shortcutPrefixTimer: number | null;
  recentShortcutIntents: Set<string>;
}

export interface FleetClientContext {
  runtime: FleetClientRuntime;
  elements: FleetClientElements;
  state: FleetClientState;
  desktopMedia: MediaQueryList;
  terminalDesktopMedia: MediaQueryList;
  commandCatalog: FleetClientCommand[];
  commandsById: Map<string, FleetClientCommand>;
  shortcutBindings: FleetShortcutBinding[];
  shortcutPrefix: FleetShortcutBinding;
  shortcutRecognizer: FleetShortcutRecognizer;
  services: FleetClientServices;
}

function required<T extends Element>(document: Document, selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value)
    throw new Error(`Fleet page is missing required element: ${selector}`);
  return value;
}

export function browserFleetRuntime(): FleetClientRuntime {
  let storage = unavailableStorage;
  try {
    storage = window.localStorage;
  } catch {
    // An opaque or storage-disabled origin keeps bounded in-memory defaults.
  }
  return {
    document,
    window,
    fetch: globalThis.fetch.bind(globalThis),
    storage,
    location,
    history,
    clipboard: navigator.clipboard,
    now: Date.now,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    requestAnimationFrame:
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(() => callback(performance.now()), 0),
    matchMedia:
      typeof window.matchMedia === "function"
        ? window.matchMedia.bind(window)
        : staticMediaQuery,
    viewportWidth: () => window.innerWidth,
  };
}

export function createFleetClientContext(
  runtime: FleetClientRuntime = browserFleetRuntime(),
): FleetClientContext {
  const { document } = runtime;
  const elements: FleetClientElements = {
    shell: required(document, ".fleet-shell"),
    hostSwitcher: required(document, "#host-switcher"),
    instances: required(document, "#instances"),
    treeMenuToggle: required(document, "#tree-menu-toggle"),
    treeMenuBackdrop: required(document, "#tree-menu-backdrop"),
    frameStage: required(document, "#frame-stage"),
    loading: required(document, "#frame-loading"),
    notice: required(document, "#node-notice"),
    noticeText: required(document, "#notice-text"),
    retryFrame: required(document, "#retry-frame"),
    openNode: required(document, "#open-node"),
    empty: required(document, "#empty-state"),
    emptyTitle: required(document, "#empty-title"),
    emptyCopy: required(document, "#empty-copy"),
    retryInventory: required(document, "#retry-inventory"),
    fleetStatus: required(document, "#fleet-status"),
    agentMenu: required(document, "#agent-menu"),
    agentMenuToggle: required(document, "#agent-menu-toggle"),
    agentMenuCount: required(document, "#agent-menu-count"),
    agentSections: required(document, "#agent-sections"),
    agentRefreshState: required(document, "#agent-refresh-state"),
    hostRail: required(document, "#host-rail"),
    hostRailFooter: required(document, "#host-rail-footer"),
    settingsAnchor: required(document, ".fleet-settings-anchor"),
    hostRailResizer: required(document, "#host-rail-resizer"),
    agentRailResizer: required(document, "#agent-rail-resizer"),
    settingsToggle: required(document, "#fleet-settings-toggle"),
    settingsPopover: required(document, "#fleet-settings"),
    cacheSizeSelect: required(document, "#iframe-cache-size"),
    cacheReset: required(document, "#iframe-cache-reset"),
    treeActionStatus: required(document, "#tree-action-status"),
    shortcutToast: required(document, "#shortcut-toast"),
    commandDialog: required(document, "#command-dialog"),
    commandDialogBackdrop: required(document, "#command-dialog-backdrop"),
    commandDialogForm: required(document, "#command-dialog-form"),
    commandDialogTitle: required(document, "#command-dialog-title"),
    commandDialogInput: required(document, "#command-dialog-input"),
    commandDialogHint: required(document, "#command-dialog-hint"),
    commandDialogError: required(document, "#command-dialog-error"),
    commandDialogResults: required(document, "#command-dialog-results"),
    commandDialogActions: required(document, "#command-dialog-actions"),
    commandDialogCancel: required(document, "#command-dialog-cancel"),
    commandDialogSave: required(document, "#command-dialog-save"),
    spaceCloseDialog: required(document, "#space-close-dialog"),
    spaceCloseBackdrop: required(document, "#space-close-backdrop"),
    spaceCloseTitle: required(document, "#space-close-title"),
    spaceCloseImpact: required(document, "#space-close-impact"),
    spaceCloseError: required(document, "#space-close-error"),
    spaceCloseCancel: required(document, "#space-close-cancel"),
    spaceCloseConfirm: required(document, "#space-close-confirm"),
    treeContextMenu: required(document, "#tree-context-menu"),
    treeContextRename: required(document, "#tree-context-rename"),
    treeContextClose: required(document, "#tree-context-close"),
    treeContextError: required(document, "#tree-context-error"),
  };

  const shortcutRows = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".fleet-shortcuts [data-command-id]",
    ),
  );
  const commandCatalog: FleetClientCommand[] = shortcutRows.map((row) => ({
    id: row.dataset.commandId ?? "",
    name: row.dataset.commandName ?? "",
    scope: row.dataset.commandScope ?? "",
    bindings: Array.from(
      row.querySelectorAll<HTMLElement>("kbd[data-binding-kind]"),
    ).map((binding) => ({
      commandId: row.dataset.commandId ?? "",
      kind: binding.dataset.bindingKind === "prefix" ? "prefix" : "direct",
      code: binding.dataset.bindingCode ?? "",
      altKey: binding.dataset.bindingAlt === "1",
      ctrlKey: binding.dataset.bindingCtrl === "1",
      metaKey: binding.dataset.bindingMeta === "1",
      shiftKey: binding.dataset.bindingShift === "1",
      label: binding.dataset.bindingLabel ?? "",
    })),
  }));
  const configuredCacheSize = Number(elements.shell.dataset.iframeCacheSize);
  const defaultCacheSize =
    Number.isSafeInteger(configuredCacheSize) &&
    configuredCacheSize >= 1 &&
    configuredCacheSize <= 10
      ? configuredCacheSize
      : 1;
  const desktopMedia = runtime.matchMedia(DESKTOP_MEDIA);
  const terminalDesktopMedia = runtime.matchMedia(TERMINAL_DESKTOP_MEDIA);
  const shortcutBindings = commandCatalog.flatMap(
    (command) => command.bindings,
  );
  const shortcutPrefix: FleetShortcutBinding = {
    commandId: "",
    kind: "prefix",
    code: elements.shell.dataset.shortcutPrefixCode ?? "",
    altKey: elements.shell.dataset.shortcutPrefixAlt === "1",
    ctrlKey: elements.shell.dataset.shortcutPrefixCtrl === "1",
    metaKey: elements.shell.dataset.shortcutPrefixMeta === "1",
    shiftKey: elements.shell.dataset.shortcutPrefixShift === "1",
    label: elements.shell.dataset.shortcutPrefixLabel ?? "Prefix",
  };
  const effectiveBindings: FleetEffectiveBinding[] = shortcutBindings.map(
    (binding) => ({
      commandId: binding.commandId,
      kind: binding.kind,
      chord: {
        code: binding.code,
        altKey: binding.altKey,
        ctrlKey: binding.ctrlKey,
        metaKey: binding.metaKey,
        shiftKey: binding.shiftKey,
        label: binding.label,
      },
      label:
        binding.kind === "prefix"
          ? `${shortcutPrefix.label} ${binding.label}`
          : binding.label,
    }),
  );

  return {
    runtime,
    elements,
    desktopMedia,
    terminalDesktopMedia,
    commandCatalog,
    commandsById: new Map(
      commandCatalog.map((command) => [command.id, command]),
    ),
    shortcutBindings,
    shortcutPrefix,
    shortcutRecognizer: createFleetShortcutRecognizer(
      {
        schemaVersion: FLEET_SHORTCUT_SCHEMA_VERSION,
        prefix: shortcutPrefix,
        bindings: effectiveBindings,
        bindingsByCommand: Object.fromEntries(
          commandCatalog.map((command) => [
            command.id,
            effectiveBindings.filter(
              (binding) => binding.commandId === command.id,
            ),
          ]),
        ),
      },
      runtime.now,
    ),
    services: {} as FleetClientServices,
    state: {
      iframeCacheSize: defaultCacheSize,
      defaultCacheSize,
      agentFavorites: new Set<string>(),
      frameRegistry: new Map(),
      expandedTreeKeys: new Set(),
      initializedHostKeys: new Set(),
      nodes: [],
      selectedId: null,
      refreshing: false,
      queuedManualRefresh: false,
      refreshTimer: null,
      quietTimer: null,
      lastFrameVisitAt: runtime.now(),
      desktopMode: desktopMedia.matches,
      treeOpen: false,
      preferredRailWidths: {
        left: FLEET_RAIL_WIDTHS.leftDefault,
        right: FLEET_RAIL_WIDTHS.rightDefault,
      },
      appliedRailWidths: {
        left: FLEET_RAIL_WIDTHS.leftDefault,
        right: FLEET_RAIL_WIDTHS.rightDefault,
      },
      railDrag: null,
      sidebarsCollapsed: false,
      pendingAction: null,
      commandDialogState: null,
      spaceCloseState: null,
      spaceCloseTimer: null,
      treeContextTarget: null,
      treeContextInvoker: null,
      treeContextArmedTimer: null,
      actionStatusTimer: null,
      shortcutToastTimer: null,
      pendingFavoriteFocusKey: null,
      paneShortcutTargets: [],
      agentShortcutTargets: [],
      paneMru: [],
      shortcutGeneration: 0,
      pendingShortcutCommand: null,
      shortcutPendingAt: null,
      shortcutPrefixTimer: null,
      recentShortcutIntents: new Set(),
    },
  };
}

export function initializeFleetClientState(context: FleetClientContext): void {
  context.state.iframeCacheSize = context.services.readIframeCachePreference!();
  context.state.agentFavorites = context.services.readAgentFavorites!();
  context.state.preferredRailWidths =
    context.services.readRailWidthPreferences!();
}
