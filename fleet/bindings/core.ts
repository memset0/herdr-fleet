import { createHash } from "node:crypto";

/** Permanent runtime identity scopes local addresses independently of endpoint aliases. */
export function coreBindingSession(coreId: string): string {
  return "core_" + createHash("sha256").update(coreId).digest("base64url");
}

export function coreBindingId(coreId: string, terminal: string): string {
  return "terminal_" + createHash("sha256").update(JSON.stringify(["herdr-core", coreId, terminal])).digest("base64url");
}
