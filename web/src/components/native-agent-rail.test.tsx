import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { agentFavoriteStore, __resetAgentFavorites } from "../../../fleet/ui/agent-favorites.ts";
import type { AgentView } from "@/lib/types";
import { NativeAgentRail } from "./native-agent-rail";

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
    lastActiveAt: paneId === "favorite" ? 1 : 2,
    ...overrides,
  };
}

function rows() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="native-agent-card"]'));
}

beforeEach(() => {
  localStorage.clear();
  __resetAgentFavorites();
});

describe("NativeAgentRail", () => {
  it("keeps the favorite-aware order and opens one native row", async () => {
    const favorite = agent("favorite");
    const newer = agent("newer");
    agentFavoriteStore.toggle(favorite);
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<NativeAgentRail agents={[favorite, newer]} onOpen={onOpen} />);

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("favorite"),
      expect.stringContaining("newer"),
    ]);

    await user.click(within(rows()[0]!).getAllByRole("button")[0]!);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(favorite);
    expect(screen.getByRole("button", { name: /remove favorite/i })).toBeInTheDocument();
  });

  it("leads each row with where the work is and follows with what it is doing", () => {
    render(
      <NativeAgentRail
        agents={[
          agent("p1", {
            tabLabel: "mukai",
            sessionName: "SSHFS support check",
            lastSeenAt: Date.now(),
          }),
        ]}
        onOpen={vi.fn()}
      />,
    );

    const row = rows()[0]!;
    const project = within(row).getByText("Project");
    const name = within(row).getByText("mukai");
    const doing = within(row).getByText("SSHFS support check");
    // Where first, what second — the order this rail reads in, and the reverse of the dashboard's.
    expect(project.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(name.compareDocumentPosition(doing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The project gives up width first; the name is the only thing telling two rows apart.
    expect(project.className).toContain("text-muted-foreground");
    expect(name.className).toContain("text-foreground");
  });

  it("names a row by its Tab when the multiplexer numbered the Pane", () => {
    // Two rows so the numbered Pane is the SECOND: its own shortcut badge then reads "2", and a
    // stray "1" in this row could only be the multiplexer's label leaking into the name.
    render(
      <NativeAgentRail
        agents={[agent("p0", { tabLabel: "first" }), agent("p1", { paneLabel: "1", tabLabel: "mukai" })]}
        onOpen={vi.fn()}
      />,
    );
    const row = rows()[1]!;
    expect(within(row).getByText("mukai")).toBeInTheDocument();
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

  it("puts the age at the row's own trailing edge, under the favourite control", () => {
    render(
      <NativeAgentRail
        agents={[agent("p1", { tabLabel: "mukai", lastSeenAt: Date.now() })]}
        onOpen={vi.fn()}
      />,
    );

    const row = rows()[0]!;
    const name = within(row).getByText("mukai");
    const age = within(row).getByText(/^(now|\d+[mhd])$/);
    // THE RESERVE FOR THE STAR IS ONE LINE'S, not the button's. Line 1 shares its row with the
    // control and clears it; line 2 runs to the row's own trailing edge, which is the corner the
    // age is specified to sit in. On the button, the same reserve pushed both lines in.
    expect(name.parentElement?.className ?? "").toContain("pr-7");
    expect(age.parentElement?.className ?? "").not.toContain("pr-7");
    expect(age.closest("button")?.className ?? "").not.toContain("pr-8");
  });
});

