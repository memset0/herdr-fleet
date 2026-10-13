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

it("presence counts do not require joining or publish a selection and use distinct page identities", async () => {
  const pulses: { id: string; sequence: number; active: boolean }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => { pulses.push(JSON.parse(String(init?.body))); return Response.json({ active: 2 }); });
  const panel = createViewClient(fetcher), viewer = createViewClient(fetcher);
  await panel.presence(false); await panel.presence(false, true); await viewer.presence(true);
  expect(panel.getSnapshot().joined).toBe(false);
  expect(panel.getSnapshot().activeViewers).toBe(2);
  expect(pulses[0]!.id).toBe(pulses[1]!.id);
  expect(pulses[0]!.id).not.toBe(pulses[2]!.id);
  expect(pulses.map((pulse) => pulse.sequence)).toEqual([1, 2, 1]);
  expect(fetcher.mock.calls.every(([url]) => String(url).endsWith("/view-presence"))).toBe(true);
});

it("pushed snapshots beat delayed HTTP replies and layout sequences do not roll back", async () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).endsWith("view-stream")) return new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; } }), { headers: { "content-type": "text/event-stream" } });
    if (init?.method === "POST") return new Promise<Response>((resolve) => { finish = resolve; });
    return Response.json({ ...snapshot(a, 1), sequence: 1 });
  });
  const client = createViewClient(fetcher);
  await client.refresh();
  const stop = client.connect();
  const push = (selection: TerminalRef, revision: number, sequence: number) => controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ ...snapshot(selection, revision), sequence })}\n\n`));
  await vi.waitFor(() => expect(controller).toBeDefined());
  push(a, 1, 1); await vi.waitFor(() => expect(client.getSnapshot().available).toBe(true));
  const write = client.mutate({ type: "select", terminal: a });
  await vi.waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  push(b, 3, 4); await vi.waitFor(() => expect(client.getSnapshot().snapshot?.selection).toEqual(b));
  finish(Response.json({ ...snapshot(a, 2), sequence: 2 })); await write;
  expect(client.getSnapshot().snapshot?.selection).toEqual(b);
  push(a, 3, 3); await new Promise((resolve) => setTimeout(resolve, 10));
  expect(client.getSnapshot().snapshot?.selection).toEqual(b);
  stop(); controller?.close();
});

it("a failed command reconnects so a healthy stream does not remain permanently unavailable", async () => {
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).endsWith("view-stream")) return new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(snapshot())}\n\n`));
      init?.signal?.addEventListener("abort", () => { try { controller.close(); } catch { /* Already closed. */ } }, { once: true });
    } }), { headers: { "content-type": "text/event-stream" } });
    return new Response("{}", { status: 503 });
  });
  const client = createViewClient(fetcher), stop = client.connect();
  try {
    await vi.waitFor(() => expect(client.getSnapshot().available).toBe(true));
    expect(await client.mutate({ type: "select", terminal: a })).toBe(false);
    await vi.waitFor(() => expect(client.getSnapshot().available).toBe(true), { timeout: 2500 });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("view-stream"))).toHaveLength(2);
  } finally { stop(); }
});
