import { describe, expect, test } from "bun:test";

import { bindingKey } from "./bindings.ts";
import { DEFAULT_COMMAND_PREFIX, isCommandId } from "./catalog.ts";
import { defaultBindings } from "./catalog.ts";

// The public documentation and the executable catalog have to agree, and prose drifts. These are the
// facts a reader would act on, checked against the code rather than proofread.

const DOC = await Bun.file(new URL("../../../docs/herdr-fleet.md", import.meta.url)).text();

/** The section this change owns, so a claim elsewhere in the document is not this test's business. */
const SECTION = DOC.slice(DOC.indexOf("## Keyboard commands"), DOC.indexOf("## Retained Collie"));

describe("the documented command system", () => {
  test("the section exists at all", () => {
    expect(SECTION.length).toBeGreaterThan(1000);
  });

  test("the documented default prefix is the shipped one", () => {
    expect(SECTION).toContain(`\`${DEFAULT_COMMAND_PREFIX}\``);
  });

  test("every command id the section names is a real one", () => {
    // Backticked, kebab-case, at least two words: the shape a command id has and a chord does not.
    const named = new Set(SECTION.match(/`[a-z]+(?:-[a-z0-9]+)+`/g) ?? []);
    const ids = [...named].map((token) => token.slice(1, -1));
    // Words like `schema-version` are not commands; only assert over the ones that claim to be.
    const claimed = ids.filter(
      (id) =>
        id.startsWith("open-") || id.startsWith("send-") || id.includes("-pane") || id.includes("-tab"),
    );
    // A floor, so a regex that quietly stopped matching cannot pass this test vacuously.
    expect(claimed.length).toBeGreaterThanOrEqual(2);
    for (const id of claimed) expect(isCommandId(id) ? id : `unknown: ${id}`).toBe(id);
  });

  test("the claim that one direct chord ships bound is true", () => {
    expect(SECTION).toContain("only direct-chord default");
    const direct = [...defaultBindings().values()]
      .flat()
      .filter((binding) => binding.kind === "direct")
      .map(bindingKey);
    expect(direct).toEqual(["direct:Ctrl+Shift+P"]);
    expect(SECTION).toContain("`Ctrl+Shift+P` opens the command bar");
  });

  test("the claim that no Alt chord is a default is true", () => {
    expect(SECTION).toContain("No `Alt` chord is a default");
    for (const bindings of defaultBindings().values()) {
      for (const binding of bindings) expect(binding.chord.alt).toBe("absent");
    }
  });

  test("the claim that a Space has no rename or close is true", () => {
    expect(SECTION).toContain("A Space has no rename or close command");
    expect(isCommandId("rename-space")).toBe(false);
    expect(isCommandId("close-space")).toBe(false);
  });

  test("the commands it lists as shipping unbound really do", () => {
    for (const id of ["last-pane", "copy-fleet-pane-link", "toggle-type-mode"]) {
      expect(SECTION).toContain(`\`${id}\``);
      expect(isCommandId(id) && defaultBindings().get(id)).toEqual([]);
    }
  });
});
