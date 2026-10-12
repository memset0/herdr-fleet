import { fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { expect, it } from "vitest";
import { FleetNavigationFooter } from "./fleet-navigation-footer";

function CurrentPath() { return <output>{useLocation().pathname}</output>; }
it("the small panel entry shares the version row below the unchanged surface switch", () => {
  const { container } = render(<MemoryRouter><FleetNavigationFooter /><CurrentPath /></MemoryRouter>);
  const entry = within(container).getByRole("button", { name: "Agent panel" });
  const versionRow = entry.parentElement!;
  expect(versionRow).toHaveTextContent("Herdr Fleet");
  const collie = within(container).getByRole("radio", { name: "Collie" });
  expect(versionRow.contains(collie)).toBe(false);
  expect(entry.querySelector("svg")).toHaveClass("size-3.5");
  fireEvent.click(entry);
  expect(within(container).getByText("/panel")).toBeInTheDocument();
});
