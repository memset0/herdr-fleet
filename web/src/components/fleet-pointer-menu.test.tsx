import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { useRowActionsPlace, usePointerMenuGestures } from "@/components/fleet-pointer-menu";
import { BottomSheet } from "@/components/ui/sheet";

function pointerDown(type: string) {
  const event = new MouseEvent("pointerdown", { bubbles: true });
  // jsdom has no PointerEvent constructor, and the listener reads exactly one field off it.
  Object.defineProperty(event, "pointerType", { value: type });
  act(() => {
    document.dispatchEvent(event);
  });
}

function rightClick(x: number, y: number) {
  act(() => {
    document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }));
  });
}

function panel() {
  return screen.getByRole("dialog").querySelector("[data-slot='sheet-title-row']")?.closest("div[tabindex]");
}

/** A sheet that records the gesture and stands where the gesture says, like the two real ones. */
function Harness({ asking = false }: { asking?: boolean }) {
  usePointerMenuGestures();
  const [open, setOpen] = useState(false);
  const place = useRowActionsPlace(open, asking);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} place={place} title="Row">
        <p>rows</p>
      </BottomSheet>
    </>
  );
}

describe("BottomSheet placement", () => {
  it("keeps the bottom stand, its scrim and its grab handle when nothing places it", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Row">
        <p>rows</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("justify-end");
    expect(dialog.querySelector("button[aria-hidden='true']")?.className ?? "").toContain("bg-black/50");
    expect(panel()?.className ?? "").toContain("rounded-t-md");
  });

  it("stands at the cursor without dimming the row it is about", () => {
    render(
      <BottomSheet open onClose={() => {}} place={{ kind: "point", x: 120, y: 240 }} title="Row">
        <p>rows</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).not.toContain("justify-end");
    expect(dialog.querySelector("button[aria-hidden='true']")?.className ?? "").not.toContain("bg-black/50");
    expect(panel()?.className ?? "").toContain("absolute");
  });

  it("stands in the middle, dimmed, when it is holding a question", () => {
    render(
      <BottomSheet open onClose={() => {}} place={{ kind: "center" }} title="Row">
        <p>rows</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("items-center");
    expect(dialog.querySelector("button[aria-hidden='true']")?.className ?? "").toContain("bg-black/50");
    expect(panel()?.className ?? "").toContain("max-w-sm");
  });
});

describe("useRowActionsPlace", () => {
  beforeEach(() => {
    // Drain anything a previous case armed, so a stale gesture can never place the next sheet.
    pointerDown("touch");
    rightClick(1, 1);
  });

  it("stands a mouse's right-click at the cursor", () => {
    render(<Harness />);
    pointerDown("mouse");
    rightClick(200, 300);
    fireEvent.click(screen.getByText("open"));
    expect(panel()?.className ?? "").toContain("absolute");
  });

  it("leaves a touch's context menu as the bottom sheet", () => {
    render(<Harness />);
    pointerDown("touch");
    rightClick(200, 300);
    fireEvent.click(screen.getByText("open"));
    expect(panel()?.className ?? "").toContain("rounded-t-md");
  });

  it("moves the same gesture to the centre once the sheet is asking", () => {
    render(<Harness asking />);
    pointerDown("mouse");
    rightClick(200, 300);
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog").className).toContain("items-center");
  });
});
