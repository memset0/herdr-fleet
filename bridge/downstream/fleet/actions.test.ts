import { describe, expect, mock, test } from "bun:test";

import { AuditLog } from "../../audit.ts";
import {
  createFleetBridgeActions,
  matchFleetWorkspaceAction,
  normalizeWorkspaceLabel,
  type FleetBridgeSession,
  type FleetResponsePort,
} from "./actions.ts";

const responses: FleetResponsePort = {
  json: (data, _acceptEncoding, status = 200) =>
    Response.json(data, { status }),
  text: (body, status) => new Response(body, { status }),
};

function request(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function session(rows = 37) {
  const renameWorkspace = mock(async () => {});
  const closeWorkspace = mock(async () => {});
  const value: FleetBridgeSession = {
    herdr: { renameWorkspace, closeWorkspace },
    engine: { paneViewportRows: (paneId) => paneId === "w1:p1" ? rows : undefined },
    socketPath: "/tmp/herdr.sock",
    name: "demo",
  };
  return { value, renameWorkspace, closeWorkspace };
}

describe("Fleet Bridge actions", () => {
  test("matches only exact bounded Workspace actions", () => {
    expect(matchFleetWorkspaceAction("/api/workspace/w1/rename")).toEqual({
      workspaceId: "w1",
      action: "rename",
    });
    expect(matchFleetWorkspaceAction("/api/workspace/w1/close/extra")).toBeNull();
    expect(matchFleetWorkspaceAction("/api/workspace/%2E%2E/close")).toBeNull();
    expect(matchFleetWorkspaceAction("/api/workspace/w1/fetch")).toBeNull();
  });

  test("normalizes non-empty labels and rejects every widened shape", () => {
    expect(normalizeWorkspaceLabel("  Research  ")).toEqual({
      ok: true,
      label: "Research",
    });
    expect(normalizeWorkspaceLabel("   ")).toEqual({ ok: false, error: "label required" });
    expect(normalizeWorkspaceLabel(null)).toEqual({ ok: false, error: "bad label" });
  });

  test("renames and closes the exact Workspace at most once", async () => {
    const target = session();
    const entries: string[] = [];
    const audit = new AuditLog((line) => void entries.push(line));
    const actions = createFleetBridgeActions({
      terminalResize: { resize: mock(async () => {}), disposeAll: mock(() => {}) },
    });

    const renamed = await actions.workspace(
      { workspaceId: "w1", action: "rename" },
      target.value,
      request("/api/workspace/w1/rename", { label: " Research " }),
      audit,
      "phone",
      responses,
    );
    const closed = await actions.workspace(
      { workspaceId: "w1", action: "close" },
      target.value,
      request("/api/workspace/w1/close"),
      audit,
      "phone",
      responses,
    );

    expect(await renamed.json()).toEqual({ ok: true });
    expect(await closed.json()).toEqual({ ok: true });
    expect(target.renameWorkspace).toHaveBeenCalledTimes(1);
    expect(target.renameWorkspace).toHaveBeenCalledWith("w1", "Research");
    expect(target.closeWorkspace).toHaveBeenCalledTimes(1);
    expect(entries.map((line) => JSON.parse(line).action)).toEqual([
      "workspace.rename",
      "workspace.close",
    ]);
  });

  test("resizes with server-owned rows and releases its controller", async () => {
    const resize = mock(async () => {});
    const disposeAll = mock(() => {});
    const actions = createFleetBridgeActions({
      terminalResize: { resize, disposeAll },
    });
    const target = session(41);
    const response = await actions.resize(
      target.value,
      "w1:p1",
      request("/api/pane/w1%3Ap1/resize", { cols: 72 }),
      new AuditLog(() => {}),
      null,
      responses,
    );

    expect(await response.json()).toEqual({ ok: true, cols: 72, rows: 41 });
    expect(resize).toHaveBeenCalledWith(
      "/tmp/herdr.sock",
      "w1:p1",
      { cols: 72, rows: 41 },
    );
    actions.dispose();
    expect(disposeAll).toHaveBeenCalledTimes(1);
  });

  test("fails closed before controller acquisition when geometry is unavailable", async () => {
    const resize = mock(async () => {});
    const actions = createFleetBridgeActions({
      terminalResize: { resize, disposeAll: mock(() => {}) },
    });
    const response = await actions.resize(
      session().value,
      "missing",
      request("/api/pane/missing/resize", { cols: 72 }),
      new AuditLog(() => {}),
      null,
      responses,
    );

    expect(await response.json()).toEqual({
      ok: false,
      error: "Pane geometry is not available yet",
    });
    expect(resize).not.toHaveBeenCalled();
  });

  test("rejects invalid columns and surfaces controller conflicts without retry", async () => {
    const resize = mock(async () => {
      throw new Error("terminal already has a controller");
    });
    const actions = createFleetBridgeActions({
      terminalResize: { resize, disposeAll: mock(() => {}) },
    });
    const target = session();

    const invalid = await actions.resize(
      target.value,
      "w1:p1",
      request("/api/pane/w1%3Ap1/resize", { cols: 80.5 }),
      new AuditLog(() => {}),
      null,
      responses,
    );
    expect(invalid.status).toBe(400);
    expect(resize).not.toHaveBeenCalled();

    const conflict = await actions.resize(
      target.value,
      "w1:p1",
      request("/api/pane/w1%3Ap1/resize", { cols: 80 }),
      new AuditLog(() => {}),
      null,
      responses,
    );
    expect(await conflict.json()).toEqual({
      ok: false,
      error: "terminal already has a controller",
    });
    expect(resize).toHaveBeenCalledTimes(1);
  });
});
