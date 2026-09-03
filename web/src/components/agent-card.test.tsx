import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AgentCard } from "./agent-card";
import { fixtureAgents } from "@/test/handlers";
import type { AgentView } from "@/lib/types";

// The row's ANATOMY, which is the thing that keeps getting re-argued: line 1 is the pane's own title
// beside a small agent tile, line 2 is `space · tab` — the address — and line 2 exists only when it
// has something to say. Addressed through `data-slot` rather than class names: the classes are a
// layout decision and are meant to move; which line a fact lands on is the contract.
//
// The cwd is left matching the space name on purpose in most cases here: `paneParts` drops a path
// that only repeats the space (lib/pane-name.ts), so that keeps each case carrying exactly the
// fields it is about.

const agent = (over: Partial<AgentView> = {}): AgentView => ({ ...fixtureAgents[0]!, ...over });

const line1 = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="agent-row-title"]');
const line2 = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="agent-row-detail"]');

describe("AgentCard's two lines", () => {
  it("leads with the pane title and the agent tile, and puts space then tab beneath", () => {
    const { container } = render(
      <AgentCard agent={agent({ tabLabel: "review", sessionName: "rewrite the loader" })} onClick={() => {}} />,
    );

    const top = line1(container)!;
    expect(top).toHaveTextContent("rewrite the loader");
    // The tile is the agent's own mark, inline on line 1 — not a 36px column ahead of the text.
    expect(within(top).getByRole("img", { name: "claude logo" })).toBeInTheDocument();
    // The space and the tab are NOT on line 1; that is the whole change.
    expect(top).not.toHaveTextContent("webapp");
    expect(top).not.toHaveTextContent("review");

    // Space first, then the separator, then the tab — in that order, in one line.
    expect(line2(container)).toHaveTextContent(/^webapp\s*·\s*review$/);
  });

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

      const toggle = screen.getByRole("button", { name: "Favorite review auth" });
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
      expect(screen.getByRole("button", { name: "Remove favorite from review auth" })).toHaveAttribute(
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

  it("shows the space alone, with no separator, when there is no tab", () => {
    const { container } = render(
      <AgentCard agent={agent({ tabLabel: undefined, sessionName: "rewrite the loader" })} onClick={() => {}} />,
    );

    expect(line1(container)).toHaveTextContent("rewrite the loader");
    expect(line2(container)).toHaveTextContent("webapp");
    expect(line2(container)).not.toHaveTextContent("·");
  });

  it("falls back to the tab on line 1, and leaves the space alone beneath", () => {
    const { container } = render(<AgentCard agent={agent({ tabLabel: "review" })} onClick={() => {}} />);

    expect(line1(container)).toHaveTextContent("review");
    expect(line2(container)).toHaveTextContent("webapp");
    expect(line2(container)).not.toHaveTextContent("·");
  });

  it("is a ONE-line row of the space alone when there is neither a tab nor a pane title", () => {
    const { container } = render(<AgentCard agent={agent()} onClick={() => {}} />);

    expect(line1(container)).toHaveTextContent("webapp");
    expect(line2(container)).toBeNull();
  });

  // In a list already grouped under its space and tab, repeating them says nothing — so the pane's
  // own name takes line 1 and the path is all that is left for line 2. Same two shapes.
  it("leads with the pane's own name in a tab-scoped list", () => {
    const { container } = render(
      <AgentCard
        agent={agent({ tabLabel: "review", paneLabel: "logs", cwd: "/home/you/webapp/api" })}
        onClick={() => {}}
        scope="tab"
      />,
    );

    const top = line1(container)!;
    expect(top).toHaveTextContent("logs");
    expect(top).not.toHaveTextContent("webapp");
    expect(within(top).getByRole("img", { name: "claude logo" })).toBeInTheDocument();

    expect(line2(container)).toHaveTextContent("webapp/api");
    expect(line2(container)).not.toHaveTextContent("review");
  });
});
