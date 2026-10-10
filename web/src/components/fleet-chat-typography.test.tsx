import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { DisplayPrefsContent } from "./display-prefs";
import { FleetChatSpacingControls, FleetChatTypographyProvider, useFleetChatTypography, CHAT_SPACING_KEY } from "./fleet-chat-typography";

function Probe() {
  const prefs = useFleetChatTypography();
  return <div data-testid="scope" style={prefs?.style}><FleetChatSpacingControls /></div>;
}
beforeEach(() => localStorage.removeItem(CHAT_SPACING_KEY));
it("tightens, persists and resets Chat letter spacing", async () => {
  const user = userEvent.setup();
  const view = render(<FleetChatTypographyProvider><Probe /></FleetChatTypographyProvider>);
  await user.click(screen.getByRole("button", { name: "Tighten Chat letter spacing" }));
  expect(view.getByTestId("scope").style.getPropertyValue("--fleet-chat-letter-spacing")).toBe("-0.01em");
  expect(localStorage.getItem(CHAT_SPACING_KEY)).toBe("-0.01");
  view.unmount();
  const reopened = render(<FleetChatTypographyProvider><Probe /></FleetChatTypographyProvider>);
  expect(reopened.getByTestId("scope").style.getPropertyValue("--fleet-chat-letter-spacing")).toBe("-0.01em");
  await user.click(screen.getByRole("button", { name: "Reset Chat letter spacing" }));
  expect(reopened.getByTestId("scope").style.getPropertyValue("--fleet-chat-letter-spacing")).toBe("normal");
});
it("bounds persisted numeric values and follows storage updates safely", () => {
  localStorage.setItem(CHAT_SPACING_KEY, "-5");
  const view = render(<FleetChatTypographyProvider><Probe /></FleetChatTypographyProvider>);
  expect(screen.getByRole("button", { name: "Tighten Chat letter spacing" })).toBeDisabled();
  expect(view.getByTestId("scope").style.getPropertyValue("--fleet-chat-letter-spacing")).toBe("-0.08em");
  act(() => { localStorage.setItem(CHAT_SPACING_KEY, "50"); window.dispatchEvent(new StorageEvent("storage", { key: CHAT_SPACING_KEY })); });
  expect(screen.getByRole("button", { name: "Widen Chat letter spacing" })).toBeDisabled();
  act(() => { localStorage.setItem(CHAT_SPACING_KEY, "invalid"); window.dispatchEvent(new StorageEvent("storage", { key: CHAT_SPACING_KEY })); });
  expect(view.getByTestId("scope").style.getPropertyValue("--fleet-chat-letter-spacing")).toBe("normal");
});
it("keeps bare Collie free of Fleet controls", () => {
  render(<FleetChatSpacingControls />);
  expect(screen.queryByRole("button", { name: "Tighten Chat letter spacing" })).toBeNull();
});

it("offers spacing below native Chat size and omits it for a terminal body", async () => {
  const stepChatFontSize = vi.fn();
  const display = (showing: "chat" | "terminal") => <FleetChatTypographyProvider><DisplayPrefsContent
    prefs={{ wrap: true, fontSize: 10, draftFontSize: 14, chatFontSize: 14, fontFamily: "system", rawTerminal: false, tapToFocus: true, expandClippedReply: true }}
    setWrap={vi.fn()} stepFontSize={vi.fn()} setRawTerminal={vi.fn()} setTapToFocus={vi.fn()} mirrorNative={false} setMirrorNative={vi.fn()} setExpandClippedReply={vi.fn()}
    paneView={{ chosen: "chat", showing, onChange: vi.fn(), showToolCalls: false, setShowToolCalls: vi.fn(), showCompactions: false, setShowCompactions: vi.fn(), chatFontSize: 14, stepChatFontSize }}
  /></FleetChatTypographyProvider>;
  const view = render(display("chat"));
  expect(screen.getByRole("button", { name: "Tighten Chat letter spacing" })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Decrease font size" }));
  expect(stepChatFontSize).toHaveBeenCalledWith(-1);
  view.rerender(display("terminal"));
  expect(screen.queryByRole("button", { name: "Tighten Chat letter spacing" })).toBeNull();
});
