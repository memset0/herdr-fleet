// The star on Collie's own Agent row is this device's pin (FORK.toml native-agent-favorites-port):
// its own button beside the row, never inside it, and absent from a shell row.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AgentCard } from "./agent-card";
import { fixtureAgents } from "@/test/handlers";
import type { AgentView } from "@/lib/types";

const agent = (over: Partial<AgentView> = {}): AgentView => ({ ...fixtureAgents[0]!, ...over });

describe("AgentCard favorite control", () => {
  it("keeps favorite activation independent from row navigation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onFavoriteToggle = vi.fn();
    const { container, rerender } = render(
      <AgentCard
        agent={agent({ sessionName: "review auth" })}
        onClick={onClick}
        favorite={false}
        onFavoriteToggle={onFavoriteToggle}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Pin review auth to top" });
    expect(container.querySelector("button button")).toBeNull();
    expect(toggle.className).toContain("right-1.5");
    expect(toggle.className).toContain("top-1.5");
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("pr-12");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(onFavoriteToggle).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    expect(toggle).toHaveFocus();

    rerender(
      <AgentCard
        agent={agent({ sessionName: "review auth" })}
        onClick={onClick}
        favorite
        onFavoriteToggle={onFavoriteToggle}
        density="row"
      />,
    );
    expect(container.querySelector('[data-slot="agent-row"] > div')).toHaveClass("pr-12");
    expect(screen.getByRole("button", { name: "Unpin review auth" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps shell rows unchanged and without a favorite control", () => {
    const { container } = render(
      <AgentCard
        agent={agent({ kind: "shell" })}
        onClick={() => {}}
        favorite
        onFavoriteToggle={() => {}}
      />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-slot", "agent-row");
    expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
  });
});
