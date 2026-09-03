import { describe, expect, test } from "bun:test";

import { AuditLog } from "../../bridge/audit.ts";
import type { JsonValue } from "../../bridge/json.ts";
import { declareCapabilities } from "../../bridge/mux/capabilities.ts";
import type { SessionRuntime } from "../../bridge/sessions.ts";
import {
  ManualPaneFitControllerError,
  type PaneFitSize,
} from "./controller.ts";
import {
  createManualPaneFitAction,
  parseResizePaneInput,
  safeManualPaneFitFailure,
  type ManualPaneFitController,
  type ManualPaneFitResponse,
  type ManualPaneFitResponsePort,
} from "./action.ts";

class FakeController implements ManualPaneFitController {
  readonly calls: Array<{ socketPath: string; paneId: string; size: PaneFitSize }> = [];
  readonly releasedPanes: string[] = [];
  readonly releasedSessions: string[] = [];
  disposeCount = 0;
  failure: Error | null = null;

  async resize(socketPath: string, paneId: string, size: PaneFitSize): Promise<void> {
    this.calls.push({ socketPath, paneId, size });
    if (this.failure !== null) throw this.failure;
  }

  releasePane(socketPath: string, paneId: string): void {
    this.releasedPanes.push(`${socketPath}\u0000${paneId}`);
  }

  releaseSession(socketPath: string): void {
    this.releasedSessions.push(socketPath);
  }

  disposeAll(): void {
    this.disposeCount += 1;
  }
}

const responses: ManualPaneFitResponsePort = {
  json: (data, _acceptEncoding, status = 200) =>
    Response.json(data, { status }),
  text: (textBody, status) =>
    new Response(textBody, { status, headers: { "content-type": "text/plain" } }),
};

function stubPart<T>(value: Partial<T>): T {
  // SAFETY: tests call only the explicitly supplied methods; every other member is intentionally inert.
  return value as T;
}

function session(options: {
  readonly name?: string;
  readonly socketPath?: string;
  readonly supported?: boolean;
  readonly rows?: number;
} = {}): SessionRuntime {
  const capabilities = declareCapabilities({
    supports: options.supported === false ? [] : ["resizePane"],
    topologyLatency: { kind: "push" },
  });
  return stubPart<SessionRuntime>({
    name: options.name ?? "default",
    socketPath: options.socketPath ?? "/sessions/default/herdr.sock",
    isPrimary: true,
    herdr: stubPart<SessionRuntime["herdr"]>({ capabilities }),
    engine: stubPart<SessionRuntime["engine"]>({ paneViewportRows: () => options.rows }),
  });
}

function auditHarness() {
  const lines: string[] = [];
  return {
    audit: new AuditLog(async (line) => {
      lines.push(line);
    }, { now: () => 1_700_000_000_000 }),
    lines,
  };
}

async function responseBody(response: Response): Promise<ManualPaneFitResponse> {
  // SAFETY: every response in these tests is created by ManualPaneFitAction's closed response union.
  return await response.json() as ManualPaneFitResponse;
}

describe("manual Pane fit input and safe errors", () => {
  test("accepts a bounded cols field, and an optional bounded rows beside it", () => {
    expect(parseResizePaneInput({ cols: 20 })).toEqual({ ok: true, cols: 20, rows: null });
    expect(parseResizePaneInput({ cols: 500 })).toEqual({ ok: true, cols: 500, rows: null });
    // An explicit height, and the two ends the controller itself refuses past.
    expect(parseResizePaneInput({ cols: 80, rows: 24 })).toEqual({ ok: true, cols: 80, rows: 24 });
    expect(parseResizePaneInput({ cols: 80, rows: 0 })).toEqual({ ok: false, error: "bad rows" });
    expect(parseResizePaneInput({ cols: 80, rows: 65_536 })).toEqual({
      ok: false,
      error: "bad rows",
    });
    expect(parseResizePaneInput({ cols: 80, rows: 24.5 })).toEqual({
      ok: false,
      error: "bad rows",
    });
    const invalid: JsonValue[] = [
      null,
      [],
      {},
      { cols: 19 },
      { cols: 501 },
      { cols: 80.5 },
      { cols: "80" },
      // An unknown field is still refused; `rows` stopped being one.
      { cols: 80, height: 24 },
      { rows: 24 },
    ];
    for (const value of invalid) {
      expect(parseResizePaneInput(value).ok).toBeFalse();
    }
  });

  test("maps arbitrary failures to a closed public result", () => {
    expect(safeManualPaneFitFailure(new Error("/private/socket refused"))).toEqual({
      reason: "failed",
      error: "Pane resize failed",
    });
    expect(safeManualPaneFitFailure(new ManualPaneFitControllerError("conflict"))).toEqual({
      reason: "conflict",
      error: "Pane already has another controller",
    });
  });
});

describe("manual Pane fit server action", () => {
  test("rejects invalid JSON and unknown fields before acquisition", async () => {
    const controller = new FakeController();
    const action = createManualPaneFitAction(controller);
    const { audit, lines } = auditHarness();
    const badJson = await action.resize(
      session(),
      "w1:p1",
      new Request("http://localhost", { method: "POST", body: "{" }),
      audit,
      "phone",
      responses,
    );
    expect(badJson.status).toBe(400);
    const unknown = await action.resize(
      session(),
      "w1:p1",
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ cols: 80, height: 24 }),
      }),
      audit,
      "phone",
      responses,
    );
    expect(unknown.status).toBe(400);
    expect(controller.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  test("fails unsupported and missing rows closed before controller acquisition", async () => {
    const controller = new FakeController();
    const action = createManualPaneFitAction(controller);
    const { audit, lines } = auditHarness();
    const unsupported = await action.resize(
      session({ supported: false, rows: 24 }),
      "w1:p1",
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ cols: 80 }) }),
      audit,
      "phone",
      responses,
    );
    expect(await responseBody(unsupported)).toMatchObject({ ok: false, reason: "unsupported" });
    const geometry = await action.resize(
      session({ rows: undefined }),
      "w1:p1",
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ cols: 80 }) }),
      audit,
      "phone",
      responses,
    );
    expect(await responseBody(geometry)).toMatchObject({ ok: false, reason: "geometry" });
    expect(controller.calls).toEqual([]);
    await Bun.sleep(0);
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).not.toContain("/sessions/");
  });

  test("uses the trusted session socket and exact trusted rows, including cross-session scope", async () => {
    const controller = new FakeController();
    const action = createManualPaneFitAction(controller);
    const { audit, lines } = auditHarness();
    const response = await action.resize(
      session({ name: "work", socketPath: "/sessions/work/herdr.sock", rows: 37 }),
      "w1:p1",
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ cols: 91 }) }),
      audit,
      "phone",
      responses,
    );
    expect(await responseBody(response)).toEqual({ ok: true, cols: 91, rows: 37 });
    expect(controller.calls).toEqual([
      {
        socketPath: "/sessions/work/herdr.sock",
        paneId: "w1:p1",
        size: { cols: 91, rows: 37 },
      },
    ]);
    await Bun.sleep(0);
    expect(lines[0]).toContain('"action":"pane.resize"');
    expect(lines[0]).toContain('"session":"work"');
    expect(lines[0]).toContain('"cols":91');
    expect(lines[0]).toContain('"rows":37');
  });

  test("surfaces conflict safely and delegates exact lifecycle cleanup", async () => {
    const controller = new FakeController();
    controller.failure = new ManualPaneFitControllerError("conflict");
    const action = createManualPaneFitAction(controller);
    const { audit } = auditHarness();
    const response = await action.resize(
      session({ rows: 24 }),
      "w1:p1",
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ cols: 80 }) }),
      audit,
      "phone",
      responses,
    );
    expect(await responseBody(response)).toEqual({
      ok: false,
      error: "Pane already has another controller",
      reason: "conflict",
    });

    action.releasePane("/sessions/work/herdr.sock", "w1:p1");
    action.releaseSession("/sessions/work/herdr.sock");
    action.disposeAll();
    expect(controller.releasedPanes).toEqual(["/sessions/work/herdr.sock\u0000w1:p1"]);
    expect(controller.releasedSessions).toEqual(["/sessions/work/herdr.sock"]);
    expect(controller.disposeCount).toBe(1);
  });
});
