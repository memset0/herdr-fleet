import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { FleetCjkFallbackControl, FleetWebfonts } from "./fleet-webfonts";
import { fleetCjkFallback, fleetUiCjkFallback } from "../../../fleet/ui/webfonts";

beforeEach(() => {
  fleetUiCjkFallback.set("none"); fleetUiCjkFallback.setOnly(false);
  fleetCjkFallback.set("none"); fleetCjkFallback.setOnly(false);
  document.documentElement.style.cssText = "";
  document.documentElement.className = "";
});
it("offers English-only role choices and independently applies None, fallback and exclusive modes", async () => {
  const user = userEvent.setup();
  render(<><FleetWebfonts /><FleetCjkFallbackControl /></>);
  const ui = screen.getByLabelText("UI fallback");
  const terminal = screen.getByLabelText("Terminal fallback");
  expect(ui).toHaveValue("none"); expect(terminal).toHaveValue("none");
  expect(ui.textContent).toContain("Source Han Sans"); expect(ui.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  expect(terminal.textContent).not.toContain("Source Han Sans");
  const uiOnly = screen.getByRole("switch", { name: "UI fallback: Use only CJK font" });
  const terminalOnly = screen.getByRole("switch", { name: "Terminal fallback: Use only CJK font" });
  expect(uiOnly).toBeDisabled();
  await user.selectOptions(ui, "lxgw-wenkai");
  expect(document.documentElement.style.getPropertyValue("--font-ui-cjk")).toBe('"LXGW WenKai"');
  expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe("");
  await user.click(uiOnly);
  expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain('"LXGW WenKai"');
  expect(document.documentElement.style.getPropertyValue("--font-sans")).not.toContain("Aldrich");
  await user.selectOptions(terminal, "maple-mono-cn");
  expect(document.documentElement.style.getPropertyValue("--font-cjk")).toBe('"Maple Mono NF CN"');
  await user.click(terminalOnly);
  expect(document.documentElement.style.getPropertyValue("--fleet-terminal-font")).toContain("Nerd Font Symbols");
  expect(document.documentElement.style.getPropertyValue("--fleet-terminal-font")).not.toContain("JetBrains");
  await user.selectOptions(ui, "none");
  expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe("");
  expect(document.documentElement.style.getPropertyValue("--fleet-terminal-font")).toContain("Maple Mono NF CN");
  await user.selectOptions(terminal, "none");
  expect(document.documentElement.style.getPropertyValue("--fleet-terminal-font")).toBe("");
});
it("keeps flat Fleet settings below native grouped navigation", () => {
  const source = readFileSync(resolve(__dirname, "../routes/settings.tsx"), "utf8");
  expect(source.indexOf("<FleetSettingsSection />")).toBeGreaterThan(source.indexOf("{ROWS.map"));
  expect(source.indexOf("<FleetSettingsSection />")).toBeLessThan(source.indexOf("<BuildStamp />"));
});
