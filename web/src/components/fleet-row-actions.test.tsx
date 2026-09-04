import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePointerMenuGestures } from "@/components/fleet-context-menu";
import { FleetPaneActions, FleetTabActions } from "@/components/fleet-row-actions";
import type { AgentView, TabView } from "@/lib/types";

const pane: AgentView = {
  paneId: "w1:p1",
  workspaceId: "w1",
  workspaceLabel: "Project",
  workspaceNumber: 1,
  tabId: "w1:t1",
  tabLabel: "one",
  paneLabel: "editor",
  agent: "claude",
  status: "working",
  cwd: "/repo",
  focused: false,
};

const tab: TabView = {
  tabId: "w1:t1",
  workspaceId: "w1",
  number: 1,
  label: "one",
  focused: false,
  paneCount: 2,
};

/**
 * jsdom answers every media query false, which is the "no pointing device attached" reading — and
 * that reading must NOT take the menu away, so `fine` here is jsdom's own default and `coarse` is
 * the one a phone gives.
 */
function setPointer(kind: "fine" | "coarse") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: kind === "coarse" && query === "(pointer: coarse)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function rightClick(x: number, y: number, pointerType = "mouse") {
  const down = new MouseEvent("pointerdown", { bubbles: true });
  Object.defineProperty(down, "pointerType", { value: pointerType });
  act(() => {
    document.dispatchEvent(down);
    document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }));
  });
}

/** The shell mounts this once for the app's lifetime; a gesture is only recorded while it stands. */
function Recorder() {
  usePointerMenuGestures();
  return null;
}

function Harness({ kind }: { kind: "pane" | "tab" }) {
  return kind === "pane" ? (
    <FleetPaneActions
      open
      onClose={vi.fn()}
      pane={pane}
      onRenamed={vi.fn()}
      onClosed={vi.fn()}
    />
  ) : (
    <FleetTabActions open onClose={vi.fn()} tab={tab} onRenamed={vi.fn()} onClosed={vi.fn()} />
  );
}

const original = window.matchMedia;
afterEach(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: original });
});

describe("FleetPaneActions", () => {
  beforeEach(() => {
    setPointer("fine");
    render(<Recorder />);
    // Drain anything a previous case armed.
    rightClick(1, 1, "touch");
  });

  it("answers a mouse's right-click with the menu, not the sheet", () => {
    rightClick(200, 300);
    render(<Harness kind="pane" />);
    const menu = screen.getByRole("menu");
    // The target is the menu's NAME and not a caption in it: the menu is standing on the row it
    // would be repeating, and a screen reader is the one reader who cannot see that.
    expect(menu).toHaveAccessibleName(/editor/i);
    expect(menu.textContent).not.toMatch(/editor/i);
    // A menu is a menu: its verbs are menu items, and it dims nothing.
    expect(within(menu).getAllByRole("menuitem").length).toBeGreaterThan(0);
    expect(document.querySelector(".bg-black\\/50")).toBeNull();
    // …and the bottom sheet is not mounted at all, which is the whole point of two components.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Collie's sheet on a device whose only pointer is coarse", () => {
    setPointer("coarse");
    rightClick(200, 300);
    render(<Harness kind="pane" />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps Collie's sheet when nothing was opened by a pointer", () => {
    render(<Harness kind="pane" />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("asks a rename in the centre, not in the menu", () => {
    rightClick(200, 300);
    render(<Harness kind="pane" />);
    fireEvent.click(within(screen.getByRole("menu")).getByText(/rename/i));
    // The menu gives way to a question, and the question is a dialog with the pane's own value in it.
    expect(screen.queryByRole("menu")).toBeNull();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/label/i)).toHaveValue("editor");
  });
});

describe("FleetTabActions", () => {
  beforeEach(() => {
    setPointer("fine");
    render(<Recorder />);
    rightClick(1, 1, "touch");
  });

  it("names the blast radius on the second tap, exactly as the sheet does", () => {
    rightClick(120, 160);
    render(<Harness kind="tab" />);
    const menu = screen.getByRole("menu");
    const close = within(menu).getByText(/close tab/i);
    fireEvent.click(close);
    // Armed, the row says what closing costs rather than repeating the verb.
    expect(within(screen.getByRole("menu")).getByText(/2 panes/i)).toBeInTheDocument();
  });
});
