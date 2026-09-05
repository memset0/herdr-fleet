import { describe, expect, test } from "bun:test";

import { bindingKey, parseBinding } from "./bindings.ts";
import {
  COMMAND_CATALOG,
  DEFAULT_COMMAND_PREFIX,
  commandById,
  defaultBindings,
  isCommandId,
} from "./catalog.ts";

describe("the command catalog", () => {
  test("every id appears exactly once", () => {
    const ids = COMMAND_CATALOG.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every command carries an English name and a scope", () => {
    for (const command of COMMAND_CATALOG) {
      expect(command.name.length).toBeGreaterThan(0);
      expect(command.name).toBe(command.name.trim());
      expect(["global", "space", "tab", "pane", "navigation"]).toContain(command.scope);
    }
  });

  test("both ordinal families expand into independent ids", () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(isCommandId(`select-tab-${n}`)).toBe(true);
      expect(isCommandId(`select-agent-${n}`)).toBe(true);
    }
    expect(isCommandId("select-tab-10")).toBe(false);
    expect(isCommandId("select-tab-0")).toBe(false);
    expect(commandById("select-tab-4").name).toBe("Select Tab 4");
  });

  test("the catalog is closed", () => {
    expect(isCommandId("open-command-bar")).toBe(true);
    expect(isCommandId("run-anything")).toBe(false);
    expect(isCommandId("")).toBe(false);
    // An inherited property name is not a command; the lookup is a Map for exactly this reason.
    expect(isCommandId("constructor")).toBe(false);
    expect(isCommandId("toString")).toBe(false);
  });

  test("every shipped default parses", () => {
    for (const command of COMMAND_CATALOG) {
      for (const text of command.defaults) {
        const result = parseBinding(text);
        expect(result.ok ? "ok" : `${text}: ${result.failure.reason}`).toBe("ok");
      }
    }
  });

  test("no two commands ship the same binding", () => {
    const seen = new Map<string, string>();
    for (const [id, bindings] of defaultBindings()) {
      for (const binding of bindings) {
        const key = bindingKey(binding);
        expect(seen.has(key) ? `${key} also on ${seen.get(key)}` : "unique").toBe("unique");
        seen.set(key, id);
      }
    }
  });

  test("Ctrl+Shift+P is the only direct-chord default", () => {
    const direct: string[] = [];
    for (const [id, bindings] of defaultBindings()) {
      for (const binding of bindings) {
        if (binding.kind === "direct") direct.push(`${id}:${bindingKey(binding)}`);
      }
    }
    expect(direct).toEqual(["open-command-bar:direct:Ctrl+Shift+P"]);
  });

  test("no default binds an Alt chord", () => {
    for (const [, bindings] of defaultBindings()) {
      for (const binding of bindings) expect(binding.chord.alt).toBe("absent");
    }
  });

  test("the commands that ship unbound stay listed and stay unbound", () => {
    const unbound = COMMAND_CATALOG.filter((command) => command.defaults.length === 0).map((c) => c.id);
    // The whole Alt family the previous product shipped, plus the sends and the two browser actions.
    expect(unbound).toContain("previous-pane");
    expect(unbound).toContain("next-pane");
    expect(unbound).toContain("previous-agent");
    expect(unbound).toContain("next-agent");
    expect(unbound).toContain("select-agent-1");
    expect(unbound).toContain("last-pane");
    expect(unbound).toContain("copy-fleet-pane-link");
    expect(unbound).toContain("toggle-type-mode");
    expect(unbound).toContain("open-pane-switcher");
    expect(unbound).toContain("send-ctrl-c");
    for (const id of unbound) expect(defaultBindings().get(id)).toEqual([]);
  });

  test("the shipped prefix is a valid direct chord", () => {
    const result = parseBinding(DEFAULT_COMMAND_PREFIX);
    expect(result.ok && result.binding.kind).toBe("direct");
  });

  test("create-tab is one command behind three aliases", () => {
    const bindings = defaultBindings().get("create-tab");
    expect(bindings?.length).toBe(3);
    expect(bindings?.every((binding) => binding.kind === "prefix")).toBe(true);
  });
});
