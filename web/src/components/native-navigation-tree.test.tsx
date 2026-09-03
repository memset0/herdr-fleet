import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  deriveNavigationTree,
  hostCollapseId,
  spaceDisclosureId,
  tabDisclosureId,
} from "../../../fleet/ui/native-navigation/model.ts";
import { NavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { NativeNavigationTree } from "./native-navigation-tree";

function tree(selectedPaneId?: string) {
  return deriveNavigationTree({
    hostId: "",
    hostLabel: "This host",
    workspaces: [
      { workspaceId: "w1", label: "Project One" },
      { workspaceId: "w2", label: "Project Two" },
      { workspaceId: "w3", label: "Empty Project" },
    ],
    tabs: [
      { workspaceId: "w1", tabId: "t1", label: "Main" },
      { workspaceId: "w1", tabId: "t2", label: "Side" },
      { workspaceId: "w2", tabId: "t3", label: "Review" },
    ],
    agents: [
      { workspaceId: "w1", tabId: "t1", paneId: "p1", label: "First task", agent: "claude" },
      { workspaceId: "w1", tabId: "t1", paneId: "p2", label: "Second task", agent: "codex" },
    ],
    shellPanes: [
      {
        workspaceId: "w1",
        tabId: "t2",
        paneId: "p3",
        label: "scratch",
        agent: "shell",
        kind: "shell",
      },
      {
        workspaceId: "w2",
        tabId: "t3",
        paneId: "p4",
        label: "shell",
        agent: "shell",
        kind: "shell",
      },
    ],
    selectedPaneId,
  });
}

describe("NativeNavigationTree", () => {
  it("names the Host and auto-discloses the selected Pane's ancestry", async () => {
    const store = new NavigationPreferenceStore();
    render(
      <NativeNavigationTree
        tree={tree("p1")}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={store}
      />,
    );

    expect(screen.getByRole("button", { name: "This host" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "First task" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The Host is not in the ancestry: it is open until the operator closes it, and a deep link may
    // not undo a decision they made about a whole machine.
    expect(store.snapshot().disclosed).toEqual([
      spaceDisclosureId("w1"),
      tabDisclosureId("w1", "t1"),
    ]);
  });

  it("opens the Host by default and remembers a collapse as one bounded identity", async () => {
    const user = userEvent.setup();
    const store = new NavigationPreferenceStore();
    render(
      <NativeNavigationTree
        tree={tree()}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={store}
      />,
    );

    expect(screen.getByRole("button", { name: "Project One" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse This host" }));
    expect(store.snapshot().disclosed).toEqual([hostCollapseId("")]);
    expect(screen.getByRole("button", { name: "Expand This host" })).toBeInTheDocument();
  });

  it("elides a lone Tab so its Pane hangs off the Space", async () => {
    const user = userEvent.setup();
    const store = new NavigationPreferenceStore();
    render(
      <NativeNavigationTree
        tree={tree()}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={store}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand Project Two" }));
    // Nobody named that shell Pane, so its row takes the Tab's name — and the Tab itself is gone.
    expect(await screen.findByRole("button", { name: "Review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "shell" })).toBeNull();
  });

  it("discloses a Space that has children and keeps the Space route for one that has none", async () => {
    const user = userEvent.setup();
    const store = new NavigationPreferenceStore();
    const onOpenSpace = vi.fn();
    const onOpenPane = vi.fn();
    render(
      <NativeNavigationTree
        tree={tree()}
        onOpenSpace={onOpenSpace}
        onOpenPane={onOpenPane}
        preferenceStore={store}
      />,
    );

    // Its label is a disclosure control too, so the row opens rather than navigating away.
    await user.click(screen.getByRole("button", { name: "Project One" }));
    await user.click(await screen.findByRole("button", { name: "Expand Main" }));
    expect(onOpenSpace).not.toHaveBeenCalled();
    expect(onOpenPane).not.toHaveBeenCalled();
    expect(store.snapshot().disclosed).toEqual([
      spaceDisclosureId("w1"),
      tabDisclosureId("w1", "t1"),
    ]);

    // A Space with nothing under it has nothing to disclose, so it keeps its route.
    await user.click(screen.getByRole("button", { name: "Empty Project" }));
    expect(onOpenSpace).toHaveBeenCalledExactlyOnceWith("w3");

    await user.click(await screen.findByRole("button", { name: "First task" }));
    expect(onOpenPane).toHaveBeenCalledExactlyOnceWith("p1");
  });

  it("highlights the whole selected row, disclosure control included", () => {
    render(
      <NativeNavigationTree
        tree={tree()}
        selectedSpaceId="w1"
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={new NavigationPreferenceStore()}
      />,
    );

    const label = screen.getByRole("button", { name: "Project One" });
    const chevron = screen.getByRole("button", { name: "Expand Project One" });
    const row = label.parentElement;
    expect(label).toHaveAttribute("aria-current", "page");
    expect(row).toHaveClass("bg-accent");
    expect(row?.contains(chevron)).toBe(true);
  });

  it("draws one disclosure control at every depth", async () => {
    const user = userEvent.setup();
    render(
      <NativeNavigationTree
        tree={tree()}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={new NavigationPreferenceStore()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand Project One" }));
    const chevrons = [
      screen.getByRole("button", { name: "Collapse Project One" }),
      await screen.findByRole("button", { name: "Expand Main" }),
    ];
    for (const chevron of chevrons) {
      expect(chevron.className).toContain("w-5");
      expect(chevron.querySelector("svg")?.getAttribute("class")).toContain("size-3.5");
    }
  });
});
