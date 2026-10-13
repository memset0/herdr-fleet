import { asJsonBoolean, asJsonNumber, asJsonObject, asJsonString, parseJson } from "../../web/src/lib/json.ts";

export { VIEW_PRESENCE_PATH } from "./document.ts";
export const PRESENCE_TTL = 15_000;
interface Lease { sequence: number; until: number; active: boolean }
export function createViewPresence(now: () => number = Date.now) {
  const leases = new Map<string, Lease>();
  return {
    removeSession(session: string) { for (const key of leases.keys()) if (key.startsWith(session + "\0")) leases.delete(key); },
    pulse(session: string, id: string, sequence: number, active: boolean) {
      const time = now();
      for (const [key, lease] of leases) if (lease.until <= time) leases.delete(key);
      const key = session + "\0" + id, previous = leases.get(key);
      if (!previous && leases.size >= 2048) return null;
      if (!previous || sequence > previous.sequence) leases.set(key, { sequence, until: time + PRESENCE_TTL, active });
      let count = 0;
      for (const [other, lease] of leases) if (other !== key && lease.active) count += 1;
      return count;
    },
  };
}

const json = (body: { active?: number; error?: string }, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Caller enforces Gateway session authorization and exact mutation origin. */
export async function viewPresenceResponse(request: Request, session: string, presence: ReturnType<typeof createViewPresence>) {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "invalid" }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 512) { await reader.cancel(); return json({ error: "limit" }, 413); }
      chunks.push(next.value);
    }
    const body = asJsonObject(parseJson(Buffer.concat(chunks).toString("utf8")));
    const id = asJsonString(body?.id), active = asJsonBoolean(body?.active), sequence = asJsonNumber(body?.sequence);
    if (!id || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) || active === undefined || sequence === undefined || !Number.isSafeInteger(sequence) || sequence < 0) return json({ error: "invalid" }, 400);
    const count = presence.pulse(session, id, sequence, active);
    return count === null ? json({ error: "limit" }, 429) : json({ active: count });
  } catch { return json({ error: "invalid" }, 400); }
  finally { reader.releaseLock(); }
}
