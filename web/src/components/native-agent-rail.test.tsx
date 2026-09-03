import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { agentFavoriteStore, __resetAgentFavorites } from "../../../fleet/ui/agent-favorites.ts";
import type { AgentView } from "@/lib/types";
import { NativeAgentRail } from "./native-agent-rail";

function agent(paneId: string): AgentView {
  return {
    paneId,
    workspaceId: "w1",
    workspaceLabel: paneId,
    workspaceNumber: 1,
    tabId: "t1",
    agent: "claude",
    status: "working",
    cwd: "/repo",
    focused: false,
    lastActiveAt: paneId === "favorite" ? 1 : 2,
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetAgentFavorites();
});

describe("NativeAgentRail", () => {
  it("renders the shared favorite-aware AgentList and opens one native row", async () => {
    const favorite = agent("favorite");
    const newer = agent("newer");
    agentFavoriteStore.toggle(favorite);
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<NativeAgentRail agents={[favorite, newer]} onOpen={onOpen} />);

    const rows = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-slot="agent-row"]'),
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("favorite"),
      expect.stringContaining("newer"),
    ]);

    await user.click(rows[0]!);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(favorite);
    expect(screen.getByRole("button", { name: /remove favorite/i })).toBeInTheDocument();
  });
});
