import { describe, expect, it, vi } from "vitest";

import {
  createComposerFleetShortcutHandlers,
  FLEET_FIXED_KEY_ACTIONS,
} from "./pane-controls";

describe("Fleet Pane controls", () => {
  it("maps every fixed send to one exact Keys array and reuses the Type lifecycle", async () => {
    expect(FLEET_FIXED_KEY_ACTIONS).toEqual({
      "send-escape": ["Escape"],
      "send-enter": ["Enter"],
      "send-up-arrow": ["Up"],
      "send-down-arrow": ["Down"],
      "send-left-arrow": ["Left"],
      "send-right-arrow": ["Right"],
      "send-space": ["Space"],
      "send-ctrl-c": ["ctrl+c"],
    });
    const direct = { active: false, activate: vi.fn(), deactivate: vi.fn() };
    const pressKeys = vi.fn(async () => true);
    const handlers = createComposerFleetShortcutHandlers({
      direct,
      locked: () => false,
      hasDraft: () => false,
      pressKeys,
    });

    for (const [action, keys] of Object.entries(FLEET_FIXED_KEY_ACTIONS)) {
      await handlers.get(action as keyof typeof FLEET_FIXED_KEY_ACTIONS)?.();
      expect(pressKeys).toHaveBeenLastCalledWith(keys);
    }
    expect(pressKeys).toHaveBeenCalledTimes(Object.keys(FLEET_FIXED_KEY_ACTIONS).length);
    handlers.get("toggle-type-mode")?.();
    expect(direct.activate).toHaveBeenCalledOnce();
    direct.active = true;
    handlers.get("toggle-type-mode")?.();
    expect(direct.deactivate).toHaveBeenCalledOnce();
  });

  it("fails closed when Type mode would overwrite a local draft", () => {
    const handlers = createComposerFleetShortcutHandlers({
      direct: { active: false, activate: vi.fn(), deactivate: vi.fn() },
      locked: () => false,
      hasDraft: () => true,
      pressKeys: vi.fn(async () => true),
    });
    expect(() => handlers.get("toggle-type-mode")?.()).toThrow(
      "Send or clear the draft before typing into the terminal",
    );
  });
});
