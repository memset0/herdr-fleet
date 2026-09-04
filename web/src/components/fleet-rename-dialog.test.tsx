import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";

import { server } from "@/test/setup";
import { FleetRenameDialog, type RenameTarget } from "./fleet-rename-dialog";

const TAB: RenameTarget = { kind: "tab", tabId: "t1", label: "Main" };
const PANE: RenameTarget = { kind: "pane", paneId: "p1", label: "deploy" };

function setup(target: RenameTarget) {
  const onClose = vi.fn();
  const onRenamed = vi.fn();
  const view = render(
    <FleetRenameDialog target={target} scope={undefined} onClose={onClose} onRenamed={onRenamed} />,
  );
  const panel = view.getByRole("dialog");
  // `getByRole("textbox")` answers with an HTMLInputElement here — the panel holds exactly one, and
  // it is the `<input>` above — so the selection assertions below read real fields rather than
  // asserted ones.
  const input = within(panel).getByRole<HTMLInputElement>("textbox");
  return { ...view, panel, input, onClose, onRenamed };
}

/** Record what the rename endpoint was actually asked to do. */
function captureRename(kind: "tab" | "pane", status = 200) {
  const seen: { id: string; body: unknown }[] = [];
  server.use(
    http.post(`/api/${kind}/:id/rename`, async ({ params, request }) => {
      seen.push({ id: String(params.id), body: await request.json() });
      return status === 200
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ ok: false, error: "nope" }, { status });
    }),
  );
  return seen;
}

describe("renaming where the keyboard is", () => {
  it("opens on the command bar's panel, not as a sheet, with the name selected", () => {
    // One render, three facts. They were three tests until the first one — a bare synchronous
    // render — started paying this file's whole environment cost inside its own 5s budget on a
    // loaded machine. Folding them costs nothing: they are all properties of the same open panel.
    const { panel, input } = setup(TAB);
    expect(panel.closest('[data-slot="fleet-panel"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="bottom-sheet"]')).toBeNull();
    expect(input).toHaveValue("Main");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Main".length);
  });

  it("prefills a Pane with the operator's own label only", () => {
    // Not the agent's name and not the session's — prefilling one of those would offer to rename a
    // Pane to a label it never had. The shell passes `paneLabel ?? ""`; this pins the empty case.
    const { input } = setup({ kind: "pane", paneId: "p9", label: "" });
    expect(input).toHaveValue("");
  });

  it("sends exactly one rename on Enter and closes", async () => {
    const user = userEvent.setup();
    const seen = captureRename("tab");
    const { input, onClose, onRenamed } = setup(TAB);
    await user.clear(input);
    await user.type(input, "release{Enter}");
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({ id: "t1", body: { label: "release" } });
    expect(onRenamed).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses a blank tab name in the input, sending nothing", async () => {
    const user = userEvent.setup();
    const seen = captureRename("tab");
    const { panel, input, onClose } = setup(TAB);
    await user.clear(input);
    await user.keyboard("{Enter}");
    expect(seen).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(within(panel).getByRole("alert").textContent).toBeTruthy();
  });

  it("sends a blank Pane label as the clear Collie already means by it", async () => {
    const user = userEvent.setup();
    const seen = captureRename("pane");
    const { input } = setup(PANE);
    await user.clear(input);
    await user.keyboard("{Enter}");
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({ id: "p1", body: { label: "" } });
  });

  it("cancels on Escape without sending", async () => {
    const user = userEvent.setup();
    const seen = captureRename("tab");
    const { onClose } = setup(TAB);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(seen).toHaveLength(0);
  });

  it("cancels on the backdrop without sending", async () => {
    const user = userEvent.setup();
    const seen = captureRename("tab");
    const { onClose } = setup(TAB);
    // The panel's only button is its backdrop; the input is the sole other focusable thing in it.
    const backdrop = within(document.body).getByRole("button", { name: /close/i });
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
    expect(seen).toHaveLength(0);
  });

  it("keeps a refusal inside the panel and stays open", async () => {
    const user = userEvent.setup();
    captureRename("tab", 409);
    const { panel, input, onClose } = setup(TAB);
    await user.clear(input);
    await user.type(input, "taken{Enter}");
    await vi.waitFor(() => expect(within(panel).queryByRole("alert")).not.toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });
});
