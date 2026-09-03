import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { manualPaneFitRows } from "../../../fleet/ui/manual-pane-fit.ts";
import { NativePaneFitControls } from "./native-pane-fit";

beforeEach(() => {
  localStorage.clear();
  manualPaneFitRows.set(null);
});

/** A settle short enough to wait out for real — the delay is a prop precisely so a test need not
 *  fake the clock React's own scheduler runs on. */
const SETTLE = 200;
const typist = () => userEvent.setup();
/** Long enough that a settle would have fired if it were going to. */
const quiet = () => new Promise((resolve) => setTimeout(resolve, SETTLE * 3));

describe("NativePaneFitControls", () => {
  it("sends one resize when the typed height holds still, not one per keystroke", async () => {
    const user = typist();
    const onFit = vi.fn();
    render(<NativePaneFitControls busy={false} disabled={false} onFit={onFit} settleMs={SETTLE} />);

    await user.type(screen.getByLabelText("Rows"), "24");
    // One request for the whole word: `2` is below the picker's floor and never settles on its own.
    await waitFor(() => expect(onFit).toHaveBeenCalledExactlyOnceWith(24));
    expect(manualPaneFitRows.snapshot()).toBe(24);

    // A settle that lands back on the number already applied sends nothing: typing a digit and
    // taking it away again is not a resize, however many renders it costs.
    onFit.mockClear();
    await user.type(screen.getByLabelText("Rows"), "9");
    await user.keyboard("{Backspace}");
    await quiet();
    expect(onFit).not.toHaveBeenCalled();
  });

  it("treats an empty field as a preference rather than a resize", async () => {
    manualPaneFitRows.set(30);
    const user = typist();
    const onFit = vi.fn();
    render(<NativePaneFitControls busy={false} disabled={false} onFit={onFit} settleMs={SETTLE} />);

    await user.clear(screen.getByLabelText("Rows"));
    await quiet();
    expect(onFit).not.toHaveBeenCalled();
    expect(manualPaneFitRows.snapshot()).toBeNull();
  });

  it("fits with whatever the field holds when the button is pressed", async () => {
    manualPaneFitRows.set(30);
    const user = typist();
    const onFit = vi.fn();
    render(<NativePaneFitControls busy={false} disabled={false} onFit={onFit} settleMs={SETTLE} />);

    await user.click(screen.getByRole("button", { name: "Resize Pane to this view" }));
    expect(onFit).toHaveBeenCalledExactlyOnceWith(30);
  });

  it("sends nothing while the write cannot land", async () => {
    const user = typist();
    const onFit = vi.fn();
    render(<NativePaneFitControls busy={false} disabled onFit={onFit} settleMs={SETTLE} />);

    const field = screen.getByLabelText("Rows");
    expect(field).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resize Pane to this view" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Resize Pane to this view" }));
    expect(onFit).not.toHaveBeenCalled();
  });
});
