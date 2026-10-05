import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { rosterEntryKey } from "../../../fleet/ui/pane-roster.ts";
import type { AgentView, ServerSummary } from "@/lib/types";
import { NativeAgentRail } from "./native-agent-rail";
import { CrewProvider } from "@/components/crew-provider";
import { __resetHiddenMachines, currentHiddenMachines, setMachineHidden } from "@/lib/hidden-machines";
import { __resetPins, currentPins, pinMatcher, setPinned } from "@/lib/pins";

function agent(paneId: string, overrides: Partial<AgentView> = {}): AgentView {
  return {
    paneId,
    workspaceId: "w1",
    workspaceLabel: "Project",
    workspaceNumber: 1,
    tabId: "t1",
    tabLabel: paneId,
    agent: "claude",
    status: "working",
    cwd: "/repo",
    focused: false,
    lastActiveAt: 2,
    ...overrides,
  };
}

function rows() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="native-agent-card"]'));
}

const PACK: ServerSummary[] = [
  { id: "lead", name: "north", isLead: true, reachable: true, protocol: "ok", lastSeenAt: 2 },
  { id: "peer-a", name: "attic", isLead: false, reachable: true, protocol: "ok", lastSeenAt: 2 },
];

beforeEach(() => {
  localStorage.clear();
  __resetHiddenMachines();
  __resetPins();
});

describe("NativeAgentRail", () => {
  it("leads with a Pinned group, opens one native row, and lists a pinned pane once", async () => {
    const pinned = agent("pinned", { lastActiveAt: 1 });
    const newer = agent("newer");
    setPinned(pinned, true, [pinned, newer]);
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<NativeAgentRail agents={[pinned, newer]} onOpen={onOpen} />);

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("pinned"),
      expect.stringContaining("newer"),
    ]);
    // Pinned in Collie's muted caption with no count; the bucket still counts every pane of it.
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Pinned", "Working(2)"]);

    await user.click(within(rows()[0]!).getAllByRole("button")[0]!);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(pinned);
    expect(screen.getByRole("button", { name: "Unpin pinned" })).toHaveAttribute("aria-pressed", "true");
  });

  it("pins and unpins from the star through Collie's store, and focus follows the star", async () => {
    const a = agent("alpha");
    const b = agent("beta", { lastActiveAt: 1 });
    const user = userEvent.setup();
    render(<NativeAgentRail agents={[a, b]} onOpen={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pin beta to top" }));
    expect(pinMatcher(currentPins())(b)).toBe(true);
    expect(rows()[0]!.textContent).toContain("beta");
    const unpin = screen.getByRole("button", { name: "Unpin beta" });
    await waitFor(() => expect(unpin).toHaveFocus());

    await user.click(unpin);
    expect(currentPins()).toHaveLength(0);
    const pin = screen.getByRole("button", { name: "Pin beta to top" });
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("leads each row with where the work is and follows with what it is doing", () => {
    render(
      <NativeAgentRail
        agents={[agent("p1", { tabLabel: "workshop", sessionName: "SSHFS support check", lastSeenAt: Date.now() })]}
        onOpen={vi.fn()}
      />,
    );

    const row = rows()[0]!;
    const project = within(row).getByText("Project");
    const name = within(row).getByText("workshop");
    const doing = within(row).getByText("SSHFS support check");
    // Where first, what second — the order this rail reads in, and the reverse of the dashboard's.
    expect(project.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(name.compareDocumentPosition(doing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The phrase keeps its distinct Space and work-name styling.
    expect(project.className).toContain("text-muted-foreground");
    expect(name.className).toContain("text-foreground");
    // Compact rail type keeps the name weighted and the detail smaller.
    expect(name.className).toContain("font-medium");
    expect(doing.closest('[data-slot="native-agent-row-detail"]')?.className).toContain("text-[11px]");
  });

  it("truncates Space and work name together with one trailing ellipsis", () => {
    const space = "A long workspace name without a separate width cap";
    const work = "A long work name";
    render(<NativeAgentRail agents={[agent("p1", { workspaceLabel: space, tabLabel: work })]} onOpen={vi.fn()} />);
    const row = rows()[0]!;
    const heading = row.querySelector('[data-slot="native-agent-heading"]')!;
    expect(heading.textContent).toBe(`${space} · ${work}`);
    expect(heading.className).toContain("truncate");
    expect(heading.className).toContain("flex-1");
    expect(heading.querySelectorAll(".truncate")).toHaveLength(0);
    expect(within(row).getByText(space).className).not.toContain("max-w");
    expect(heading.contains(row.querySelector('[data-glide="tile"]'))).toBe(false);
    expect(heading.contains(row.querySelector('[data-slot="agent-pin"]'))).toBe(false);
  });

  it("names a row by its Tab when the multiplexer numbered the Pane", () => {
    // Two rows so the numbered Pane is the SECOND: its own shortcut badge then reads "2", and a
    // stray "1" in this row could only be the multiplexer's label leaking into the name.
    render(
      <NativeAgentRail
        agents={[agent("p0", { tabLabel: "first" }), agent("p1", { paneLabel: "1", tabLabel: "workshop" })]}
        onOpen={vi.fn()}
      />,
    );
    const row = rows()[1]!;
    expect(within(row).getByText("workshop")).toBeInTheDocument();
    expect(within(row).queryByText("1")).toBeNull();
  });

  it("badges a shortcut ordinal across the whole rail and stops where a key cannot reach", () => {
    const many = Array.from({ length: 11 }, (_, index) => agent(`p${index}`, { tabLabel: `t${index}` }));
    render(<NativeAgentRail agents={many} onOpen={vi.fn()} />);
    const badges = rows().map((row) => within(row).queryByText(/^\d+$/)?.textContent ?? null);
    expect(badges.slice(0, 9)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(badges.slice(9)).toEqual([null, null]);
  });

  it("says the herd is unknown rather than empty on a stale render", () => {
    render(<NativeAgentRail agents={[]} error onOpen={vi.fn()} />);
    expect(screen.queryByText(/no agents running/i)).toBeNull();
    render(<NativeAgentRail agents={[]} bridge="connected" onOpen={vi.fn()} />);
    expect(screen.getByText(/no agents running/i)).toBeInTheDocument();
  });

  it("keeps the card for the section that needs a person and flattens the rest", () => {
    const blocked = agent("blocked", { status: "blocked" });
    // `done` with nothing seen since is Ready·unseen; `idle` with a later stamp is Recent.
    const unseen = agent("ready", { tabLabel: "Ready work", status: "done", lastActiveAt: 200, lastSeenAt: 100 });
    const recent = agent("recent", { status: "idle", lastActiveAt: 100, lastSeenAt: 200 });
    render(<NativeAgentRail agents={[blocked, unseen, recent]} onOpen={vi.fn()} />);

    const [first, second, third] = rows();
    // Only the alert section is a card; unseen replies keep their native status and grouping.
    expect(first?.querySelector("[data-slot='card']")).not.toBeNull();
    expect(first?.closest("[data-slot='list-group']")).toBeNull();
    for (const flat of [second, third]) {
      expect(flat?.querySelector("[data-slot='card']")).toBeNull();
      // …and a run of flat rows is ONE bordered group, never an open-ended stack of hairlines.
      expect(flat?.closest("[data-slot='list-group']")).not.toBeNull();
    }
    expect(within(second!).queryByRole("img", { name: /unseen/i })).toBeNull();
    expect(second?.querySelector('[data-glide="dot"]')).not.toBeNull();
    expect(within(second!).getAllByRole("button")[0]).toHaveAccessibleName(/unseen/i);
    expect(within(third!).queryByRole("img", { name: /unseen/i })).toBeNull();
  });

  it("draws roomier compact rows with native marks and coarse pointer targets", () => {
    render(<NativeAgentRail agents={[agent("p1"), agent("p2", { status: "blocked" })]} onOpen={vi.fn()} />);
    for (const row of rows()) {
      const shell = row.querySelector('[data-slot="native-agent-body"]')!;
      expect(shell.className).toMatch(/\bmin-h-16\b/u);
      expect(shell.className).toMatch(/\bpy-2\b/u);
      expect(row.querySelector('[data-glide="dot"]')).not.toBeNull();
      expect(row.querySelector('[data-glide="tile"]')?.getAttribute("class")).toContain("size-3.5");
      expect(row.querySelector('[data-glide="name"]')).not.toBeNull();
      expect(row.querySelector('[data-slot="native-agent-row-title"]')?.className).toContain("text-xs");
      expect(row.querySelector('[data-slot="native-agent-row-detail"]')?.className).toContain("text-[11px]");
      expect(shell.className).toContain("pointer-coarse:min-h-24");
      expect(shell.className).toContain("px-3");
      expect(row.querySelector('[data-slot="native-agent-row-title"]')?.parentElement?.className).toContain("gap-1.5");
    }
  });

  it("omits cold, warm and expiry readings from the rail", () => {
    const cache = { state: "warm" as const, expiresAt: Date.now() + 60_000, ttlSeconds: 60, ruleId: "default", confidence: "observed" as const };
    render(<NativeAgentRail agents={[agent("warm", { cache }), agent("cold", { cache: { ...cache, state: "cold" } })]} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-slot="cache-chip"]')).toBeNull();
  });

  it("marks the pane on screen, and only that one", () => {
    const here = agent("here");
    render(<NativeAgentRail agents={[here, agent("there")]} currentKey={rosterEntryKey(here)} onOpen={vi.fn()} />);
    const current = document.querySelectorAll<HTMLElement>('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain("here");
    expect(current[0]!.closest('[data-agent-surface]')?.className).toContain("bg-accent");
  });

  it("says what the dashboard says above the groups", () => {
    const unseen = agent("unseen", { status: "done", lastActiveAt: 200, lastSeenAt: 100 });
    const first = render(<NativeAgentRail agents={[unseen, agent("w")]} onOpen={vi.fn()} />);
    // One unseen reply is not "nothing needs you" on the dashboard, so it is not that here either.
    expect(screen.queryByText("Nothing needs you")).toBeNull();
    expect(screen.getByText("1 unseen")).toBeInTheDocument();
    first.unmount();
    render(<NativeAgentRail agents={[agent("w")]} onOpen={vi.fn()} />);
    expect(screen.getByText("Nothing needs you")).toBeInTheDocument();
  });

  it("ends line 2 with the age before a fixed compact action column", () => {
    render(<NativeAgentRail agents={[agent("p1", { tabLabel: "workshop", lastSeenAt: Date.now() })]} onOpen={vi.fn()} />);

    const row = rows()[0]!;
    const age = within(row).getByText(/^(now|\d+[mhd])$/);
    // One column reserves 40px, with a larger reserve for coarse pointers.
    expect(row.querySelector('[data-slot="native-agent-body"]')!.className).toMatch(/\bpr-10\b/u);
    expect(age.parentElement?.getAttribute("data-slot")).toBe("native-agent-row-detail");
    const star = within(row).getByRole("button", { name: /pin/i });
    expect(star.className).toMatch(/\bsize-7\b/u);
    expect(star.className).toContain("rounded-full");
    expect(star.className).toContain("pointer-coarse:size-11");
    expect(star.parentElement?.getAttribute("data-slot")).toBe("native-agent-actions");
    expect(star.parentElement?.className).toContain("flex-col");
    expect(star.parentElement?.className).toContain("right-1 top-1");
    expect(star.querySelector("svg")?.getAttribute("class")).toContain("size-3.5");
    // Full muted ink at rest: the half-strength ink it had failed 3:1 on the chrome ground.
    expect(star.className).toMatch(/(^|\s)text-muted-foreground(\s|$)/u);
    expect(star.className).not.toMatch(/text-muted-foreground\/\d+/u);
  });

  test("a row names the member it came from, and a solo rail names none", () => {
    const here = agent("here", { host: "lead" });
    const there = agent("there", { host: "peer-a" });

    const pack = render(
      <CrewProvider servers={PACK} sessions={[]}>
        <NativeAgentRail agents={[here, there]} onOpen={() => undefined} />
      </CrewProvider>,
    );
    // Collie's own pane meta, not a second vocabulary: one marker per row, naming that row's machine.
    expect(screen.getAllByText("north")).not.toHaveLength(0);
    expect(screen.getAllByText("attic")).not.toHaveLength(0);
    pack.unmount();

    // The same rows with no roster are a solo install, and a solo install has no host to name.
    render(<NativeAgentRail agents={[here, there]} onOpen={() => undefined} />);
    expect(screen.queryByText("north")).toBeNull();
    expect(screen.queryByText("attic")).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  test("a machine hidden on the dashboard changes nothing in the rail, and a pin leads it", () => {
    const here = agent("here", { host: "lead" });
    const there = agent("there", { host: "peer-a", lastActiveAt: 1 });
    const draw = () =>
      render(
        <CrewProvider servers={PACK} sessions={[]}>
          <NativeAgentRail agents={[here, there]} servers={PACK} onOpen={() => undefined} />
        </CrewProvider>,
      );
    const before = draw();
    const order = rows().map((row) => row.textContent);
    before.unmount();

    // The dashboard's machine filter is a view of that screen; the rails are the fleet's map.
    setMachineHidden("peer-a", true, PACK);
    expect(currentHiddenMachines()).toEqual(["peer-a"]);
    const hidden = draw();
    expect(rows().map((row) => row.textContent)).toEqual(order);
    expect(screen.getAllByText("attic")).not.toHaveLength(0);
    hidden.unmount();

    // A pin is the operator's own "this one matters", and the rail honours it: Pinned leads.
    setPinned(there, true, [here, there]);
    draw();
    expect(rows().map((row) => row.textContent?.replace(/^\d/u, ""))).toEqual(
      [order[1], order[0]].map((text) => text?.replace(/^\d/u, "")),
    );
  });
});

describe("mark all seen", () => {
  const unseenHere = () => agent("here", { status: "done", lastActiveAt: 200, lastSeenAt: 100 });
  const unseenThere = () => agent("there", { status: "idle", lastActiveAt: 300, lastSeenAt: 100, host: "peer-a" });
  const seen = () => agent("seen", { status: "done", lastActiveAt: 100, lastSeenAt: 200 });
  const control = () => screen.queryByRole("button", { name: /mark \d+ unseen panes? seen/i });

  function renderRail(agents: AgentView[], onMarkAllSeen?: (panes: AgentView[]) => Promise<void>) {
    return render(
      <CrewProvider servers={PACK} sessions={[]}>
        <NativeAgentRail agents={agents} servers={PACK} onOpen={vi.fn()} onMarkAllSeen={onMarkAllSeen} />
      </CrewProvider>,
    );
  }

  it("offers the control beside the summary line with the unseen count across every host", () => {
    renderRail([unseenHere(), unseenThere(), seen(), agent("busy")], vi.fn(async () => {}));
    const button = control()!;
    expect(button).toHaveAccessibleName("Mark 2 unseen panes seen");
    expect(button).toHaveTextContent(/Mark all seen\s*2/u);
    // The summary line still stands first in the same row, ahead of the control, above every row.
    const row = button.parentElement!;
    expect(row.firstElementChild).toHaveTextContent(/unseen/i);
    expect(row.contains(rows()[0]!)).toBe(false);
  });

  it("names a single pane in the singular", () => {
    renderRail([unseenHere(), seen()], vi.fn(async () => {}));
    expect(control()).toHaveAccessibleName("Mark 1 unseen pane seen");
  });

  it("is not drawn when nothing is unseen, or when no one can mark", () => {
    renderRail([seen(), agent("busy")], vi.fn(async () => {}));
    expect(control()).toBeNull();
    cleanup();
    renderRail([unseenHere()]);
    expect(control()).toBeNull();
  });

  it("hands over exactly the unseen panes and stays disabled until the caller settles", async () => {
    let settle!: () => void;
    const onMarkAllSeen = vi.fn((_panes: AgentView[]) => new Promise<void>((resolve) => (settle = resolve)));
    renderRail([unseenHere(), unseenThere(), seen()], onMarkAllSeen);
    const button = control()!;
    await userEvent.click(button);
    expect(onMarkAllSeen).toHaveBeenCalledTimes(1);
    expect(onMarkAllSeen.mock.calls[0]![0].map((a: AgentView) => a.paneId)).toEqual(["here", "there"]);
    expect(button).toBeDisabled();
    // A second tap while in flight sends nothing more.
    await userEvent.click(button);
    expect(onMarkAllSeen).toHaveBeenCalledTimes(1);
    settle();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("is reached and pressed from the keyboard", async () => {
    const onMarkAllSeen = vi.fn(async () => {});
    renderRail([unseenHere()], onMarkAllSeen);
    control()!.focus();
    expect(control()).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onMarkAllSeen).toHaveBeenCalledTimes(1);
  });

  it("goes when the snapshot reports the panes seen, and comes back when one goes unseen again", () => {
    const onMarkAllSeen = vi.fn(async () => {});
    const view = renderRail([unseenHere(), unseenThere()], onMarkAllSeen);
    expect(control()).toHaveAccessibleName("Mark 2 unseen panes seen");
    const markedHere = agent("here", { status: "done", lastActiveAt: 200, lastSeenAt: 250 });
    const markedThere = agent("there", { status: "idle", lastActiveAt: 300, lastSeenAt: 350, host: "peer-a" });
    view.rerender(
      <CrewProvider servers={PACK} sessions={[]}>
        <NativeAgentRail agents={[markedHere, markedThere]} servers={PACK} onOpen={vi.fn()} onMarkAllSeen={onMarkAllSeen} />
      </CrewProvider>,
    );
    expect(control()).toBeNull();
    expect(screen.queryByRole("img", { name: /unseen/i })).toBeNull();
    const finishedAgain = agent("here", { status: "done", lastActiveAt: 400, lastSeenAt: 250 });
    view.rerender(
      <CrewProvider servers={PACK} sessions={[]}>
        <NativeAgentRail agents={[finishedAgain, markedThere]} servers={PACK} onOpen={vi.fn()} onMarkAllSeen={onMarkAllSeen} />
      </CrewProvider>,
    );
    expect(control()).toHaveAccessibleName("Mark 1 unseen pane seen");
  });
});
