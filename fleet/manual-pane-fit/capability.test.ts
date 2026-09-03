import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { MUX_ADAPTERS } from "../../bridge/mux/registry.ts";

describe("manual Pane fit capability and route port", () => {
  test("only Herdr advertises resizePane", () => {
    const target = { endpoint: "unused", timeoutMs: 100, options: {} };
    const claims = Object.fromEntries(
      MUX_ADAPTERS.map((factory) => [factory.mux, factory.create(target).capabilities.supports.resizePane]),
    );
    expect(claims).toEqual({ herdr: true, tmux: false, zellij: false });
  });

  test("the protected Pane route classifies resize as a write and dispatches the owned action", () => {
    const source = readFileSync(new URL("../../bridge/server.ts", import.meta.url), "utf8");
    expect(source).toContain("const PANE_RESIZE_ROUTE = /^\\/api\\/pane\\/([^/]+)\\/resize$/");
    expect(source).toContain('const isRead = !action || action === "history"');
    expect(source).toContain('paneResizeMatch === null ? paneMatch[2] : "resize"');
    expect(source).toContain('action === "resize" && req.method === "POST"');
    expect(source).toContain("manualPaneFit.resize(rt, paneId, req, audit_, device");
  });
});
