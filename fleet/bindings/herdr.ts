import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";

/** Adapter-owned endpoint layout; no path is exposed on the wire. */
export function herdrBindingSession(endpoint: string): string {
  const directory = dirname(endpoint);
  return basename(dirname(directory)) === "sessions" ? basename(directory) : "default";
}

/** A stable opaque fingerprint, never the identifier accepted by a terminal command. */
export function herdrBindingId(terminalId: string | undefined): string | undefined {
  if (!terminalId || !/^term_[A-Za-z0-9]{1,128}$/.test(terminalId)) return undefined;
  return "terminal_" + createHash("sha256").update("herdr-terminal:" + terminalId).digest("base64url");
}
