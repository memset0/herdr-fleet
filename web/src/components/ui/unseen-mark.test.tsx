import { render, screen } from "@testing-library/react";

import { UnseenMark } from "./unseen-mark";

describe("UnseenMark", () => {
  it("is a 9px square with 1.5px corners in the status marks' 12px box, in full ink", () => {
    const { container } = render(<UnseenMark />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 12 12");
    expect(svg?.getAttribute("class")).toContain("size-3");
    // Full ink, never a status colour: it is a different kind of fact from a status.
    expect(svg?.getAttribute("class")).toContain("text-foreground");
    expect(svg?.getAttribute("class")).not.toMatch(/text-status-/);
    const rect = svg?.querySelector("rect");
    expect(rect?.getAttribute("width")).toBe("9");
    expect(rect?.getAttribute("height")).toBe("9");
    expect(rect?.getAttribute("rx")).toBe("1.5");
    expect(rect?.getAttribute("fill")).toBe("currentColor");
  });

  it("names itself for a screen reader when drawn", () => {
    render(<UnseenMark />);
    expect(screen.getByRole("img", { name: /unread|unseen|reply/i })).toBeInTheDocument();
  });

  it("keeps its slot invisible and silent when reserved and off, and draws nothing otherwise", () => {
    const reserved = render(<UnseenMark on={false} reserve />);
    const svg = reserved.container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("invisible");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("aria-label")).toBeNull();
    // Same box on and off, so a row's name truncates at one width: nothing shifts.
    const on = render(<UnseenMark />).container.querySelector("svg");
    expect(on?.getAttribute("class")).toContain("size-3");
    expect(svg?.getAttribute("class")).toContain("size-3");

    expect(render(<UnseenMark on={false} />).container.firstChild).toBeNull();
  });
});
