import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { paneSurfaceStore } from "../../../fleet/ui/terminal/switch.ts";
import { FleetPaneSurfaceToggle } from "./fleet-pane-surface-toggle";

const segment = (container: HTMLElement, label: string) =>
  within(container).getByRole("radio", { name: label });

describe("the pane-surface switch in the rail", () => {
  beforeEach(() => {
    paneSurfaceStore.set("mirror");
  });

  it("offers two surfaces and no third", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    expect(within(container).getAllByRole("radio").map((node) => node.textContent)).toEqual([
      "Collie",
      "TTYD",
    ]);
  });

  it("starts on Collie, which is the default surface", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    expect(segment(container, "Collie")).toHaveAttribute("aria-checked", "true");
    expect(segment(container, "TTYD")).toHaveAttribute("aria-checked", "false");
  });

  it("switches to TTYD on one press, and back", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    fireEvent.click(segment(container, "TTYD"));
    expect(paneSurfaceStore.snapshot()).toBe("terminal");
    expect(segment(container, "TTYD")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(segment(container, "Collie"));
    expect(paneSurfaceStore.snapshot()).toBe("mirror");
    expect(segment(container, "Collie")).toHaveAttribute("aria-checked", "true");
  });

  it("is the same switch Settings holds, not a second one", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    // A change made anywhere else moves this control without it being re-rendered by hand.
    act(() => paneSurfaceStore.set("terminal"));
    expect(segment(container, "TTYD")).toHaveAttribute("aria-checked", "true");
  });

  it("presses the surface it is already on without churn", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    fireEvent.click(segment(container, "Collie"));
    expect(paneSurfaceStore.snapshot()).toBe("mirror");
  });

  it("names the group, so the two bare words are not the only thing announced", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    expect(within(container).getByRole("radiogroup")).toHaveAccessibleName();
  });

  it("moves one indicator while preserving labels and touch targets", () => {
    const { container } = render(<FleetPaneSurfaceToggle />);
    const group = within(container).getByRole("radiogroup");
    const indicator = group.querySelector('[aria-hidden="true"] > div')!;
    const on = segment(container, "Collie");
    const off = segment(container, "TTYD");
    expect(indicator.className).toContain("bg-primary");
    expect(indicator.className).toContain("motion-reduce:transition-none");
    expect(indicator.className).not.toContain("translate-x-full");
    for (const button of [on, off]) {
      expect(button.className).toContain("min-h-11");
      expect(button.className).toContain("font-medium");
      expect(button.className).toContain("focus-visible:outline-2");
    }
    fireEvent.click(off);
    expect(group.querySelector('[aria-hidden="true"] > div')).toBe(indicator);
    expect(indicator.className).toContain("translate-x-full");
    expect(off.className).toContain("text-primary-foreground");
    fireEvent.click(on);
    expect(indicator.className).not.toContain("translate-x-full");
  });
});
