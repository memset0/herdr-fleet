import { expect, test } from "bun:test";
import { createViewStateStore } from "./store.ts";
import { createViewStream } from "./stream.ts";

const terminal = { version: 1 as const, host: "member-a", session: "default", id: "herdr:term_a" };
test("stream sends initial state then accepted changes immediately and closes on revocation", async () => {
  const store = createViewStateStore("example.json", { read: async () => null, write: async () => {} });
  let authorized = true, closed = 0;
  const stream = createViewStream(new Request("https://fleet.example.test/fleet/api/view-stream"), store, async () => authorized, () => closed += 1);
  const reader = stream.response.body!.getReader(), decoder = new TextDecoder();
  expect(stream.response.headers.get("content-type")).toContain("text/event-stream");
  expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
  expect(decoder.decode((await reader.read()).value)).toContain('"selection":null');
  const received = reader.read();
  await store.mutate({ type: "select", terminal }, async () => true);
  expect(decoder.decode((await received).value)).toContain('"revision":1,"sequence":1');
  authorized = false;
  const ended = reader.read();
  await store.mutate({ type: "select", terminal }, async () => true);
  expect((await ended).done).toBe(true);
  expect(closed).toBe(1);
});

test("slow consumers disconnect with bounded buffering and abort unsubscribes", async () => {
  const store = createViewStateStore("example.json", { read: async () => null, write: async () => {} });
  let closed = 0;
  const abort = new AbortController();
  const stream = createViewStream(new Request("https://fleet.example.test/fleet/api/view-stream", { signal: abort.signal }), store, async () => true, () => closed += 1);
  await Bun.sleep(10);
  await store.mutate({ type: "select", terminal }, async () => true);
  await Bun.sleep(10);
  expect(closed).toBe(1);
  abort.abort(); expect(closed).toBe(1);
  await stream.response.body!.cancel();
});
