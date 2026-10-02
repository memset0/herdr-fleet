import { asJsonObject, asJsonString, parseJson } from "../../web/src/lib/json.ts";
import { parseTagCommand } from "./document.ts";
import type { TagStore } from "./store.ts";

const MAX_REQUEST_BYTES = 16 * 1024;
async function boundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

/** Called only after the Gateway's session and mutation-origin gates. */
export async function tagResponse(request: Request, store: TagStore): Promise<Response> {
  try {
    if (request.method === "GET") return Response.json(await store.read());
    if (request.method !== "POST") return Response.json({ error: "method" }, { status: 405, headers: { allow: "GET, POST" } });
    const text = await boundedBody(request);
    if (text === null) return Response.json({ error: "invalid" }, { status: 413 });
    const body = asJsonObject(parseJson(text));
    const version = asJsonString(body?.version), command = parseTagCommand(body?.command);
    if (version === undefined || version.length > 64 || !command) return Response.json({ error: "invalid" }, { status: 400 });
    const result = await store.mutate(version, command);
    if (result.ok) return Response.json(result.snapshot);
    if (result.error === "conflict") return Response.json({ ...result.snapshot, error: result.error }, { status: 409 });
    return Response.json({ error: result.error }, { status: 422 });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
