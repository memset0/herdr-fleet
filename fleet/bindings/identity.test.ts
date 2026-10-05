import { herdrBindingId } from "./herdr.ts";
import { expect, test } from "bun:test";
import { attachRelation, detachRelation, relationsFor, resolveTerminalReference, terminalReference } from "./identity.ts";
import { bindingPlace, migratePlaces } from "./place.ts";

const original = { host: "member-a", session: "primary", paneId: "w1:p1", bindingId: "herdr:term_original" };
const ref = terminalReference(original)!;

test("a durable reference resolves after a move, reorder or rename, never by the old address", () => {
  const moved = { ...original, paneId: "w2:p7", workspaceLabel: "renamed", tabId: "t9", position: 4 };
  const replacement = { ...original, bindingId: "herdr:term_replacement" };
  expect(resolveTerminalReference(ref, [replacement, moved], true)).toEqual({ status: "resolved", pane: moved });
  expect(resolveTerminalReference(ref, [replacement], true)).toEqual({ status: "unavailable" });
  expect(resolveTerminalReference(ref, [moved], false)).toEqual({ status: "unavailable" });
  expect(resolveTerminalReference(ref, [moved, moved], true)).toEqual({ status: "ambiguous" });
});

test("host and multiplexer session qualify terminal identities", () => {
  expect(resolveTerminalReference(ref, [{ ...original, host: "member-b" }, { ...original, session: "other" }], true).status).toBe("unavailable");
  expect(terminalReference({ paneId: "w1:p1" })).toBeNull();
  expect(terminalReference({ ...original, bindingId: "../invalid" })).toBeNull();
  expect(herdrBindingId("term_abc123")).toMatch(/^terminal_[A-Za-z0-9_-]{43}$/);
  expect(herdrBindingId("term_abc123")).not.toContain("term_abc123");
  expect(herdrBindingId("w1:p1")).toBeUndefined();
});

test("association operations are idempotent, namespaced and many-to-many", () => {
  const tag = { terminal: ref, kind: "tag", resource: "one" };
  const task = { terminal: ref, kind: "todoist", resource: "one" };
  const both = attachRelation(attachRelation([], tag), task);
  expect(attachRelation(both, task)).toBe(both);
  expect(relationsFor(both, ref, "todoist")).toEqual([task]);
  expect(detachRelation(both, tag)).toEqual([task]);
});

test("migration requires unique fresh evidence and preserves unresolved payloads", () => {
  const legacy = { row: "member-a\u0000primary\u0000w1:p1", space: "project" };
  const current = bindingPlace(original, legacy);
  const record = { ...legacy, payload: ["tag-one"] };
  const evidence = [{ legacy, current }];
  expect(migratePlaces([record], evidence, true)).toEqual([{ ...current, payload: ["tag-one"] }]);
  for (const observations of [[], [...evidence, ...evidence]]) {
    expect(migratePlaces([record], observations, true)).toEqual([record]);
  }
  expect(migratePlaces([record], evidence, false)).toEqual([record]);
  expect(bindingPlace({ ...original, paneId: "w9:p3" }, { row: "different", space: "renamed" })).toEqual(current);
});
