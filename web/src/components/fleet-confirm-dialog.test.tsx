import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { COMMAND_CATALOG } from "../../../fleet/ui/commands/catalog.ts";
import { FleetConfirmDialog } from "./fleet-confirm-dialog";

function setup() {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <FleetConfirmDialog
      title="Close tab “Main”?"
      detail="Every pane in it is killed."
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  const panel = view.getByRole("dialog");
  const input = within(panel).getByRole<HTMLInputElement>("textbox");
  return { ...view, panel, input, onConfirm, onClose };
}

describe("confirming a close", () => {
  it("opens on the keyboard's own panel holding a selected y, and says which answer is safe", () => {
    const { panel, input } = setup();
    expect(panel.closest('[data-slot="fleet-panel"]')).not.toBeNull();
    expect(input).toHaveValue("y");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
    // The capital in `y/N` is the whole convention: it names the answer you get without aiming, and
    // it belongs to the QUESTION — in front of the field it read as a prefix of what you were typing.
    const heading = within(panel).getByText(/Close tab .Main.\?/);
    expect(heading.textContent).toContain("y/N");
    expect(input.previousElementSibling).toBe(heading.parentElement);
    expect(panel.textContent).toContain("Every pane in it is killed.");
  });

  it("closes on Enter with the y it was holding", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on an upper-case Y and on a y with spaces around it", async () => {
    for (const typed of ["Y", "  y  "]) {
      const user = userEvent.setup();
      const { input, onConfirm, unmount } = setup();
      await user.clear(input);
      await user.type(input, `${typed}{Enter}`);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      // One dialog at a time: a second render would leave two in the document and every query
      // after it ambiguous.
      unmount();
    }
  });

  it("does NOT close on n, on a typo, or on an empty field", async () => {
    // The three answers that matter: the explicit no, the accident, and the cleared field. An
    // unrecognised answer has to mean no — "not n" would close on a typo, and a truthiness test
    // would close on anything at all.
    for (const typed of ["n", "N", "yes", "q", ""]) {
      const user = userEvent.setup();
      const { input, onConfirm, onClose, unmount } = setup();
      await user.clear(input);
      if (typed !== "") await user.type(input, typed);
      await user.keyboard("{Enter}");
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      unmount();
    }
  });

  it("sends nothing on Escape or on the backdrop", async () => {
    const user = userEvent.setup();
    const escaped = setup();
    await user.keyboard("{Escape}");
    expect(escaped.onConfirm).not.toHaveBeenCalled();
    expect(escaped.onClose).toHaveBeenCalled();
    escaped.unmount();

    const dismissed = setup();
    // The panel's only button is its backdrop.
    await user.click(within(document.body).getByRole("button", { name: /close/i }));
    expect(dismissed.onConfirm).not.toHaveBeenCalled();
    expect(dismissed.onClose).toHaveBeenCalled();
  });
});

describe("the catalog's close commands", () => {
  it("holds exactly the two this confirmation covers", () => {
    // Asserted over the catalog rather than by inspection, so a third close command added later
    // fails here until somebody decides how it asks.
    const closes = COMMAND_CATALOG.filter((command) => command.id.startsWith("close-")).map((c) => c.id);
    expect(closes.toSorted()).toEqual(["close-pane", "close-tab"]);
  });
});
