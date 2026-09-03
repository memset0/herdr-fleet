import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  deriveNavigationTree,
  spaceDisclosureId,
  tabDisclosureId,
} from "../../../fleet/ui/native-navigation/model.ts";
import { NavigationPreferenceStore } from "../../../fleet/ui/native-navigation/preferences.ts";
import { NativeNavigationTree } from "./native-navigation-tree";

function tree(selectedPaneId?: string) {
  return deriveNavigationTree({
    workspaces: [
      { workspaceId: "w1", label: "Project One" },
      { workspaceId: "w2", label: "Project Two" },
    ],
    tabs: [
      { workspaceId: "w1", tabId: "t1", label: "Main" },
      { workspaceId: "w2", tabId: "t2", label: "Review" },
    ],
    agents: [
      {
        workspaceId: "w1",
        tabId: "t1",
        paneId: "p1",
        label: "First task",
        agent: "claude",
      },
    ],
    shellPanes: [
      {
        workspaceId: "w2",
        tabId: "t2",
        paneId: "p2",
        label: "shell",
        agent: "shell",
        kind: "shell",
      },
    ],
    selectedPaneId,
  });
}

describe("NativeNavigationTree", () => {
  it("auto-discloses and highlights the selected Pane ancestry", async () => {
    const store = new NavigationPreferenceStore();
    render(
      <NativeNavigationTree
        tree={tree("p2")}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        preferenceStore={store}
      />,
    );

    expect(await screen.findByRole("button", { name: "shell" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(store.snapshot().disclosedSpaces).toEqual([spaceDisclosureId("w2")]);
    expect(store.snapshot().disclosedTabs).toEqual([tabDisclosureId("w2", "t2")]);
  });

  it("keeps disclosure local and activates native Space and Pane callbacks once", async () => {
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

    await user.click(screen.getByRole("button", { name: "Expand Project One" }));
    await user.click(screen.getByRole("button", { name: "Main" }));
    expect(onOpenSpace).not.toHaveBeenCalled();
    expect(onOpenPane).not.toHaveBeenCalled();
    expect(store.snapshot().disclosedSpaces).toEqual([spaceDisclosureId("w1")]);
    expect(store.snapshot().disclosedTabs).toEqual([tabDisclosureId("w1", "t1")]);

    await user.click(screen.getByRole("button", { name: "Project One" }));
    await user.click(screen.getByRole("button", { name: "First task" }));
    expect(onOpenSpace).toHaveBeenCalledExactlyOnceWith("w1");
    expect(onOpenPane).toHaveBeenCalledExactlyOnceWith("p1");
  });
});
