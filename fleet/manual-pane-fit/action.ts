import type { AuditLog } from "../../bridge/audit.ts";
import type { AuditDetail } from "../../bridge/audit.ts";
import type { JsonValue } from "../../bridge/json.ts";
import type { SessionRuntime } from "../../bridge/sessions.ts";
import { supportsCapability } from "../../bridge/mux/capabilities.ts";
import { jsonNumberField, jsonRecord } from "../../bridge/stt/json.ts";
import {
  ManualPaneFitControllerError,
  ManualPaneFitControllerManager,
  validPaneFitColumns,
  validPaneFitRows,
  type PaneFitSize,
} from "./controller.ts";

export type ManualPaneFitFailure = "unsupported" | "geometry" | "conflict" | "failed";

export type ManualPaneFitResponse =
  | { readonly ok: true; readonly cols: number; readonly rows: number }
  | {
      readonly ok: false;
      readonly error: string;
      readonly reason: ManualPaneFitFailure;
    };

export interface ManualPaneFitResponsePort {
  json(data: JsonValue, acceptEncoding: string | null, status?: number): Response;
  text(body: string, status: number): Response;
}

export interface ManualPaneFitController {
  resize(socketPath: string, paneId: string, size: PaneFitSize): Promise<void>;
  releasePane(socketPath: string, paneId: string): void;
  releaseSession(socketPath: string): void;
  disposeAll(): void;
}

export interface ManualPaneFitAction {
  resize(
    session: SessionRuntime,
    paneId: string,
    request: Request,
    audit: AuditLog,
    device: string | null,
    responses: ManualPaneFitResponsePort,
  ): Promise<Response>;
  releasePane(socketPath: string, paneId: string): void;
  releaseSession(socketPath: string): void;
  disposeAll(): void;
}

export type ResizePaneInput =
  | { readonly ok: true; readonly cols: number }
  | { readonly ok: false; readonly error: "bad body" | "bad cols" };

export function parseResizePaneInput(value: JsonValue): ResizePaneInput {
  const record = jsonRecord(value);
  if (record === null) return { ok: false, error: "bad body" };
  const fields = Object.keys(record);
  if (fields.length !== 1 || fields[0] !== "cols") return { ok: false, error: "bad body" };
  const cols = jsonNumberField(record.cols);
  return cols !== null && validPaneFitColumns(cols)
    ? { ok: true, cols }
    : { ok: false, error: "bad cols" };
}

interface SafeManualPaneFitFailure {
  readonly reason: "conflict" | "failed";
  readonly error: string;
}

export function safeManualPaneFitFailure(cause: unknown): SafeManualPaneFitFailure {
  if (cause instanceof ManualPaneFitControllerError && cause.failure === "conflict") {
    return { reason: "conflict", error: "Pane already has another controller" };
  }
  return { reason: "failed", error: "Pane resize failed" };
}

export function createManualPaneFitAction(
  controller: ManualPaneFitController = new ManualPaneFitControllerManager(),
): ManualPaneFitAction {
  return {
    async resize(session, paneId, request, audit, device, responses) {
      let body: JsonValue;
      try {
        // SAFETY: Request.json() returns the JsonValue representation; parseResizePaneInput closes it.
        body = await request.json() as JsonValue;
      } catch {
        return responses.text("bad body", 400);
      }
      const input = parseResizePaneInput(body);
      if (!input.ok) return responses.text(input.error, 400);

      const acceptEncoding = request.headers.get("accept-encoding");
      if (!supportsCapability(session.herdr.capabilities, "resizePane")) {
        return failedResponse(
          "unsupported",
          "Pane resize is not supported",
          session,
          paneId,
          input.cols,
          undefined,
          audit,
          device,
          responses,
          acceptEncoding,
        );
      }

      const rows = session.engine.paneViewportRows(paneId);
      if (!validPaneFitRows(rows)) {
        return failedResponse(
          "geometry",
          "Pane geometry is not available yet",
          session,
          paneId,
          input.cols,
          rows,
          audit,
          device,
          responses,
          acceptEncoding,
        );
      }

      try {
        await controller.resize(session.socketPath, paneId, { cols: input.cols, rows });
      } catch (cause) {
        const failure = safeManualPaneFitFailure(cause);
        return failedResponse(
          failure.reason,
          failure.error,
          session,
          paneId,
          input.cols,
          rows,
          audit,
          device,
          responses,
          acceptEncoding,
        );
      }

      audit.record({
        action: "pane.resize",
        paneId,
        session: session.name,
        device,
        detail: { cols: input.cols, rows, resized: true },
      });
      return responses.json(
        { ok: true, cols: input.cols, rows } satisfies ManualPaneFitResponse,
        acceptEncoding,
      );
    },

    releasePane(socketPath, paneId) {
      controller.releasePane(socketPath, paneId);
    },

    releaseSession(socketPath) {
      controller.releaseSession(socketPath);
    },

    disposeAll() {
      controller.disposeAll();
    },
  };
}

function failedResponse(
  reason: ManualPaneFitFailure,
  error: string,
  session: SessionRuntime,
  paneId: string,
  cols: number,
  rows: number | undefined,
  audit: AuditLog,
  device: string | null,
  responses: ManualPaneFitResponsePort,
  acceptEncoding: string | null,
): Response {
  const detail: AuditDetail = {
    cols,
    resized: false,
    reason,
  };
  if (rows !== undefined) detail.rows = rows;
  audit.record({
    action: "pane.resize",
    paneId,
    session: session.name,
    device,
    detail,
  });
  return responses.json(
    { ok: false, error, reason } satisfies ManualPaneFitResponse,
    acceptEncoding,
  );
}
