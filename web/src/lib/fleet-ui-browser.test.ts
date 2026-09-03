import { afterEach, describe, expect, it, vi } from "vitest";

import { browserFleetRuntime } from "../../../gateway/fleet-ui/client/context.ts";
import { startFleetClient } from "../../../gateway/fleet-ui/client/index.ts";
import { fleetPage } from "../../../gateway/fleet-ui/page.ts";

function bodyOf(html: string): string {
  const match = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!match) throw new Error("Fleet page has no body");
  return match[1];
}

function keydown(
  code: string,
  modifiers: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    ...modifiers,
  });
  document.dispatchEvent(event);
  return event;
}

describe("Fleet browser runtime", () => {
  afterEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("fails visibly when the server document is incomplete", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(() => startFleetClient()).toThrow(
      "Fleet page is missing required element: .fleet-shell",
    );
  });

  it("boots the aggregate, controls Settings, and runs the shared keyboard palette", async () => {
    const media = new Map<string, MediaQueryList>();
    vi.stubGlobal("matchMedia", (query: string) => {
      const value = {
        matches: query.includes("min-width: 1200px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      } as unknown as MediaQueryList;
      media.set(query, value);
      return value;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              generatedAt: 1_000,
              refresh: { nextAt: 61_000 },
              nodes: [
                {
                  id: "alpha",
                  name: "Alpha",
                  publicHost: "alpha.example.com",
                  health: "online",
                  message: null,
                  agentEntries: [
                    {
                      paneId: "w0:p1",
                      workspaceId: "w0",
                      workspaceLabel: "Example",
                      workspaceNumber: 1,
                      tabId: "w0:t1",
                      tabLabel: "Main",
                      agent: "codex",
                      status: "working",
                      cwd: "/srv/example",
                      focused: true,
                      herdrSession: "default",
                      primarySession: true,
                      reachable: true,
                      observedAt: 1_000,
                    },
                  ],
                  treeSessions: [
                    {
                      herdrSession: "default",
                      primarySession: true,
                      reachable: true,
                      observedAt: 1_000,
                      spaces: [
                        {
                          workspaceId: "w0",
                          number: 1,
                          label: "Example",
                          focused: true,
                          tabs: [
                            {
                              tabId: "w0:t1",
                              number: 1,
                              label: "Main",
                              focused: true,
                              panes: [
                                {
                                  paneId: "w0:p1",
                                  label: null,
                                  agent: "codex",
                                  kind: "agent",
                                  status: "working",
                                  focused: true,
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    document.body.innerHTML = bodyOf(fleetPage(1, "development"));
    const client = startFleetClient();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll(".node-frame")).toHaveLength(1);
    expect(document.querySelector(".instance-name")?.textContent).toContain(
      "Alpha",
    );
    expect(document.querySelector(".agent-project")?.textContent).toBe(
      "Example",
    );
    expect(
      document.querySelector(".direct-pane-tree-row")?.textContent,
    ).toContain("Main");

    const settingsToggle = document.querySelector<HTMLButtonElement>(
      "#fleet-settings-toggle",
    )!;
    const settings = document.querySelector<HTMLElement>("#fleet-settings")!;
    const cacheSize =
      document.querySelector<HTMLSelectElement>("#iframe-cache-size")!;
    settingsToggle.click();
    expect(settings.hidden).toBe(false);
    cacheSize.value = "3";
    cacheSize.dispatchEvent(new Event("change", { bubbles: true }));
    expect(localStorage.getItem("herdr-web-remote:fleet-iframe-cache:v1")).toBe(
      '{"version":1,"size":3}',
    );
    document.querySelector<HTMLButtonElement>("#iframe-cache-reset")!.click();
    expect(
      localStorage.getItem("herdr-web-remote:fleet-iframe-cache:v1"),
    ).toBeNull();
    expect(cacheSize.value).toBe("1");

    for (const second of [
      { code: "KeyP", init: { key: "P", shiftKey: true } },
      { code: "Tab", init: { key: "Tab" } },
      { code: "Tab", init: { key: "Tab", shiftKey: true } },
    ]) {
      expect(
        keydown("KeyB", { key: "b", ctrlKey: true }).defaultPrevented,
      ).toBe(true);
      expect(keydown(second.code, second.init).defaultPrevented).toBe(true);
    }

    expect(keydown("KeyB", { key: "b", ctrlKey: true }).defaultPrevented).toBe(
      true,
    );
    expect(
      keydown("Slash", { key: "?", shiftKey: true }).defaultPrevented,
    ).toBe(true);
    const dialog = document.querySelector<HTMLElement>("#command-dialog");
    const input = document.querySelector<HTMLInputElement>(
      "#command-dialog-input",
    );
    const results = document.querySelector<HTMLElement>(
      "#command-dialog-results",
    );
    const hint = document.querySelector<HTMLElement>("#command-dialog-hint");
    expect(dialog?.hidden).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(48);

    input!.value = "/pane width";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(results?.textContent).toContain("Fit Current Pane Width");

    input!.value = "tabs";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(results?.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(hint?.textContent).toContain("reserved");

    expect(keydown("Escape", { key: "Escape" }).defaultPrevented).toBe(true);
    expect(dialog?.hidden).toBe(true);

    expect(
      keydown("KeyP", { key: "P", ctrlKey: true, shiftKey: true })
        .defaultPrevented,
    ).toBe(true);
    expect(dialog?.hidden).toBe(false);

    if (client.state.refreshTimer !== null)
      client.runtime.clearTimeout(client.state.refreshTimer);
    if (client.state.quietTimer !== null)
      client.runtime.clearTimeout(client.state.quietTimer);
  });

  it("keeps browser-local preferences usable when storage is unavailable", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("min-width: 1200px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              generatedAt: 1_000,
              refresh: { nextAt: 61_000 },
              nodes: [],
            }),
          ),
      ),
    );
    document.body.innerHTML = bodyOf(fleetPage(4, "development"));

    const unavailableStorage = {
      length: 0,
      clear: () => {
        throw new Error("unavailable");
      },
      getItem: () => {
        throw new Error("unavailable");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    } satisfies Storage;
    const client = startFleetClient({
      ...browserFleetRuntime(),
      storage: unavailableStorage,
    });
    await Promise.resolve();

    expect(client.state.iframeCacheSize).toBe(4);
    expect(() => client.services.setIframeCacheSize(2)).not.toThrow();
    expect(client.state.iframeCacheSize).toBe(2);
    if (client.state.refreshTimer !== null)
      client.runtime.clearTimeout(client.state.refreshTimer);
  });
});
