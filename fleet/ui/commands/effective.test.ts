import { describe, expect, test } from "bun:test";

import { parseBinding, type Binding } from "./bindings.ts";
import { isCommandId, type CommandId } from "./catalog.ts";
import { findModifierConflict } from "./effective.ts";

describe("a modifier cannot be both a key and a qualifier", () => {
  const bound = (entries: Record<string, string[]>) => {
    const map = new Map<CommandId, readonly Binding[]>();
    for (const [id, texts] of Object.entries(entries)) {
      if (!isCommandId(id)) throw new Error(`bad fixture ${id}`);
      map.set(
        id,
        texts.map((text) => {
          const parsed = parseBinding(text);
          if (!parsed.ok) throw new Error(`bad fixture ${text}`);
          return parsed.binding;
        }),
      );
    }
    return map;
  };
  const chord = (text: string) => {
    const parsed = parseBinding(text);
    if (!parsed.ok) throw new Error(`bad fixture ${text}`);
    return parsed.binding.chord;
  };

  test("claiming one side refuses that side and the unsided form, and leaves the other alone", () => {
    // The whole reason the rule exists: pressing the right Alt to reach `RAlt+Q` fires the bare
    // binding before the Q ever arrives, and no ordering rescues it.
    expect(
      findModifierConflict(bound({ "toggle-mic-recording": ["RAlt"], "fit-pane-width": ["RAlt+Q"] }), null),
    ).not.toBeNull();
    // `Alt+Q` means either Alt, and either includes the right one.
    expect(
      findModifierConflict(bound({ "toggle-mic-recording": ["RAlt"], "fit-pane-width": ["Alt+Q"] }), null),
    ).not.toBeNull();
    // The left Alt was never claimed, so it is still an ordinary modifier.
    expect(
      findModifierConflict(bound({ "toggle-mic-recording": ["RAlt"], "fit-pane-width": ["LAlt+Q"] }), null),
    ).toBeNull();
  });

  test("claiming both sides, or the family, takes the modifier out of circulation entirely", () => {
    expect(
      findModifierConflict(
        bound({ "start-mic-recording": ["LAlt"], "stop-mic-recording": ["RAlt"], "fit-pane-width": ["LAlt+Q"] }),
        null,
      ),
    ).not.toBeNull();
    expect(
      findModifierConflict(bound({ "toggle-mic-recording": ["Alt"], "fit-pane-width": ["LAlt+Q"] }), null),
    ).not.toBeNull();
  });

  test("the prefix is a chord like any other, on both sides of the rule", () => {
    // Claiming LCtrl while running the default Ctrl+B prefix breaks the prefix, and the operator is
    // told that rather than losing every sequential binding to silence.
    const claimed = findModifierConflict(bound({ "toggle-mic-recording": ["LCtrl"] }), chord("Ctrl+B"));
    expect(claimed).not.toBeNull();
    expect(claimed?.qualifierOf.kind).toBe("prefix");
    // And a prefix that IS a bare modifier claims it for everything else.
    const byPrefix = findModifierConflict(bound({ "fit-pane-width": ["Alt+Q"] }), chord("RAlt"));
    expect(byPrefix?.claimedBy.kind).toBe("prefix");
  });

  test("a document with no bare modifier at all is never in conflict", () => {
    expect(findModifierConflict(bound({ "fit-pane-width": ["Alt+Q", "LCtrl+Shift+P"] }), chord("Ctrl+B"))).toBeNull();
  });

  test("a bare modifier does not conflict with itself", () => {
    expect(findModifierConflict(bound({ "toggle-mic-recording": ["RAlt"] }), null)).toBeNull();
  });
});
