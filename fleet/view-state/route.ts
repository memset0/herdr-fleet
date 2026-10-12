import { parseJson } from "../../web/src/lib/json.ts";
import { resolveTerminalReference, type TerminalRef } from "../bindings/identity.ts";
import type { LocatedTerminal } from "../bindings/inventory.ts";
import { parseViewCommand } from "./document.ts";
import type { ViewStateStore } from "./store.ts";

/** Served only after the Gateway session and exact mutation-origin gates. */
export async function viewStateResponse(
  request: Request, store: ViewStateStore, inventory: () => Promise<readonly LocatedTerminal[]>,
): Promise<Response> {
  try {
    if (request.method === "GET") return Response.json(await store.read());
    if (request.method !== "POST") return Response.json({ error: "method" }, { status: 405, headers: { allow: "GET, POST" } });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "invalid" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > 4096) {
          await reader.cancel();
          return Response.json({ error: "limit" }, { status: 413 });
        }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    const command = parseViewCommand(parseJson(Buffer.concat(chunks).toString("utf8")));
    if (!command) return Response.json({ error: "invalid" }, { status: 400 });
    const validate = async (terminal: TerminalRef) => {
      const rows = await inventory();
      return resolveTerminalReference(terminal, rows.filter((row) => row.fresh), true).status === "resolved";
    };
    const result = await store.mutate(command, validate);
    if (result.ok) return Response.json(result.snapshot);
    const body = "snapshot" in result ? { error: result.error, ...result.snapshot } : { error: result.error };
    return Response.json(body, {
      status: result.error === "conflict" ? 409 : 422,
    });
  } catch { return Response.json({ error: "unavailable" }, { status: 503 }); }
}
