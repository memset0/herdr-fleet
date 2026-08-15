import type { GatewayConfig, NodeConfig } from "./config.ts";
import type { FleetAgentCard } from "./fleet.ts";
import type { TransportRegistry } from "./transports.ts";

const HISTORY_PAGE_LIMIT = 200;
const HISTORY_TIMEOUT_MS = 5_000;
export const MAX_FLEET_HISTORY_BYTES = 2 * 1_024 * 1_024;
export const MAX_FLEET_AGENT_REPLY_CHARS = 1_000;

const ANSI_ESCAPE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[@-Z\\-_]/g;
// Preserve ordinary multiline prose (LF + tab), but never hand execFile a NUL or Discord invisible
// terminal controls. CR is normalized separately so CRLF does not gain a stray space.
const UNSAFE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export interface FleetHistoryReader {
  latestAssistantReply(nodeId: string, agent: FleetAgentCard): Promise<string | null>;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Normalize and cap one already-selected Assistant response by Unicode code point. */
export function normalizeFleetAgentReply(value: string): string | null {
  const normalized = value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(ANSI_ESCAPE, "")
    .replace(UNSAFE_CONTROL, " ")
    .trim();
  if (normalized === "") return null;

  const characters = Array.from(normalized);
  if (characters.length <= MAX_FLEET_AGENT_REPLY_CHARS) return normalized;
  return `${characters.slice(0, MAX_FLEET_AGENT_REPLY_CHARS - 1).join("")}…`;
}

/**
 * Extract the newest speech response from Collie's oldest-first History page.
 *
 * Codex and other adapters also emit Assistant entries for reasoning and tool traffic, so the last
 * array item is not necessarily a response. Only text parts from one qualifying Assistant entry
 * cross this boundary; every other role, part, and additive response field is ignored.
 */
export function latestAssistantReplyFromHistory(value: unknown): string | null {
  const response = object(value);
  if (response === null || typeof response.available !== "boolean") {
    throw new Error("History response shape is incompatible");
  }
  if (!response.available) return null;
  if (!Array.isArray(response.entries) || response.entries.length > HISTORY_PAGE_LIMIT) {
    throw new Error("History entries shape is incompatible");
  }

  for (let index = response.entries.length - 1; index >= 0; index -= 1) {
    const entry = object(response.entries[index]);
    if (entry?.role !== "assistant" || !Array.isArray(entry.parts) || entry.parts.length > 256) continue;
    const text = entry.parts
      .map(object)
      .filter((part): part is Record<string, unknown> => part?.kind === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .filter((part) => part.trim() !== "")
      .join("\n\n");
    const normalized = normalizeFleetAgentReply(text);
    if (normalized !== null) return normalized;
  }
  return null;
}

async function boundedResponseText(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FLEET_HISTORY_BYTES) {
    throw new Error("History response is too large");
  }
  if (response.body === null) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FLEET_HISTORY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("History response is too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export class CollieFleetHistoryReader implements FleetHistoryReader {
  private readonly nodes: Map<string, NodeConfig>;

  constructor(
    config: GatewayConfig,
    private readonly transports: TransportRegistry,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.nodes = new Map(config.nodes.filter((node) => node.enabled).map((node) => [node.id, node]));
  }

  async latestAssistantReply(nodeId: string, agent: FleetAgentCard): Promise<string | null> {
    const node = this.nodes.get(nodeId);
    if (node === undefined) throw new Error("History node is not configured");

    const url = new URL(
      `/api/pane/${encodeURIComponent(agent.paneId)}/history`,
      `${this.transports.upstream(node)}/`,
    );
    url.searchParams.set("limit", String(HISTORY_PAGE_LIMIT));
    if (!agent.primarySession) url.searchParams.set("session", agent.herdrSession);

    const response = await this.fetcher(url, {
      // Deliberately omit x-collie-seen: this is notification enrichment, not a human History view.
      headers: { Accept: "application/json", Host: node.publicHost },
      signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`History returned HTTP ${response.status}`);

    const text = await boundedResponseText(response);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("History returned invalid JSON");
    }
    return latestAssistantReplyFromHistory(parsed);
  }
}
