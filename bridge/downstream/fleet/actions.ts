import type { AuditLog } from "../../audit.ts";
import type { HerdrClient } from "../../herdr-client.ts";
import type { StateEngine } from "../../state-engine.ts";
import { TerminalResizeManager, validTerminalColumns } from "./terminal-resize.ts";

const WORKSPACE_ACTION_ROUTE = /^\/api\/workspace\/([^/]+)\/(rename|close)$/;
const OBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface FleetWorkspaceAction {
  workspaceId: string;
  action: "rename" | "close";
}

export interface FleetResponsePort {
  json(data: unknown, acceptEncoding: string | null, status?: number): Response;
  text(body: string, status: number): Response;
}

export interface FleetBridgeSession {
  herdr: Pick<HerdrClient, "renameWorkspace" | "closeWorkspace">;
  engine: Pick<StateEngine, "paneViewportRows">;
  socketPath: string;
  name: string;
}

export interface PaneResizeController {
  resize(
    socketPath: string,
    paneId: string,
    size: { cols: number; rows: number },
  ): Promise<void>;
  disposeAll(): void;
}

export interface FleetBridgeActions {
  matchWorkspace(pathname: string): FleetWorkspaceAction | null;
  workspace(
    target: FleetWorkspaceAction,
    session: FleetBridgeSession,
    request: Request,
    audit: AuditLog,
    device: string | null,
    responses: FleetResponsePort,
  ): Promise<Response>;
  resize(
    session: FleetBridgeSession,
    paneId: string,
    request: Request,
    audit: AuditLog,
    device: string | null,
    responses: FleetResponsePort,
  ): Promise<Response>;
  dispose(): void;
}

export function matchFleetWorkspaceAction(
  pathname: string,
): FleetWorkspaceAction | null {
  const match = WORKSPACE_ACTION_ROUTE.exec(pathname);
  if (!match) return null;
  try {
    const workspaceId = decodeURIComponent(match[1]!);
    if (!OBJECT_ID.test(workspaceId)) return null;
    return { workspaceId, action: match[2] as "rename" | "close" };
  } catch {
    return null;
  }
}

export function normalizeWorkspaceLabel(
  value: unknown,
): { ok: true; label: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "bad label" };
  const label = value.trim();
  return label ? { ok: true, label } : { ok: false, error: "label required" };
}

export function createFleetBridgeActions({
  terminalResize = new TerminalResizeManager(),
}: {
  terminalResize?: PaneResizeController;
} = {}): FleetBridgeActions {
  return {
    matchWorkspace: matchFleetWorkspaceAction,

    async workspace(target, session, request, audit, device, responses) {
      const acceptEncoding = request.headers.get("accept-encoding");
      if (target.action === "close") {
        try {
          await session.herdr.closeWorkspace(target.workspaceId);
          audit.record({
            action: "workspace.close",
            session: session.name,
            device,
            detail: { workspaceId: target.workspaceId },
          });
          return responses.json({ ok: true }, acceptEncoding);
        } catch (cause) {
          return responses.json(
            { ok: false, error: errorMessage(cause) },
            acceptEncoding,
          );
        }
      }

      let body: { label?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return responses.text("bad body", 400);
      }
      const label = normalizeWorkspaceLabel(body.label);
      if (!label.ok) return responses.text(label.error, 400);
      try {
        await session.herdr.renameWorkspace(target.workspaceId, label.label);
        audit.record({
          action: "workspace.rename",
          session: session.name,
          device,
          detail: { workspaceId: target.workspaceId, label: label.label },
        });
        return responses.json({ ok: true }, acceptEncoding);
      } catch (cause) {
        return responses.json(
          { ok: false, error: errorMessage(cause) },
          acceptEncoding,
        );
      }
    },

    async resize(session, paneId, request, audit, device, responses) {
      const acceptEncoding = request.headers.get("accept-encoding");
      let body: { cols?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return responses.text("bad body", 400);
      }
      if (!validTerminalColumns(body.cols)) return responses.text("bad cols", 400);

      const rows = session.engine.paneViewportRows(paneId);
      if (rows === undefined) {
        const error = "Pane geometry is not available yet";
        audit.record({
          action: "pane.resize",
          paneId,
          session: session.name,
          device,
          detail: { cols: body.cols, resized: false, error },
        });
        return responses.json({ ok: false, error }, acceptEncoding);
      }

      try {
        await terminalResize.resize(session.socketPath, paneId, {
          cols: body.cols,
          rows,
        });
        audit.record({
          action: "pane.resize",
          paneId,
          session: session.name,
          device,
          detail: { cols: body.cols, rows, resized: true },
        });
        return responses.json({ ok: true, cols: body.cols, rows }, acceptEncoding);
      } catch (cause) {
        const error = errorMessage(cause);
        audit.record({
          action: "pane.resize",
          paneId,
          session: session.name,
          device,
          detail: { cols: body.cols, rows, resized: false, error },
        });
        return responses.json({ ok: false, error }, acceptEncoding);
      }
    },

    dispose() {
      terminalResize.disposeAll();
    },
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
