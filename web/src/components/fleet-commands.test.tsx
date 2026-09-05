import { act, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseBinding, type Binding } from "../../../fleet/ui/commands/bindings.ts";
import type { CommandId } from "../../../fleet/ui/commands/catalog.ts";
import { refuseCommand } from "../../../fleet/ui/commands/refusal.ts";
import { derivePaneRoster } from "../../../fleet/ui/pane-roster.ts";
import { __resetCaretPark } from "@/lib/fleet-composer-focus";
import {
  FleetCommandsProvider,
  useFleetCommandAdapters,
  type CommandAdapters,
} from "./fleet-commands";

function parsed(text: string): readonly Binding[] {
  const result = parseBinding(text);
  if (!result.ok) throw new Error(`bad fixture ${text}`);
  return [result.binding];
}

const setStatus = vi.fn();
vi.mock("@/lib/status", () => ({
  setStatus: (...args: unknown[]) => setStatus(...args),
}));

/**
 * A composer stand-in that reads its keys the way the real one does: a React `onKeyDown` on the
 * textarea, which is the BUBBLE phase on that element. That is the whole point of these tests — the
 * command layer's capture-phase listener has to get there first without this component cooperating.
 */
function FakeComposer({ onKey }: { onKey: (key: string) => void }) {
  return (
    <textarea
      aria-label="draft"
      // The slot the focus machinery finds the composer by. Without it nothing below is exercised.
      data-slot="chat-input"
      onKeyDown={(event) => {
        // A modifier's own keydown is not a key this component would act on, and the recognizer
        // never consumes one, so it is not what these assertions are about.
        if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) onKey(event.key);
      }}
      onChange={() => undefined}
      value=""
    />
  );
}

function setup(adapters: CommandAdapters, options: { available?: boolean } = {}) {
  const composerKeys: string[] = [];
  const view = render(
    <FleetCommandsProvider
      adapters={adapters}
      available={() => options.available ?? true}
      roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
      onOpenPane={vi.fn()}
    >
      <FakeComposer onKey={(key) => composerKeys.push(key)} />
    </FleetCommandsProvider>,
  );
  const draft = view.getByLabelText("draft");
  draft.focus();
  return { ...view, composerKeys, draft };
}

beforeEach(() => {
  setStatus.mockClear();
});

describe("the keyboard layer", () => {
  it("takes a direct chord even while the composer holds focus", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    const { composerKeys } = setup({ "fit-pane-width": fit });

    // Not a default binding, so this asserts the mechanism rather than the catalog: the bar's own
    // chord is the one direct default, and it opens a surface rather than calling an adapter.
    await user.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    expect(composerKeys).not.toContain("P");
  });

  it("arms on the prefix and hands the next key to the command, not to the composer", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    const { composerKeys } = setup({ "fit-pane-width": fit });

    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(fit).toHaveBeenCalledTimes(1);
    expect(composerKeys).toEqual([]);
  });

  it("takes Escape and the arrows only while a prefix is pending, and gives them back after", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { composerKeys } = setup({ "close-pane": close });

    // With nothing pending, the composer reads its own keys exactly as before.
    await user.keyboard("{Escape}{ArrowUp}");
    expect(composerKeys).toEqual(["Escape", "ArrowUp"]);

    // Pending: the sequence takes the next key whatever it is.
    composerKeys.length = 0;
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("{Escape}");
    expect(composerKeys).toEqual([]);
    expect(close).not.toHaveBeenCalled();

    // …and the moment it ends, the same key goes back to the composer.
    await user.keyboard("{Escape}");
    expect(composerKeys).toEqual(["Escape"]);
  });

  it("ends the sequence without swallowing a key it has no meaning for", async () => {
    const user = userEvent.setup();
    const { composerKeys } = setup({});
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("q");
    // NOT CONSUMED — the recognizer still refuses to swallow a key it has no meaning for, which is
    // what this case is about. It no longer REACHES the draft, because an armed prefix parks the
    // caret so an input method cannot claim the second chord, and that costs this one character.
    // Decided deliberately; see the requirement.
    expect(composerKeys).toEqual([]);
  });

  it("names the binding actually pressed when the outcome is not visible", async () => {
    const user = userEvent.setup();
    setup({ "fit-pane-width": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(setStatus).toHaveBeenCalledWith("Ctrl+B R · Resize Pane", "success");
  });

  it("says nothing at all for a command whose whole effect is the navigation asked for", async () => {
    const user = userEvent.setup();
    setup({ "next-tab": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("n");
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("refuses a command with nowhere to act and runs no adapter", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    setup({ "fit-pane-width": fit }, { available: false });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(fit).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Resize Pane"), "warn");
  });

  it("refuses a command no surface has registered", async () => {
    const user = userEvent.setup();
    setup({});
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Resize Pane"), "warn");
  });

  it("ignores auto-repeat so a held key runs a command once", async () => {
    const fit = vi.fn();
    setup({ "fit-pane-width": fit });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyB", ctrlKey: true, bubbles: true }),
    );
    for (let i = 0; i < 3; i += 1) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyR", repeat: true, bubbles: true }),
      );
    }
    expect(fit).not.toHaveBeenCalled();
  });
});

describe("adapters a mounted surface registers", () => {
  function Pane({ fit }: { fit: () => void }) {
    // A fresh object every render, which is what a page holding live closures over its pane
    // actually does. The registration must not churn on it.
    useFleetCommandAdapters({ "fit-pane-width": fit });
    return <div>pane</div>;
  }

  function mount(fit: () => void, adapters: CommandAdapters = {}) {
    return render(
      <FleetCommandsProvider
        adapters={adapters}
        available={() => true}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onOpenPane={vi.fn()}
      >
        <Pane fit={fit} />
      </FleetCommandsProvider>,
    );
  }

  it("reaches a command the page owns and the shell does not", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    mount(fit);
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it("wins over a shell adapter for the same command while it is mounted", async () => {
    const user = userEvent.setup();
    const pageFit = vi.fn();
    const shellFit = vi.fn();
    mount(pageFit, { "fit-pane-width": shellFit });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(pageFit).toHaveBeenCalledTimes(1);
    expect(shellFit).not.toHaveBeenCalled();
  });

  it("takes its commands away with it when it unmounts", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    const view = mount(fit);
    view.rerender(
      <FleetCommandsProvider
        adapters={{}}
        available={() => true}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onOpenPane={vi.fn()}
      >
        <div>no pane</div>
      </FleetCommandsProvider>,
    );
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(fit).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Resize Pane"), "warn");
  });
});

describe("what a pending prefix shows", () => {
  const HINTS = '[data-slot="fleet-prefix-hints"]';

  function panel() {
    return document.querySelector<HTMLElement>(HINTS);
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays away while nothing is pending", () => {
    setup({});
    expect(panel()).toBeNull();
  });

  it("appears once the operator has waited, listing the second chords", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup({});
    await user.keyboard("{Control>}b{/Control}");
    expect(panel()).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const shown = panel();
    expect(shown).not.toBeNull();
    const text = shown?.textContent ?? "";
    expect(text).toContain("Ctrl+B");
    expect(text).toContain("Open Fleet Settings");
    expect(text).toContain("Next Tab");
    // The one direct default belongs to a command that also has a prefix binding, so its absence
    // here is the filter working rather than the command being missing.
    expect(text).not.toContain("Ctrl+Shift+P");
  });

  it("never appears for an operator who does not hesitate", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fit = vi.fn();
    setup({ "fit-pane-width": fit });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(fit).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(panel()).toBeNull();
  });

  it("leaves the moment the sequence completes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fit = vi.fn();
    setup({ "fit-pane-width": fit });
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(panel()).not.toBeNull();

    // …and the panel did not eat the key it was describing.
    await user.keyboard("r");
    expect(fit).toHaveBeenCalledTimes(1);
    expect(panel()).toBeNull();
  });

  it("leaves on Escape and on the window losing focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup({});
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await user.keyboard("{Escape}");
    expect(panel()).toBeNull();

    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(panel()).not.toBeNull();
    await act(async () => {
      globalThis.dispatchEvent(new Event("blur"));
    });
    expect(panel()).toBeNull();
  });

  it("holds no space, takes no pointer and is hidden from assistive technology", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup({});
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const shown = panel();
    expect(shown).toHaveAttribute("aria-hidden", "true");
    expect(shown?.className).toContain("pointer-events-none");
    expect(shown?.className).toContain("fixed");
    expect(shown?.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0);
  });

  it("shows the operator's own bindings, not the shipped ones", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const overrides = new Map<CommandId, readonly Binding[]>([["next-tab", parsed("Prefix+Right")]]);
    render(
      <FleetCommandsProvider
        adapters={{}}
        available={() => true}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onOpenPane={vi.fn()}
        overrides={overrides}
      >
        <div>page</div>
      </FleetCommandsProvider>,
    );
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const rows = Array.from(
      panel()?.querySelectorAll('[data-slot="fleet-prefix-hint"]') ?? [],
    ).map((row) => row.textContent ?? "");
    expect(rows.some((row) => row.startsWith("Right") && row.includes("Next Tab"))).toBe(true);
    expect(rows.some((row) => row.startsWith("N") && row.includes("Next Tab"))).toBe(false);
  });

  it("dims an entry that has nowhere to act rather than hiding it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Nothing is addressable: no Pane, no Tab, no Space.
    render(
      <FleetCommandsProvider
        adapters={{}}
        available={(scope) => scope === "global"}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onOpenPane={vi.fn()}
      >
        <div>page</div>
      </FleetCommandsProvider>,
    );
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const rows = Array.from(panel()?.querySelectorAll('[data-slot="fleet-prefix-hint"]') ?? []);
    const settings = rows.find((row) => (row.textContent ?? "").includes("Open Fleet Settings"));
    const renamePane = rows.find((row) => (row.textContent ?? "").includes("Rename Pane"));
    // Both listed — the panel describes the keyboard, not only this moment — and only one dimmed.
    expect(settings?.className).not.toContain("opacity-40");
    expect(renamePane?.className).toContain("opacity-40");
  });
});

describe("binding the command bar itself", () => {
  // `open-command-bar` is dispatched ahead of every adapter, so a document binding IT travels a
  // different path from one binding a command with an action. That path needed its own test.
  it("opens on a chord the operator bound to it", async () => {
    const user = userEvent.setup();
    render(
      <FleetCommandsProvider
        adapters={{}}
        available={() => true}
        roster={derivePaneRoster({ triaged: [], shellPanes: [] })}
        onOpenPane={vi.fn()}
        overrides={new Map<CommandId, readonly Binding[]>([["open-command-bar", parsed("Alt+Q")]])}
      >
        <div>page</div>
      </FleetCommandsProvider>,
    );
    expect(document.querySelector('[data-slot="fleet-command-bar"]')).toBeNull();
    await user.keyboard("{Alt>}q{/Alt}");
    expect(document.querySelector('[data-slot="fleet-command-bar"]')).not.toBeNull();
  });
});

describe("a command that refuses", () => {
  it("publishes its own sentence on the error channel and nothing else", async () => {
    const user = userEvent.setup();
    const { composerKeys } = setup({
      "fit-pane-width": () => {
        refuseCommand("The microphone is already recording.");
      },
    });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    // The command's words, verbatim — not the generic "did not complete", which would send the
    // operator looking for a bug instead of telling them what is true.
    expect(setStatus).toHaveBeenCalledWith("The microphone is already recording.", "error");
    expect(setStatus).not.toHaveBeenCalledWith(expect.stringContaining("did not complete"), "error");
    expect(composerKeys).toBeDefined();
  });

  it("is not confused with an adapter that actually threw", async () => {
    const user = userEvent.setup();
    setup({
      "fit-pane-width": () => {
        throw new Error("boom");
      },
    });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    // An ordinary throw is the app breaking, and the honest report is that the command did not
    // complete — never the exception's own text, which is for a log and not for a person.
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Resize Pane"), "error");
    expect(setStatus).not.toHaveBeenCalledWith("boom", "error");
  });
});

describe("the caret while a prefix is armed", () => {
  const parked = () => document.querySelector('[data-slot="fleet-key-park"]');
  // The park is module state, so one case's park would otherwise still be standing in the next.
  beforeEach(() => __resetCaretPark());

  it("leaves no editable element focused, so an input method has nowhere to compose", async () => {
    const user = userEvent.setup();
    const { draft } = setup({ "fit-pane-width": vi.fn() });
    expect(document.activeElement).toBe(draft);

    await user.keyboard("{Control>}b{/Control}");
    expect(document.activeElement).not.toBe(draft);
    expect(document.activeElement).toBe(parked());
  });

  it("gives the caret back when the sequence completes", async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    const { draft } = setup({ "fit-pane-width": fit });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");

    expect(fit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(draft));
  });

  it("gives it back on Escape", async () => {
    const user = userEvent.setup();
    const { draft } = setup({ "fit-pane-width": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    expect(document.activeElement).toBe(parked());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(draft));
  });

  it("gives it back on an unregistered chord, and that character is lost", async () => {
    // ACCEPTED COST, decided by the owner. Unparked, this key would have reached the draft; the
    // preemption that keeps an input method off the second chord keeps this one off too.
    const user = userEvent.setup();
    const { draft, composerKeys } = setup({ "fit-pane-width": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("z");

    expect(composerKeys).not.toContain("z");
    await waitFor(() => expect(document.activeElement).toBe(draft));
  });

  it("gives it back when the sequence is simply abandoned", async () => {
    // The recognizer notices its own expiry on the NEXT key, and there is no next key here. Parking
    // carries its own timer for exactly this.
    const user = userEvent.setup();
    const { draft } = setup({ "fit-pane-width": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    expect(document.activeElement).toBe(parked());

    await waitFor(() => expect(document.activeElement).toBe(draft), { timeout: 5000 });
  }, 10000);

  it("does not move the caret while a composition is in flight", async () => {
    const user = userEvent.setup();
    const { draft } = setup({ "fit-pane-width": vi.fn() });
    act(() => {
      draft.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    });

    await user.keyboard("{Control>}b{/Control}");
    // Half a word is worth more than a shortcut.
    expect(document.activeElement).toBe(draft);
  });
});
