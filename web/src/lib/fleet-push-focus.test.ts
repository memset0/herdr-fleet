import { describe, expect, it } from "vitest";

import { paneInFront } from "./fleet-push-focus";

const ORIGIN = "https://fleet.example.com";
const pane = (path: string) => `${ORIGIN}${path}`;

describe("paneInFront", () => {
  it("withholds only for a focused window on the same pane", () => {
    expect(paneInFront([{ url: pane("/pane/w1%3Ap1"), focused: true }], pane("/pane/w1%3Ap1"))).toBe(true);
  });

  it("shows when the window on that pane is not focused, however visible it is", () => {
    expect(paneInFront([{ url: pane("/pane/w1%3Ap1"), focused: false }], pane("/pane/w1%3Ap1"))).toBe(false);
  });

  it("shows when the focused window is on another pane or page", () => {
    const target = pane("/pane/w1%3Ap1");
    expect(paneInFront([{ url: pane("/pane/w1%3Ap2"), focused: true }], target)).toBe(false);
    expect(paneInFront([{ url: pane("/"), focused: true }], target)).toBe(false);
    expect(paneInFront([{ url: pane("/pane/w1%3Ap1/history"), focused: true }], target)).toBe(false);
  });

  it("tells the same pane id on two hosts apart", () => {
    expect(paneInFront([{ url: pane("/pane/w1%3Ap1"), focused: true }], pane("/pane/w1%3Ap1?h=peer"))).toBe(false);
    expect(paneInFront([{ url: pane("/pane/w1%3Ap1?h=peer"), focused: true }], pane("/pane/w1%3Ap1?h=peer"))).toBe(true);
  });

  it("never withholds a push that opens no pane", () => {
    expect(paneInFront([{ url: pane("/"), focused: true }], pane("/"))).toBe(false);
  });

  it("ignores a window on another origin", () => {
    expect(paneInFront([{ url: "https://other.example.com/pane/w1%3Ap1", focused: true }], pane("/pane/w1%3Ap1"))).toBe(false);
  });
});
