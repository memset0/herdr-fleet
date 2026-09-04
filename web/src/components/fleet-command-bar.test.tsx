import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseBinding } from "../../../fleet/ui/commands/bindings.ts";
import { commandById } from "../../../fleet/ui/commands/catalog.ts";
import type { CommandRow } from "../../../fleet/ui/commands/effective.ts";
import { derivePaneRoster, type PaneRoster, type RosterEntry } from "../../../fleet/ui/pane-roster.ts";
import { FleetCommandBar } from "./fleet-command-bar";

/**
 * `texts` is the grammar an operator writes; `labels` is how the row spells it back. They differ for
 * a prefix binding on purpose — `Prefix+S` is the setting, `Ctrl+B S` is the keys.
 */
function row(
  id: Parameters<typeof commandById>[0],
  texts: string[] = [],
  labels: string[] = texts,
): CommandRow {
  const bindings = texts.map((text) => {
    const parsed = parseBinding(text);
    if (!parsed.ok) throw new Error(`bad fixture ${text}`);
    return parsed.binding;
  });
  return { command: commandById(id), bindings, labels };
}

function entry(paneId: string, label: string, extra: Partial<RosterEntry> = {}): RosterEntry {
  return { paneId, kind: "agent", agent: "claude", label, favorite: false, ...extra };
}

function roster(): PaneRoster {
  return derivePaneRoster({
    triaged: [
      { key: "needs", entries: [entry("p1", "deploy the gateway")] },
      { key: "working", entries: [entry("p2", "rewrite the parser")] },
    ],
    shellPanes: [entry("p9", "spare shell", { kind: "shell", lastSeenAt: 5 })],
  });
}

const ROWS = [
  row("open-fleet-settings", ["Prefix+S"], ["Ctrl+B S"]),
  row("next-tab", ["Prefix+N"], ["Ctrl+B N"]),
  row("toggle-type-mode"),
];

function options(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
}

/** The one prop a test overrides, named rather than left as an open bag. */
interface Overrides {
  mode?: "command" | "pane" | null;
}

function setup(mode: "command" | "pane", overrides: Overrides = {}) {
  const onRun = vi.fn();
  const onOpenPane = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <FleetCommandBar
      mode={mode}
      onClose={onClose}
      rows={ROWS}
      isAvailable={() => true}
      roster={roster()}
      onRun={onRun}
      onOpenPane={onOpenPane}
      {...overrides}
    />,
  );
  return { ...view, onRun, onOpenPane, onClose };
}

describe("FleetCommandBar", () => {
  it("opens as a dialog with its input focused, not as a bottom sheet", () => {
    const { container } = setup("command");
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(container.querySelector('[data-slot="bottom-sheet"]')).toBeNull();
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
  });

  it("starts command mode with a leading slash and lists the whole catalog", () => {
    const { container } = setup("command");
    expect(container.querySelector("input")?.value).toBe("/");
    expect(options(container)).toHaveLength(ROWS.length);
  });

  it("shows every effective binding, and says so when there is none", () => {
    const { container } = setup("command");
    const texts = options(container).map((option) => option.textContent ?? "");
    expect(texts[0]).toContain("Ctrl+B S");
    expect(texts.at(-1)).toContain("No binding");
  });

  it("filters commands after the slash and runs the one activated", async () => {
    const user = userEvent.setup();
    const { container, onRun, onClose } = setup("command");
    await user.type(within(container).getByRole("combobox"), "next");
    expect(options(container)).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(onRun).toHaveBeenCalledWith("next-tab");
    expect(onClose).toHaveBeenCalled();
  });

  it("starts pane mode empty and lists every pane, shell last", () => {
    const { container } = setup("pane");
    expect(container.querySelector("input")?.value).toBe("");
    expect(options(container).map((option) => option.textContent)).toEqual([
      "deploy the gateway",
      "rewrite the parser",
      "spare shell",
    ]);
  });

  it("carries section headings that the arrows never land on", async () => {
    const user = userEvent.setup();
    const { container, onOpenPane } = setup("pane");
    // Three sections, three headings, and none of them is an option.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onOpenPane).toHaveBeenCalledWith(expect.objectContaining({ paneId: "p9" }));
  });

  it("keeps the snapshot it opened with when the roster moves under it", () => {
    const { container, rerender } = setup("pane");
    expect(options(container)).toHaveLength(3);
    rerender(
      <FleetCommandBar
        mode="pane"
        onClose={vi.fn()}
        rows={ROWS}
        isAvailable={() => true}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onRun={vi.fn()}
        onOpenPane={vi.fn()}
      />,
    );
    expect(options(container)).toHaveLength(3);
  });

  it("switches mode in place when the leading slash is removed", async () => {
    const user = userEvent.setup();
    const { container } = setup("command");
    await user.clear(within(container).getByRole("combobox"));
    expect(options(container)).toHaveLength(3);
    expect(options(container)[0]?.textContent).toBe("deploy the gateway");
  });

  it("returns focus to the first row whenever the results change", async () => {
    const user = userEvent.setup();
    const { container } = setup("pane");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(options(container)[2]?.getAttribute("aria-selected")).toBe("true");
    await user.type(within(container).getByRole("combobox"), "deploy");
    expect(options(container)[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("activates nothing when the query matches nothing", async () => {
    const user = userEvent.setup();
    const { container, onOpenPane, onRun } = setup("pane");
    await user.type(within(container).getByRole("combobox"), "zzzz");
    expect(options(container)).toHaveLength(0);
    await user.keyboard("{Enter}");
    expect(onOpenPane).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("dismisses on Escape without invoking anything", async () => {
    const user = userEvent.setup();
    const { onClose, onRun } = setup("command");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("renders nothing at all when closed", () => {
    const { container } = setup("command", { mode: null });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
