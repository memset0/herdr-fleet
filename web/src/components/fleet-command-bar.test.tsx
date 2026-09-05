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

/**
 * The same three Panes, each carrying a different one of the four searchable facts, and none of
 * them mentioning the others in its own name. A query that finds one here found it by the fact the
 * test named and by nothing else.
 */
function namedRoster(): PaneRoster {
  return derivePaneRoster({
    triaged: [
      {
        key: "needs",
        entries: [
          entry("p1", "alpha", { host: "orinoco", context: "zephyr", tabLabel: "quicksand" }),
          entry("p2", "bravo", { host: "danube", context: "mistral", tabLabel: "granite" }),
        ],
      },
    ],
    shellPanes: [],
  });
}

const ROWS = [
  row("open-fleet-settings", ["Prefix+S"], ["Ctrl+B S"]),
  row("next-tab", ["Prefix+N"], ["Ctrl+B N"]),
  row("fit-pane-width", ["Prefix+R"], ["Ctrl+B R"]),
  // LAST, and a test below depends on it: the unbound row is the one that must show "No binding".
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

describe("finding a Pane by any of the four facts that name it", () => {
  function search() {
    const view = render(
      <FleetCommandBar
        mode="pane"
        onClose={vi.fn()}
        rows={ROWS}
        isAvailable={() => true}
        roster={namedRoster()}
        onRun={vi.fn()}
        onOpenPane={vi.fn()}
      />,
    );
    const input = within(view.container).getByRole<HTMLInputElement>("combobox");
    return { view, input };
  }

  it.each([
    ["the Pane's own name", "alpha"],
    ["the host it is on", "orinoco"],
    ["the Space it is in", "zephyr"],
    ["the Tab it sits in", "quicksand"],
  ])("matches on %s", async (_what, typed) => {
    const user = userEvent.setup();
    const { view, input } = search();
    await user.type(input, typed);
    const rows = options(view.container);
    // Exactly the one Pane carrying that fact — the other row carries the other three facts, so a
    // second hit would mean the query matched something this test did not name.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("alpha");
    view.unmount();
  });

  it("shows the fact it matched on, in the one slot the row already had", async () => {
    const user = userEvent.setup();
    // Matched on the Tab, which the row does not normally show — so the row shows the Tab instead of
    // the Space. Same element, same width: the operator can see WHY the row is in the list.
    const { view, input } = search();
    await user.type(input, "quicksand");
    const matched = options(view.container)[0];
    expect(matched?.textContent).toContain("quicksand");
    expect(matched?.textContent).not.toContain("zephyr");
    view.unmount();
  });

  it("shows the Space when the match was the Pane's own name", async () => {
    const user = userEvent.setup();
    const { view, input } = search();
    await user.type(input, "alpha");
    const matched = options(view.container)[0];
    expect(matched?.textContent).toContain("zephyr");
    view.unmount();
  });
});


describe("finding a command by the word an operator uses for it", () => {
  it("finds the resize command by typing resize", async () => {
    // It shipped as `Fit Current Pane Width`, which describes the mechanism. The operator searched
    // for `resize` and found nothing — there is not even an `s` in the old name or in the id, so no
    // amount of fuzziness could have reached it. The name is what a palette is searched by.
    const user = userEvent.setup();
    const view = setup("command");
    const input = within(view.container).getByRole<HTMLInputElement>("combobox");
    await user.type(input, "resize");
    const rows = options(view.container);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Resize Pane");
  });
});
