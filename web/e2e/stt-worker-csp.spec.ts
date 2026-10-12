import { expect, test, type Page } from "@playwright/test";

import { installApiStub } from "./fixtures/api";
import { serveWithShellCsp, shellCsp, sttWorkerCsp } from "./fixtures/csp";

// THE CSP3 BEHAVIOUR THE ON-DEVICE SPEECH DESIGN RELIES ON (ADR 0096 Decision 8), measured in a real
// engine because no unit test can see it: Chromium and WebKit both have to agree that
//
//   * a dedicated worker loaded from a URL runs under the policy ITS OWN response carries, so the one
//     response that says `'wasm-unsafe-eval'` may compile wasm while the document may not;
//   * that same worker, under `default-src 'none'`, has no network;
//   * a worker made from a `blob:` URL runs under the DOCUMENT's policy, so it may not compile wasm.
//
// The design fails closed on exactly these (the worker compiles an eight-byte module before it loads
// any engine code), so a browser that disagreed would show "This phone" as unavailable, not run wasm
// under a wider policy. This spec is what tells us a browser agrees.
//
// The `app` target serves `web/dist` with `vite preview`, which sends no CSP at all. So both policies
// are put on the wire here, read out of `bridge/server.ts` and never re-typed: the document gets the
// shell's policy (fixtures/csp.ts), and each probe worker gets whatever header the case is about.
// The probe scripts are fulfilled by `page.route` and are NOT the shipped worker: the shipped worker
// is covered by stt-phone.spec.ts and by the bridge's own tests.
//
// Stubbed route handlers are blocked from being shadowed by the service worker, hence "block".

test.use({ serviceWorkers: "block" });

/** Where the probe scripts live. Under `stt/`, as the shipped worker does, though nothing here depends on the path. */
const PROBE_PATH = "/stt/csp-probe.js";
const GLUE_PATH = "/stt/csp-probe-glue.js";

/** The eight-byte module the shipped worker compiles first: the magic `\0asm` and version 1. */
const PROBE_BYTES = "[0,97,115,109,1,0,0,0]";

/** What a probe worker reports back. Every field is the outcome of one question put to the worker. */
interface ProbeReport {
  /** `ok`, or the name of the error `WebAssembly.compile` rejected with. */
  compile: string;
  /** `ok` when the fetch resolved (any status), or the error name when the browser refused it. */
  fetch: string;
  /** `ok` when `importScripts` ran a same-origin script that defined a global. */
  importScripts: string;
}

/** The worker source: asks the three questions and posts the answers. Used as a URL script and as a blob. */
const PROBE_SOURCE = `
self.addEventListener("message", async () => {
  const report = {};
  try {
    await WebAssembly.compile(new Uint8Array(${PROBE_BYTES}));
    report.compile = "ok";
  } catch (error) {
    report.compile = String(error && error.name);
  }
  try {
    await fetch("/api/health");
    report.fetch = "ok";
  } catch (error) {
    report.fetch = String(error && error.name);
  }
  try {
    importScripts(${JSON.stringify(GLUE_PATH)});
    report.importScripts = self.cspProbeGlue === "ran" ? "ok" : "no global";
  } catch (error) {
    report.importScripts = String(error && error.name);
  }
  self.postMessage(report);
});
`;

/**
 * Open the real app under the shell's real policy and serve the probe worker with `workerHeaders`
 * (or with no policy header at all when that is `null`). Returns the policy the document got.
 */
async function openApp(page: Page, workerHeaders: Record<string, string> | null): Promise<string> {
  await installApiStub(page);
  // The probe's fetch target. Answered here so a refusal can never be mistaken for a 502 from nowhere.
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const policy = await serveWithShellCsp(page);
  const javascript = { "content-type": "text/javascript" };
  await page.route(`**${PROBE_PATH}`, (route) =>
    route.fulfill({ status: 200, body: PROBE_SOURCE, headers: { ...javascript, ...workerHeaders } }),
  );
  await page.route(`**${GLUE_PATH}`, (route) =>
    route.fulfill({ status: 200, body: 'self.cspProbeGlue = "ran";', headers: { ...javascript, ...workerHeaders } }),
  );
  await page.goto("/");
  return policy;
}

/** Start the probe as a URL worker, or as a `blob:` worker, and wait for its report. */
async function runProbe(page: Page, kind: "url" | "blob"): Promise<ProbeReport | { refused: string }> {
  return page.evaluate(
    async ([mode, path, source]) =>
      new Promise<ProbeReport | { refused: string }>((resolve) => {
        const done = (value: ProbeReport | { refused: string }) => resolve(value);
        let worker: Worker;
        try {
          const url = mode === "url" ? path! : URL.createObjectURL(new Blob([source!], { type: "text/javascript" }));
          worker = new Worker(url);
        } catch (error) {
          // A document whose policy bars the worker's source refuses at construction (WebKit) ...
          done({ refused: `throw ${String(error instanceof Error ? error.name : error)}` });
          return;
        }
        // ... or by failing the load, which arrives as an `error` event (Chromium).
        worker.addEventListener("error", () => done({ refused: "error event" }));
        worker.addEventListener("message", (event) => {
          // SAFETY: the probe source above posts exactly the three-field ProbeReport, and nothing else posts here.
          done(event.data as ProbeReport);
          worker.terminate();
        });
        worker.postMessage("go", []);
        setTimeout(() => done({ refused: "no answer in 8 s" }), 8000);
      }),
    [kind, PROBE_PATH, PROBE_SOURCE] as const,
  );
}

/** `WebAssembly.compile` of the eight-byte module on the page itself. */
async function documentCompile(page: Page): Promise<string> {
  return page.evaluate(async () => {
    try {
      await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      return "ok";
    } catch (error) {
      return String(error instanceof Error ? error.name : error);
    }
  });
}

test("the shell's policy never grants wasm, and the document itself cannot compile it", async ({ page }) => {
  const policy = await openApp(page, { "content-security-policy": sttWorkerCsp() });
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain("wasm-unsafe-eval");
  expect(policy).not.toContain("unsafe-eval");
  // The document has no script that can compile wasm, whatever its worker may do. This is the ASSERTION
  // that the design never needed to widen the page: if a browser let this through, the worker's own
  // grant would prove nothing.
  expect(await documentCompile(page)).toBe("CompileError");
});

test("a worker served with the speech policy compiles wasm and has no network", async ({ page }) => {
  const workerPolicy = sttWorkerCsp();
  // The two halves of the grant, spelled out: wasm yes, everything else no.
  expect(workerPolicy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(workerPolicy).toContain("default-src 'none'");
  await openApp(page, { "content-security-policy": workerPolicy });

  const report = await runProbe(page, "url");
  expect(report).toEqual({
    // The worker's response grants it, though the document does not (the test above).
    compile: "ok",
    // `default-src 'none'` closes `connect-src`: the glue could not fetch, XHR or open a socket.
    fetch: "TypeError",
    // `script-src 'self'` still lets it load Collie's own glue.
    importScripts: "ok",
  });
});

test("the same script with only script-src 'self' cannot compile wasm", async ({ page }) => {
  await openApp(page, { "content-security-policy": "script-src 'self'" });
  const report = await runProbe(page, "url");
  expect(report).toMatchObject({ compile: "CompileError" });
});

test("control: a worker served with no policy header compiles, so the probe itself is sound", async ({ page }) => {
  // Without this, a probe that always said CompileError would pass the case above for the wrong reason.
  await openApp(page, null);
  const report = await runProbe(page, "url");
  expect(report).toMatchObject({ compile: "ok", fetch: "ok", importScripts: "ok" });
});

test("a blob: worker inherits the document's policy and cannot compile wasm", async ({ page }) => {
  // The document policy with `blob:` added to `worker-src`, so the browser lets the blob worker START.
  // That is the only change: it still has no `wasm-unsafe-eval`, which is the whole point. Under the
  // shipped policy (`worker-src 'self'`) a blob worker would be refused outright, tested next.
  await installApiStub(page);
  const base = shellCsp();
  const relaxed = base.replace("worker-src 'self'", "worker-src 'self' blob:");
  expect(relaxed).not.toBe(base);
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route(`**${GLUE_PATH}`, (route) =>
    route.fulfill({ status: 200, body: 'self.cspProbeGlue = "ran";', headers: { "content-type": "text/javascript" } }),
  );
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": relaxed } });
  });
  await page.goto("/");

  const report = await runProbe(page, "blob");
  // It ran (so the policy let it start) and the compile was refused, though the SAME source from a URL,
  // given the speech policy, compiles it (second test). `importScripts` of a relative URL from a blob
  // worker has no base to resolve against, so only the compile line is asserted.
  expect(report).toMatchObject({ compile: "CompileError" });
});

test("under the shipped policy a blob: worker is refused outright", async ({ page }) => {
  await openApp(page, { "content-security-policy": sttWorkerCsp() });
  const report = await runProbe(page, "blob");
  expect(report).toHaveProperty("refused");
});
