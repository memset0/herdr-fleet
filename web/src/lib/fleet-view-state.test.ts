import { expect, it, vi } from "vitest";
import { createViewClient } from "./fleet-view-state";
import type { ViewSnapshot } from "../../../fleet/view-state/document.ts";
import type { TerminalRef } from "../../../fleet/bindings/identity.ts";

const a: TerminalRef = { version: 1, host: "member-a", session: "default", id: "herdr:term_a" };
const b: TerminalRef = { ...a, id: "herdr:term_b" };
const snapshot = (selection: TerminalRef | null = a, revision = 1): ViewSnapshot => ({ generation: "example", revision, selection, slots: Array(12).fill(null), rows: 3, columns: 4 });

it("joining and following read without echo, local choices publish, leaving stays independent", async () => {
  let current = snapshot();
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.method === "POST") current = snapshot(b, current.revision + 1);
    return Response.json(current);
  });
  const client = createViewClient(fetcher);
  client.observeRoute("/pane/a", a);
  await client.join();
  expect(fetcher.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  client.markFollow("/pane/b");
  client.observeRoute("/pane/b", b);
  expect(fetcher).toHaveBeenCalledTimes(1);
  client.observeRoute("/pane/c", b);
  await vi.waitFor(() => expect(client.getSnapshot().busy).toBe(false));
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  client.leave();
  client.observeRoute("/pane/a", a);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("an older refresh cannot overwrite a completed local selection", async () => {
  let finishRead: ((response: Response) => void) | undefined;
  let reads = 0;
  const client = createViewClient(async (_url, init) => {
    if (init?.method === "POST") return Response.json(snapshot(b, 2));
    reads += 1;
    if (reads === 1) return Response.json(snapshot());
    return new Promise<Response>((resolve) => { finishRead = resolve; });
  });
  await client.join();
  const pending = client.refresh();
  await client.mutate({ type: "select", terminal: b });
  finishRead?.(Response.json(snapshot(a, 1)));
  await pending;
  expect(client.getSnapshot().snapshot?.selection).toEqual(b);
});

it("offline navigation is not replayed when the connection returns", async () => {
  let offline = false;
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (offline) throw new Error("example offline");
    return Response.json(snapshot());
  });
  const client = createViewClient(fetcher);
  client.observeRoute("/pane/a", a);
  await client.join();
  offline = true; await client.refresh();
  client.observeRoute("/pane/b", b);
  offline = false; await client.refresh();
  client.observeRoute("/pane/b", b);
  expect(fetcher.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  expect(client.getSnapshot().snapshot?.selection).toEqual(a);
});

it("leaving during an in-flight join cannot rejoin the page", async () => {
  let finish: ((response: Response) => void) | undefined;
  const client = createViewClient(async () => new Promise<Response>((resolve) => { finish = resolve; }));
  const joining = client.join();
  await vi.waitFor(() => expect(finish).toBeDefined());
  client.leave(); finish?.(Response.json(snapshot())); await joining;
  expect(client.getSnapshot().joined).toBe(false);
});

it("an explicit repeat navigation to the same Pane can select an empty stream", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(snapshot(null, 0)));
  const client = createViewClient(fetcher);
  client.observeRoute("/pane/a", a, "initial");
  await client.join();
  client.observeRoute("/pane/a", a, "new-visit");
  await vi.waitFor(() => expect(client.getSnapshot().busy).toBe(false));
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
