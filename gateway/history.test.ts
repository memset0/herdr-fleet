import { describe, expect, test } from "bun:test";

import type { FleetAgentCard } from "./fleet.ts";
import {
  CollieFleetHistoryReader,
  latestAssistantReplyFromHistory,
  MAX_FLEET_AGENT_REPLY_CHARS,
  MAX_FLEET_HISTORY_BYTES,
  normalizeFleetAgentReply,
} from "./history.ts";
import { gatewayConfig } from "./test-helpers.ts";
import { TransportRegistry } from "./transports.ts";

function card(extra: Partial<FleetAgentCard> = {}): FleetAgentCard {
  return {
    paneId: "w0:p7",
    workspaceId: "w0",
    workspaceLabel: "Example project",
    workspaceNumber: 0,
    tabId: "w0:t0",
    agent: "codex",
    status: "done",
    cwd: "/srv/example-project",
    focused: false,
    herdrSession: "default",
    primarySession: true,
    reachable: true,
    observedAt: 100,
    ...extra,
  };
}

describe("Fleet History extraction", () => {
  test("selects only text parts from the newest qualifying Assistant entry", () => {
    expect(
      latestAssistantReplyFromHistory({
        available: true,
        arbitrary: "ignored",
        entries: [
          { role: "user", parts: [{ kind: "text", text: "please deploy" }] },
          { role: "assistant", parts: [{ kind: "text", text: "older answer" }] },
          { role: "summary", parts: [{ kind: "text", text: "compacted context" }] },
          {
            role: "assistant",
            parts: [
              { kind: "thinking", text: "private reasoning" },
              { kind: "text", text: "Deployment finished." },
              { kind: "tool", name: "shell", summary: "deploy", result: { text: "secret output" } },
              { kind: "text", text: "All checks passed." },
            ],
          },
          { role: "note", parts: [{ kind: "text", text: "background task" }] },
        ],
      }),
    ).toBe("Deployment finished.\n\nAll checks passed.");
  });

  test("walks past newer reasoning/tool-only Assistant entries", () => {
    expect(
      latestAssistantReplyFromHistory({
        available: true,
        entries: [
          { role: "assistant", parts: [{ kind: "text", text: "I need your approval." }] },
          { role: "assistant", parts: [{ kind: "thinking", text: "waiting" }] },
          { role: "assistant", parts: [{ kind: "tool", name: "shell", summary: "sudo apt" }] },
        ],
      }),
    ).toBe("I need your approval.");
  });

  test("normalizes ANSI and unsafe controls while retaining multiline prose", () => {
    expect(normalizeFleetAgentReply(" \u001b[31mDone\u001b[0m\r\nline\u0000two\t✓ ")).toBe(
      "Done\nline two\t✓",
    );
    expect(normalizeFleetAgentReply("\u0000\u0007  ")).toBeNull();
  });

  test("caps by Unicode code point and leaves an explicit marker", () => {
    const reply = normalizeFleetAgentReply("🐕".repeat(MAX_FLEET_AGENT_REPLY_CHARS + 5));
    expect(Array.from(reply ?? "")).toHaveLength(MAX_FLEET_AGENT_REPLY_CHARS);
    expect(reply?.endsWith("…")).toBeTrue();
  });

  test("accepts unavailable History and rejects incompatible or oversized entry shapes", () => {
    expect(latestAssistantReplyFromHistory({ available: false, reason: "disabled" })).toBeNull();
    expect(() => latestAssistantReplyFromHistory({ entries: [] })).toThrow("shape is incompatible");
    expect(() =>
      latestAssistantReplyFromHistory({ available: true, entries: Array.from({ length: 201 }, () => ({})) }),
    ).toThrow("entries shape is incompatible");
  });
});

describe("CollieFleetHistoryReader", () => {
  test("uses the configured upstream and Host without marking a primary Pane seen", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: new URL(String(input)), init });
      return Response.json({
        available: true,
        entries: [{ role: "assistant", parts: [{ kind: "text", text: "Finished." }] }],
      });
    }) as typeof fetch;
    const reader = new CollieFleetHistoryReader(config, transports, fetcher);

    await expect(reader.latestAssistantReply("local", card())).resolves.toBe("Finished.");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.toString()).toBe(
      "http://127.0.0.1:18788/api/pane/w0%3Ap7/history?limit=200",
    );
    expect(new Headers(calls[0]?.init?.headers).get("host")).toBe("local.example.com");
    expect(new Headers(calls[0]?.init?.headers).has("x-collie-seen")).toBeFalse();
  });

  test("routes a named Herdr session and treats available:false as link-only fallback", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let requested = "";
    const fetcher = (async (input: string | URL | Request) => {
      requested = String(input);
      return Response.json({ available: false, reason: "no-log" });
    }) as typeof fetch;
    const reader = new CollieFleetHistoryReader(config, transports, fetcher);

    await expect(
      reader.latestAssistantReply("local", card({ primarySession: false, herdrSession: "batch demo" })),
    ).resolves.toBeNull();
    expect(requested).toBe(
      "http://127.0.0.1:18788/api/pane/w0%3Ap7/history?limit=200&session=batch+demo",
    );
  });

  test("rejects HTTP, malformed JSON, and declared oversized responses", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    const responses = [
      new Response("missing", { status: 404 }),
      new Response("not-json", { status: 200 }),
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(MAX_FLEET_HISTORY_BYTES + 1) },
      }),
    ];
    const fetcher = (async () => responses.shift()!) as unknown as typeof fetch;
    const reader = new CollieFleetHistoryReader(config, transports, fetcher);

    await expect(reader.latestAssistantReply("local", card())).rejects.toThrow("HTTP 404");
    await expect(reader.latestAssistantReply("local", card())).rejects.toThrow("invalid JSON");
    await expect(reader.latestAssistantReply("local", card())).rejects.toThrow("too large");
  });
});
