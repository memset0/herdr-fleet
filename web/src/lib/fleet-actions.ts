import * as api from "./api";

export const FLEET_ACTION_PROBE_TYPE = "herdr-web-remote:action-probe";
export const FLEET_ACTION_READY_TYPE = "herdr-web-remote:action-ready";
export const FLEET_ACTION_REQUEST_TYPE = "herdr-web-remote:action-request";
export const FLEET_ACTION_RESULT_TYPE = "herdr-web-remote:action-result";
export const FLEET_ACTION_VERSION = 1;

export type FleetActionName =
  | "create-workspace"
  | "create-tab"
  | "rename-workspace"
  | "close-workspace"
  | "rename-tab"
  | "rename-pane"
  | "close-tab"
  | "close-pane";

export interface FleetActionProbe {
  type: typeof FLEET_ACTION_PROBE_TYPE;
  version: typeof FLEET_ACTION_VERSION;
  requestId: string;
}

export interface FleetActionReady {
  type: typeof FLEET_ACTION_READY_TYPE;
  version: typeof FLEET_ACTION_VERSION;
  requestId: string;
}

export type FleetActionRequest =
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "create-workspace";
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "create-tab";
      workspaceId: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "rename-workspace";
      workspaceId: string;
      label: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "close-workspace";
      workspaceId: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "rename-tab";
      tabId: string;
      label: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "rename-pane";
      paneId: string;
      label: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "close-tab";
      tabId: string;
      session?: string;
    }
  | {
      type: typeof FLEET_ACTION_REQUEST_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "close-pane";
      paneId: string;
      session?: string;
    };

export type FleetActionResult =
  | {
      type: typeof FLEET_ACTION_RESULT_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: FleetActionName;
      ok: false;
      error: string;
    }
  | {
      type: typeof FLEET_ACTION_RESULT_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "create-workspace" | "create-tab";
      ok: true;
      pane: { paneId: string; workspaceId: string; tabId: string };
    }
  | {
      type: typeof FLEET_ACTION_RESULT_TYPE;
      version: typeof FLEET_ACTION_VERSION;
      requestId: string;
      action: "rename-workspace" | "close-workspace" | "rename-tab" | "rename-pane" | "close-tab" | "close-pane";
      ok: true;
    };

type MessageListener = (event: MessageEvent<unknown>) => void;

export interface FleetActionEnvironment {
  framed: boolean;
  parent: MessageEventSource | null;
  addMessageListener(listener: MessageListener): void;
  removeMessageListener(listener: MessageListener): void;
  postParent(message: FleetActionReady | FleetActionResult): void;
}

export interface FleetActionApi {
  createWorkspace(opts: Record<string, never>, session?: string): ReturnType<typeof api.createWorkspace>;
  createTab(workspaceId: string, opts: Record<string, never>, session?: string): ReturnType<typeof api.createTab>;
  renameWorkspace(workspaceId: string, label: string, session?: string): ReturnType<typeof api.renameWorkspace>;
  closeWorkspace(workspaceId: string, session?: string): ReturnType<typeof api.closeWorkspace>;
  renameTab(tabId: string, label: string, session?: string): ReturnType<typeof api.renameTab>;
  renamePane(paneId: string, label: string, session?: string): ReturnType<typeof api.renamePane>;
  closeTab(tabId: string, session?: string): ReturnType<typeof api.closeTab>;
  closePane(paneId: string, session?: string): ReturnType<typeof api.closePane>;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;
const OBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_LABEL_LENGTH = 256;
const MAX_RESULTS = 64;
const PROBE_KEYS = new Set(["type", "version", "requestId"]);

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID.test(value);
}

function validObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value);
}

function validSession(value: unknown): value is string {
  return (
    typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= 128
    && !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function validLabel(value: unknown, allowBlank: boolean): value is string {
  return (
    typeof value === "string"
    && value.length <= MAX_LABEL_LENGTH
    && (allowBlank || value.trim().length > 0)
  );
}

export function isFleetActionProbe(value: unknown): value is FleetActionProbe {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    exactKeys(record, PROBE_KEYS)
    && record.type === FLEET_ACTION_PROBE_TYPE
    && record.version === FLEET_ACTION_VERSION
    && validRequestId(record.requestId)
  );
}

export function parseFleetActionRequest(value: unknown): FleetActionRequest | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    record.type !== FLEET_ACTION_REQUEST_TYPE
    || record.version !== FLEET_ACTION_VERSION
    || !validRequestId(record.requestId)
    || (record.session !== undefined && !validSession(record.session))
  ) {
    return null;
  }
  const common = new Set(["type", "version", "requestId", "action", "session"]);
  if (record.action === "create-workspace") {
    return exactKeys(record, new Set(["type", "version", "requestId", "action"]))
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "create-tab") {
    const keys = new Set([...common, "workspaceId"]);
    return exactKeys(record, keys) && validObjectId(record.workspaceId)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "rename-workspace") {
    const keys = new Set([...common, "workspaceId", "label"]);
    return exactKeys(record, keys) && validObjectId(record.workspaceId) && validLabel(record.label, false)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "close-workspace") {
    const keys = new Set([...common, "workspaceId"]);
    return exactKeys(record, keys) && validObjectId(record.workspaceId)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "rename-tab") {
    const keys = new Set([...common, "tabId", "label"]);
    return exactKeys(record, keys) && validObjectId(record.tabId) && validLabel(record.label, false)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "rename-pane") {
    const keys = new Set([...common, "paneId", "label"]);
    return exactKeys(record, keys) && validObjectId(record.paneId) && validLabel(record.label, true)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "close-tab") {
    const keys = new Set([...common, "tabId"]);
    return exactKeys(record, keys) && validObjectId(record.tabId)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  if (record.action === "close-pane") {
    const keys = new Set([...common, "paneId"]);
    return exactKeys(record, keys) && validObjectId(record.paneId)
      ? (record as unknown as FleetActionRequest)
      : null;
  }
  return null;
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return (normalized || "Action failed").slice(0, 240);
}

function failure(request: FleetActionRequest, error: unknown): FleetActionResult {
  return {
    type: FLEET_ACTION_RESULT_TYPE,
    version: FLEET_ACTION_VERSION,
    requestId: request.requestId,
    action: request.action,
    ok: false,
    error: publicError(error),
  };
}

async function runAction(request: FleetActionRequest, client: FleetActionApi): Promise<FleetActionResult> {
  try {
    if (request.action === "create-workspace" || request.action === "create-tab") {
      const result = request.action === "create-workspace"
        ? await client.createWorkspace({}, undefined)
        : await client.createTab(request.workspaceId, {}, request.session);
      if (!result.ok) return failure(request, result.error);
      const { paneId, workspaceId, tabId } = result.pane;
      if (!validObjectId(paneId) || !validObjectId(workspaceId) || !validObjectId(tabId)) {
        return failure(request, "Node returned an invalid Pane");
      }
      return {
        type: FLEET_ACTION_RESULT_TYPE,
        version: FLEET_ACTION_VERSION,
        requestId: request.requestId,
        action: request.action,
        ok: true,
        pane: { paneId, workspaceId, tabId },
      };
    }
    const result = request.action === "rename-workspace"
      ? await client.renameWorkspace(request.workspaceId, request.label.trim(), request.session)
      : request.action === "close-workspace"
        ? await client.closeWorkspace(request.workspaceId, request.session)
        : request.action === "rename-tab"
          ? await client.renameTab(request.tabId, request.label.trim(), request.session)
          : request.action === "rename-pane"
            ? await client.renamePane(request.paneId, request.label.trim(), request.session)
            : request.action === "close-tab"
              ? await client.closeTab(request.tabId, request.session)
              : await client.closePane(request.paneId, request.session);
    return result.ok
      ? {
          type: FLEET_ACTION_RESULT_TYPE,
          version: FLEET_ACTION_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: true,
        }
      : failure(request, result.error);
  } catch (error) {
    return failure(request, error);
  }
}

export function createFleetActionController(
  environment: FleetActionEnvironment,
  client: FleetActionApi = api,
): () => () => void {
  const results = new Map<string, Promise<FleetActionResult>>();
  let started = false;

  const onMessage: MessageListener = (event) => {
    if (!environment.framed || event.source !== environment.parent) return;
    if (isFleetActionProbe(event.data)) {
      environment.postParent({
        type: FLEET_ACTION_READY_TYPE,
        version: FLEET_ACTION_VERSION,
        requestId: event.data.requestId,
      });
      return;
    }
    const request = parseFleetActionRequest(event.data);
    if (!request) return;
    let result = results.get(request.requestId);
    if (!result) {
      result = runAction(request, client);
      results.set(request.requestId, result);
      if (results.size > MAX_RESULTS) results.delete(results.keys().next().value as string);
    }
    void result.then((message) => environment.postParent(message));
  };

  const stop = () => {
    if (!started) return;
    started = false;
    environment.removeMessageListener(onMessage);
  };

  return () => {
    if (!started) {
      started = true;
      environment.addMessageListener(onMessage);
    }
    return stop;
  };
}

const startBrowserFleetActions = createFleetActionController({
  framed: window.parent !== window,
  parent: window.parent,
  addMessageListener: (listener) => window.addEventListener("message", listener),
  removeMessageListener: (listener) => window.removeEventListener("message", listener),
  // The child cannot discover Fleet's exact origin under the deliberate no-referrer policy. Fleet
  // correlates this exact child WindowProxy and its configured node origin before accepting it.
  postParent: (message) => window.parent.postMessage(message, "*"),
});

export function startFleetActions(): () => void {
  return startBrowserFleetActions();
}
