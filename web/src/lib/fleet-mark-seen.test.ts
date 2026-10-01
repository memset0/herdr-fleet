import { HttpResponse, http } from "msw";

import { server } from "@/test/setup";
import type { Scope } from "@/lib/scope";
import type { AgentView } from "@/lib/types";
import { MARK_SEEN_CONCURRENCY, markPanesSeen } from "./fleet-mark-seen";

function pane(paneId: string, host?: string): AgentView {
  const view: AgentView = {
    paneId,
    workspaceId: "w1",
    workspaceLabel: "Project",
    workspaceNumber: 1,
    tabId: "t1",
    tabLabel: paneId,
    agent: "claude",
    status: "done",
    cwd: "/repo",
    focused: false,
    lastActiveAt: 200,
    lastSeenAt: 100,
  };
  if (host !== undefined) view.host = host;
  return view;
}

const scopeOf = (agent: AgentView): Scope => (agent.host === undefined ? {} : { host: agent.host });

describe("markPanesSeen", () => {
  it("sends one seen read per pane, on the pane's own host, through Collie's pane route", async () => {
    const seen: { path: string; host: string | null; header: string | null; lines: string | null }[] = [];
    server.use(
      http.get("/api/pane/:id", ({ request, params }) => {
        const url = new URL(request.url);
        seen.push({
          path: String(params.id),
          host: url.searchParams.get("host"),
          header: request.headers.get("x-collie-seen"),
          lines: url.searchParams.get("lines"),
        });
        return HttpResponse.json({ paneId: params.id, text: "" }, { headers: { etag: `"${String(params.id)}"` } });
      }),
    );
    const marked = await markPanesSeen([pane("p1"), pane("p2", "peer-a")], scopeOf);
    expect(marked).toBe(2);
    expect(seen.toSorted((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: "p1", host: null, header: "1", lines: "1" },
      { path: "p2", host: "peer-a", header: "1", lines: "1" },
    ]);
  });

  it("keeps at most a few reads in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const read = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    };
    const panes = Array.from({ length: 11 }, (_, i) => pane(`p${i}`));
    expect(await markPanesSeen(panes, scopeOf, read)).toBe(11);
    expect(peak).toBe(MARK_SEEN_CONCURRENCY);
  });

  it("carries on past a read that fails, and counts only the ones that landed", async () => {
    const asked: string[] = [];
    const read = async (paneId: string) => {
      asked.push(paneId);
      if (paneId === "gone") throw new Error("404");
    };
    expect(await markPanesSeen([pane("p1"), pane("gone"), pane("p3")], scopeOf, read)).toBe(2);
    expect(asked.toSorted()).toEqual(["gone", "p1", "p3"]);
  });

  it("does nothing with nothing to mark", async () => {
    const read = vi.fn(async () => {});
    expect(await markPanesSeen([], scopeOf, read)).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });
});
