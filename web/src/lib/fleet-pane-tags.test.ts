import { describe, expect, it } from "vitest";
import { createPaneTagClient, tagPanePlace } from "./fleet-pane-tags";
import { emptyTags, tagsForPane } from "../../../fleet/pane-tags/document.ts";
import type { AgentView } from "./types";

const pane = { row: "lead\u0000work\u0000pane-1", space: "Project" };
const snapshot = { version: "one", document: { ...emptyTags(), tags: [{ id: "t1", name: "Review", color: "#123456" }], panes: [{ ...pane, tags: ["t1"] }] } };

describe("shared pane tag client", () => {
  it("keeps a late refresh from replacing a newer mutation", async () => {
    let release: (response: Response) => void = () => { throw new Error("not started"); };
    let reads = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      if (init?.method === "POST") return Response.json(snapshot);
      if (++reads === 1) return Response.json({ version: "", document: emptyTags() });
      return new Promise<Response>((resolve) => { release = resolve; });
    };
    const client = createPaneTagClient(fetcher);
    await client.refresh();
    const refresh = client.refresh();
    await client.mutate({ kind: "attach", pane, name: "Review" });
    release(Response.json({ version: "", document: emptyTags() }));
    await refresh;
    expect(client.getSnapshot().snapshot).toEqual(snapshot);
  });

  it("exposes current state on conflict without claiming a successful write", async () => {
    const fetcher: typeof fetch = async (_url, init) => Response.json(snapshot, { status: init?.method === "POST" ? 409 : 200 });
    const client = createPaneTagClient(fetcher);
    await client.refresh();
    expect(await client.mutate({ kind: "attach", pane, name: "Another" })).toBe(false);
    expect(client.getSnapshot()).toMatchObject({ snapshot, error: "conflict", busy: false });
  });

  it("submits an edit draft's original version even after a background refresh", async () => {
    let posted = "";
    const fetcher: typeof fetch = async (_url, init) => {
      if (init?.method === "POST") posted = String(init.body);
      return Response.json(snapshot);
    };
    const client = createPaneTagClient(fetcher);
    await client.refresh();
    await client.mutate({ kind: "edit", id: "t1", name: "Ready", color: "#123456" }, "draft-version");
    expect(posted).toContain('"version":"draft-version"');
  });

  it("retains displayed state on an outage, disables writes and recovers by refresh", async () => {
    let fail = false;
    const fetcher: typeof fetch = async () => { if (fail) throw new Error("offline"); return Response.json(snapshot); };
    const client = createPaneTagClient(fetcher);
    await client.refresh(); fail = true;
    await client.refresh();
    expect(client.getSnapshot()).toMatchObject({ snapshot, available: false });
    expect(await client.mutate({ kind: "detach", pane, id: "t1" })).toBe(false);
    fail = false; await client.refresh();
    expect(client.getSnapshot().available).toBe(true);
  });

  it("uses the native pin place identity, independent of agent kind and conversation", () => {
    const agent: AgentView = { paneId: "pane-1", host: "lead", session: "work", workspaceId: "w1", workspaceLabel: "Project", workspaceNumber: 1, tabId: "t1", agent: "claude", status: "working", cwd: "/repo", focused: false };
    expect(tagPanePlace(agent)).toEqual(pane);
    expect(tagPanePlace({ ...agent, agent: "codex", sessionName: "New conversation" })).toEqual(pane);
    expect(tagsForPane(snapshot.document, tagPanePlace({ ...agent, host: "other" }))).toEqual([]);
    expect(tagsForPane(snapshot.document, tagPanePlace({ ...agent, workspaceLabel: "Different" }))).toEqual([]);
  });
});
