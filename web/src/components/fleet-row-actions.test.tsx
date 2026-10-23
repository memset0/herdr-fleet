import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyTags } from "../../../fleet/pane-tags/document.ts";
import { usePointerMenuGestures } from "@/components/fleet-context-menu";
import { FleetPaneTagsProvider } from "@/components/fleet-pane-tags";
import { FleetPaneActions, FleetTabActions } from "@/components/fleet-row-actions";
import { createPaneTagClient } from "@/lib/fleet-pane-tags";
import { __resetPins, currentPins } from "@/lib/pins";
import type { AgentView, TabView } from "@/lib/types";
import { server } from "@/test/setup";

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

function Harness({ kind, onClosed = vi.fn() }: { kind: "pane" | "tab"; onClosed?: () => void }) {
  return kind === "pane" ? (
    <FleetPaneActions open onClose={vi.fn()} pane={pane} onRenamed={vi.fn()} onClosed={onClosed} />
  ) : (
    <FleetTabActions open onClose={vi.fn()} tab={tab} onRenamed={vi.fn()} onClosed={onClosed} />
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

  it("asks the rename the keyboard asks, not one of its own", () => {
    rightClick(200, 300);
    render(<Harness kind="pane" />);
    fireEvent.click(within(screen.getByRole("menu")).getByText(/rename/i));
    // The menu gives way to a question — and it is the SAME question a key opens: the shared prompt
    // panel, holding the pane's own value. Two routes, one rename, one save.
    expect(screen.queryByRole("menu")).toBeNull();
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest('[data-slot="fleet-panel"]')).not.toBeNull();
    expect(within(dialog).getByRole("textbox")).toHaveValue("editor");
  });
});

describe("FleetTabActions", () => {
  beforeEach(() => {
    setPointer("fine");
    render(<Recorder />);
    rightClick(1, 1, "touch");
  });

  it("closes on the first activation, without arming and asking again", async () => {
    server.use(http.post("*/api/tab/:id/close", () => HttpResponse.json({ ok: true })));
    const onClosed = vi.fn();
    rightClick(120, 160);
    render(<Harness kind="tab" onClosed={onClosed} />);
    fireEvent.click(within(screen.getByRole("menu")).getByText(/close tab/i));
    // The menu did not exist until a deliberate secondary click, and reaching this row took a second
    // deliberate press — a third is asking the operator to confirm what they have already done twice.
    await waitFor(() => expect(onClosed).toHaveBeenCalledExactlyOnceWith("w1:t1"));
    expect(screen.queryByText(/tap again/i)).toBeNull();
  });
});

describe("a pane's own verbs in the menu", () => {
  let posts = 0;
  const client = () =>
    createPaneTagClient(async (_url, init) => {
      if (init?.method === "POST") posts += 1;
      return Response.json({ version: "0", document: emptyTags() });
    });

  beforeEach(() => {
    posts = 0;
    __resetPins();
    setPointer("fine");
    render(<Recorder />);
    rightClick(1, 1, "touch");
  });

  function openPane(target: AgentView, props: { readOnly?: boolean; onClose?: () => void } = {}) {
    rightClick(200, 300);
    return render(
      <FleetPaneTagsProvider client={client()}>
        <FleetPaneActions open onClose={props.onClose ?? vi.fn()} pane={target} readOnly={props.readOnly}
          onRenamed={vi.fn()} onClosed={vi.fn()} />
      </FleetPaneTagsProvider>,
    );
  }

  it("pins through Collie's own store, then offers Unpin", () => {
    const onClose = vi.fn();
    const first = openPane(pane, { onClose });
    fireEvent.click(within(screen.getByRole("menu")).getByText("Pin to top"));
    expect(onClose).toHaveBeenCalled();
    expect(currentPins()).toHaveLength(1);
    first.unmount();
    openPane(pane);
    fireEvent.click(within(screen.getByRole("menu")).getByText("Unpin"));
    expect(currentPins()).toHaveLength(0);
  });

  it("opens the shell's tag editor for that pane without writing a tag", async () => {
    const onClose = vi.fn();
    openPane(pane, { onClose });
    fireEvent.click(within(screen.getByRole("menu")).getByText("Edit pane tags"));
    expect(onClose).toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit pane tags" })).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it("keeps both on a read-only device, where the terminal verbs are withheld", () => {
    openPane(pane, { readOnly: true });
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByText("Pin to top")).toBeInTheDocument();
    expect(menu.getByText("Edit pane tags")).toBeInTheDocument();
    expect(menu.queryByText("Rename")).toBeNull();
  });

  it("offers a shell its pin and no tags", () => {
    openPane({ ...pane, kind: "shell" });
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByText("Pin to top")).toBeInTheDocument();
    expect(menu.queryByText("Edit pane tags")).toBeNull();
  });

  it("adds them to a merged row's Tab menu, and only there", () => {
    rightClick(200, 300);
    const merged = render(
      <FleetPaneTagsProvider client={client()}>
        <FleetTabActions open onClose={vi.fn()} tab={tab} pane={pane} onRenamed={vi.fn()} onClosed={vi.fn()} />
      </FleetPaneTagsProvider>,
    );
    let menu = within(screen.getByRole("menu"));
    expect(menu.getByText("Rename")).toBeInTheDocument();
    expect(menu.getByText(/close tab/i)).toBeInTheDocument();
    expect(menu.getByText("Pin to top")).toBeInTheDocument();
    expect(menu.getByText("Edit pane tags")).toBeInTheDocument();
    merged.unmount();

    rightClick(200, 300);
    render(
      <FleetPaneTagsProvider client={client()}>
        <FleetTabActions open onClose={vi.fn()} tab={tab} onRenamed={vi.fn()} onClosed={vi.fn()} />
      </FleetPaneTagsProvider>,
    );
    menu = within(screen.getByRole("menu"));
    expect(menu.queryByText("Pin to top")).toBeNull();
    expect(menu.queryByText("Edit pane tags")).toBeNull();
  });
});
