import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { derivePaneRoster } from "../../../fleet/ui/pane-roster.ts";
import {
  FleetCommandsProvider,
  useFleetCommandAdapters,
  type CommandAdapters,
} from "./fleet-commands";

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
    expect(composerKeys).toEqual(["q"]);
  });

  it("names the binding actually pressed when the outcome is not visible", async () => {
    const user = userEvent.setup();
    setup({ "fit-pane-width": vi.fn() });
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(setStatus).toHaveBeenCalledWith("Ctrl+B R · Fit Current Pane Width", "success");
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
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Fit Current Pane Width"), "warn");
  });

  it("refuses a command no surface has registered", async () => {
    const user = userEvent.setup();
    setup({});
    await user.keyboard("{Control>}b{/Control}");
    await user.keyboard("r");
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Fit Current Pane Width"), "warn");
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
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Fit Current Pane Width"), "warn");
  });
});
