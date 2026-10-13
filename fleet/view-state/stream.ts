import type { ViewSnapshot } from "./document.ts";
import type { ViewStateStore } from "./store.ts";

/** Full snapshots, bounded buffering, and authorization checked before every state frame. */
export function createViewStream(request: Request, store: ViewStateStore, authorized: () => Promise<boolean>, onClose: () => void = () => {}) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false, queued = 0;
  let pending = Promise.resolve();
  const close = () => {
    if (closed) return;
    closed = true; unsubscribe?.(); clearInterval(timer);
    request.signal.removeEventListener("abort", close);
    try { controller?.close(); } catch { /* Already cancelled by the reader. */ }
    onClose();
  };
  const send = (snapshot?: ViewSnapshot) => {
    if (closed) return;
    if (++queued > 2) { close(); return; }
    pending = pending.then(async () => {
      if (closed) return false;
      if (!(await authorized()) || !controller || (controller.desiredSize ?? 0) <= 0) { close(); return false; }
      controller.enqueue(encoder.encode(snapshot ? `data: ${JSON.stringify(snapshot)}\n\n` : ": keepalive\n\n"));
      return true;
    }).catch(() => { close(); return false; }).then(() => { queued -= 1; return undefined; });
  };
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      unsubscribe = store.subscribe((snapshot) => send(snapshot));
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) { close(); return; }
      void store.read().then((snapshot) => send(snapshot), close);
      timer = setInterval(() => send(), 10_000);
    },
    cancel: close,
  });
  return { close, response: new Response(body, { headers: {
    "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no",
  } }) };
}
