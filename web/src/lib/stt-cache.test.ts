import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ACCEPTED_WHISTLE_SHAS, NEEDLE_VERSION_DIR } from "@/stt/pins";
import {
  isSttCacheName,
  modelShaOfPath,
  stripMount,
  sttCacheName,
  sttCopyToStore,
  sttEnginePath,
  sttModelPath,
  sttStorable,
  sttSweepKeeps,
} from "./stt-cache";

const ACCEPTED = ACCEPTED_WHISTLE_SHAS[0] ?? "";
const OTHER = "a".repeat(64);

function response(init: { status?: number; type?: string; redirected?: boolean }): Response {
  const res = new Response("x", {
    status: init.status ?? 200,
    headers: init.type === undefined ? {} : { "content-type": init.type },
  });
  Object.defineProperty(res, "redirected", { value: init.redirected === true });
  return res;
}

describe("the speech cache's names", () => {
  it("is named per mount, the way the font cache is", () => {
    expect(sttCacheName("/")).toBe("collie-stt");
    expect(sttCacheName("/collie/")).toBe("collie-stt:/collie/");
  });

  it("recognises its own caches, whatever the mount, and nobody else's", () => {
    expect(isSttCacheName("collie-stt")).toBe(true);
    expect(isSttCacheName("collie-stt:/collie/")).toBe(true);
    expect(isSttCacheName("collie-fonts")).toBe(false);
    expect(isSttCacheName("workbox-precache-v2-https://x/")).toBe(false);
  });

  it("puts the model under its hash and the engine under the pinned version", () => {
    expect(sttModelPath(ACCEPTED)).toBe(`/api/stt/model/${ACCEPTED}`);
    expect(sttEnginePath("needle.wasm")).toBe(`/stt/${NEEDLE_VERSION_DIR}/needle.wasm`);
    expect(modelShaOfPath(sttModelPath(ACCEPTED))).toBe(ACCEPTED);
    expect(modelShaOfPath("/api/stt/model/not-a-hash")).toBeNull();
    expect(modelShaOfPath("/stt/worker.js")).toBeNull();
  });

  it("takes the mount off a pathname", () => {
    expect(stripMount("/stt/a.js", "/")).toBe("/stt/a.js");
    expect(stripMount("/collie/stt/a.js", "/collie/")).toBe("/stt/a.js");
    expect(stripMount("/other/stt/a.js", "/collie/")).toBe("/other/stt/a.js");
  });
});

describe("what the activate sweep keeps", () => {
  it("keeps a model this build accepts and drops one it does not", () => {
    expect(sttSweepKeeps(sttModelPath(ACCEPTED))).toBe(true);
    expect(sttSweepKeeps(sttModelPath(OTHER))).toBe(false);
  });

  it("keeps this build's engine files and drops another version's", () => {
    expect(sttSweepKeeps(sttEnginePath("needle.js"))).toBe(true);
    expect(sttSweepKeeps(sttEnginePath("needle.wasm"))).toBe(true);
    expect(sttSweepKeeps("/stt/needle-2-oldoldol/needle.wasm")).toBe(false);
  });

  it("drops the old worker script, whose name carries a build hash", () => {
    expect(sttSweepKeeps("/stt/worker-abc123.js")).toBe(false);
  });

  it("takes the accepted list as an argument, so a new pin set changes the answer", () => {
    expect(sttSweepKeeps(sttModelPath(OTHER), [OTHER])).toBe(true);
    expect(sttSweepKeeps(sttModelPath(ACCEPTED), [OTHER])).toBe(false);
  });
});

describe("what may be stored", () => {
  it("takes an unredirected 200 of the type the path promises", () => {
    expect(sttStorable(response({ type: "text/javascript; charset=utf-8" }), "/stt/worker-1.js")).toBe(true);
    expect(sttStorable(response({ type: "application/wasm" }), sttEnginePath("needle.wasm"))).toBe(true);
    expect(sttStorable(response({ type: "application/octet-stream" }), sttModelPath(ACCEPTED))).toBe(true);
  });

  it("refuses a sign-in page that came back as 200 HTML after a redirect", () => {
    expect(sttStorable(response({ type: "text/html", redirected: true }), "/stt/worker-1.js")).toBe(false);
    expect(sttStorable(response({ type: "text/javascript", redirected: true }), "/stt/worker-1.js")).toBe(false);
  });

  it("refuses a wrong type, a partial answer and an error", () => {
    expect(sttStorable(response({ type: "text/html" }), "/stt/worker-1.js")).toBe(false);
    expect(sttStorable(response({ type: "text/javascript" }), sttEnginePath("needle.wasm"))).toBe(false);
    expect(sttStorable(response({ status: 206, type: "text/javascript" }), "/stt/worker-1.js")).toBe(false);
    expect(sttStorable(response({ status: 404, type: "text/javascript" }), "/stt/worker-1.js")).toBe(false);
    expect(sttStorable(response({}), "/stt/worker-1.js")).toBe(false);
  });

  it("stores nothing else under stt/", () => {
    expect(sttStorable(response({ type: "text/plain" }), "/stt/needle-3-93e88ede/LICENSE")).toBe(false);
  });
});

describe("what the worker stores for an engine file", () => {
  // The vendored engine, the bytes the pins were measured on.
  const vendored = (file: string): Uint8Array<ArrayBuffer> =>
    new Uint8Array(readFileSync(resolve(__dirname, "../../public/stt", NEEDLE_VERSION_DIR, file)));
  const served = (bytes: Uint8Array<ArrayBuffer>, type: string): Response =>
    new Response(bytes, { status: 200, headers: { "content-type": type, "content-security-policy": "default-src 'none'" } });

  it("stores the pinned bytes, headers and all", async () => {
    for (const [file, type] of [["needle.js", "text/javascript"], ["needle.wasm", "application/wasm"]] as const) {
      const bytes = vendored(file);
      const copy = await sttCopyToStore(served(bytes, type), sttEnginePath(file));
      expect(copy).not.toBeNull();
      // One compare of the buffers, not toEqual: an element-by-element walk of the 929 KB wasm took
      // over the 5 s limit on a CI runner.
      expect(Buffer.from(await copy!.arrayBuffer()).equals(bytes)).toBe(true);
      expect(copy!.status).toBe(200);
      expect(copy!.headers.get("content-type")).toBe(type);
      expect(copy!.headers.get("content-security-policy")).toBe("default-src 'none'");
    }
  });

  it("stores nothing when the bytes are not the pinned ones", async () => {
    const tampered = vendored("needle.js");
    tampered[0] = tampered[0]! ^ 1;
    expect(await sttCopyToStore(served(tampered, "text/javascript"), sttEnginePath("needle.js"))).toBeNull();
    // The right bytes under the other file's name are not that file.
    expect(await sttCopyToStore(served(vendored("needle.js"), "application/wasm"), sttEnginePath("needle.wasm"))).toBeNull();
  });

  it("stores no other file from the engine's folder", async () => {
    const other = `/stt/${NEEDLE_VERSION_DIR}/extra.js`;
    expect(await sttCopyToStore(served(vendored("needle.js"), "text/javascript"), other)).toBeNull();
  });

  it("stores the worker script, outside the engine's folder, as it came", async () => {
    const worker = served(new TextEncoder().encode("self.onmessage = () => {};"), "text/javascript");
    expect(await sttCopyToStore(worker, "/stt/worker-abc123.js")).toBe(worker);
  });
});
