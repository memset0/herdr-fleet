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
import { PackProvider } from "./pack-provider";
import type { ServerSummary } from "@/lib/types";

function tree(selectedPaneId?: string) {
  return deriveNavigationTree({
    // One member, which is what a solo snapshot is; the rest of this fixture is unchanged.
    hosts: [{
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
    }],
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

    // THE HOST ROW HAS NO ARROW. Its disclosure column carries the machine itself — the tint and,
    // when it stops answering, the refusal — so the row's own label is the disclosure control and
    // the only place its state can be announced.
    expect(screen.getByRole("button", { name: "Project One" })).toBeInTheDocument();
    const host = screen.getByRole("button", { name: "This host" });
    expect(host).toHaveAttribute("aria-expanded", "true");
    await user.click(host);
    expect(store.snapshot().disclosed).toEqual([hostCollapseId("")]);
    expect(screen.getByRole("button", { name: "This host" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("draws each member as itself and says so when one is not answering", () => {
    // Every member of the roster is a row, present or not — so this list is where "which machine is
    // down" is read, and it must not be readable by colour alone (WCAG 1.4.1).
    const roster: ServerSummary[] = [
      { id: "lead", name: "lead", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 9_000 },
      { id: "down", name: "down", isLead: false, reachable: false, protocol: "ok", lastSeenAt: 1_000 },
    ];
    render(
      <PackProvider servers={roster} ts={10_000} pollMs={1500}>
        <NativeNavigationTree
          tree={deriveNavigationTree({
            hosts: roster.map((server) => ({
              hostId: server.id,
              hostLabel: server.name,
              workspaces: [{ workspaceId: "w1", label: "One" }],
              tabs: [],
              agents: [],
              shellPanes: [],
            })),
          })}
          onOpenSpace={vi.fn()}
          onOpenPane={vi.fn()}
        />
      </PackProvider>,
    );

    // The Host rows are the ones that announce their own disclosure, because the arrow that used to
    // is now the machine's glyph.
    const rows = screen
      .getAllByRole("button")
      .filter((row) => row.getAttribute("aria-expanded") !== null);
    expect(rows.map((row) => row.textContent)).toEqual([
      "lead",
      expect.stringContaining("down"),
    ]);
    // The machine that is answering says nothing; the one that is not says why, in words.
    expect(rows[0]?.textContent).not.toMatch(/unreachable/i);
    expect(rows[1]?.textContent).toMatch(/unreachable/i);
  });

  it("does not call a member unreachable while the lead is merely between sweeps", () => {
    // The lead's peer sweep relaxes to its own idle cadence while the phone polls far faster, so a
    // member answering every request has its receipt age past `3 × pollMs` and back on every sweep.
    // `reachable` stays true throughout: the lead never stopped believing in this machine.
    const roster: ServerSummary[] = [
      { id: "lead", name: "lead", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 19_000 },
      // Receipt 10s old against a 4.5s tolerance — stale, and answering every request.
      { id: "peer", name: "peer", isLead: false, reachable: true, protocol: "ok", lastSeenAt: 10_000 },
    ];
    render(
      <PackProvider servers={roster} ts={20_000} pollMs={1500}>
        <NativeNavigationTree
          tree={deriveNavigationTree({
            hosts: roster.map((server) => ({
              hostId: server.id,
              hostLabel: server.name,
              workspaces: [{ workspaceId: "w1", label: "One" }],
              tabs: [],
              agents: [],
              shellPanes: [],
            })),
          })}
          onOpenSpace={vi.fn()}
          onOpenPane={vi.fn()}
        />
      </PackProvider>,
    );

    const rows = screen
      .getAllByRole("button")
      .filter((row) => row.getAttribute("aria-expanded") !== null);
    // Neither row claims the machine is down. The word belongs to the lead's own refusal, and the
    // lead is refusing nothing here — it is simply between polls.
    for (const row of rows) expect(row.textContent).not.toMatch(/unreachable|不可达/i);
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
    expect(onOpenSpace).toHaveBeenCalledExactlyOnceWith("w3", undefined);

    await user.click(await screen.findByRole("button", { name: "First task" }));
    expect(onOpenPane).toHaveBeenCalledExactlyOnceWith("p1", undefined);
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

  it("asks for a row's own actions on a right-click, and offers none where there is nothing to act on", async () => {
    const user = userEvent.setup();
    const onRowActions = vi.fn();
    render(
      <NativeNavigationTree
        tree={tree()}
        onOpenSpace={vi.fn()}
        onOpenPane={vi.fn()}
        onRowActions={onRowActions}
        preferenceStore={new NavigationPreferenceStore()}
      />,
    );

    // A Space has no rename or close on the bridge, so its row asks for nothing.
    await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Project One" }) });
    expect(onRowActions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Expand Project One" }));
    // A Tab that survived elision acts on the Tab…
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByRole("button", { name: "Main" }),
    });
    expect(onRowActions).toHaveBeenCalledExactlyOnceWith({ kind: "tab", tabId: "t1" });

    // …and a row that stands for a Pane acts on the Pane.
    onRowActions.mockClear();
    await user.click(screen.getByRole("button", { name: "Expand Main" }));
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByRole("button", { name: "First task" }),
    });
    expect(onRowActions).toHaveBeenCalledExactlyOnceWith({ kind: "pane", paneId: "p1" });
  });
});
