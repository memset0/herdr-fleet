import { LEGACY_PIN_BACKUP } from "../../../fleet/bindings/backup.ts";
import { beforeEach, expect, it } from "vitest";
import { __reloadPins, __resetPins, currentPins, dropPin, migrateTerminalPins, pinMatcher, setPinned } from "./pins";
import { tagPanePlace } from "./fleet-pane-tags";
import type { AgentView } from "./types";

const original: AgentView = {
  paneId: "w1:p1", workspaceId: "w1", workspaceLabel: "Example", workspaceNumber: 1,
  tabId: "w1:t1", agent: "codex", status: "idle", cwd: "/example", focused: false,
  host: "member-a", bindingId: "herdr:term_original", bindingSession: "default",
};
const moved = { ...original, paneId: "w2:p8", workspaceId: "w2", workspaceLabel: "Renamed", tabId: "w2:t9", session: "default" };
beforeEach(() => { __resetPins(); localStorage.removeItem(LEGACY_PIN_BACKUP); });

it("every native pin entrypoint follows a moved terminal across reload and session widening", () => {
  setPinned(original, true, [original], 100);
  __reloadPins();
  expect(pinMatcher(currentPins())(moved)).toBe(true);
  expect(pinMatcher(currentPins())({ ...original, bindingId: "herdr:term_new" })).toBe(false);
  expect(tagPanePlace(moved)).toEqual(tagPanePlace(original));
  dropPin(moved);
  expect(currentPins()).toEqual([]);
});

it("migrates an exact legacy pin, retaining unmatched records and refusing stale evidence", () => {
  const { bindingId: _id, bindingSession: _session, ...legacy } = original;
  setPinned(legacy, true, [legacy], 100);
  migrateTerminalPins([original], false);
  expect(pinMatcher(currentPins())(moved)).toBe(false);
  migrateTerminalPins([original], true);
  expect(localStorage.getItem(LEGACY_PIN_BACKUP)).toContain("w1:p1");
  __reloadPins();
  expect(pinMatcher(currentPins())(moved)).toBe(true);
  setPinned(moved, false, [moved]);
  expect(currentPins()).toEqual([]);
});
