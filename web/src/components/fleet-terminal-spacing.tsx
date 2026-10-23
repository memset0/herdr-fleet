import { useSyncExternalStore } from "react";

import { NumericSettingRow } from "@/components/ui/numeric-setting-row";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import {
  DEFAULT_TERMINAL_SPACING,
  TERMINAL_SPACING_RANGES,
  terminalSpacingPreference,
  type SpacingKey,
} from "../../../fleet/ui/terminal/spacing.ts";

/**
 * Line and character spacing for the real-terminal surface, drawn among the Display sheet's terminal
 * rows right after Text size, which is the other half of the same cell. Per browser, like Text size.
 * A value equal to its default reads as "Default", so the row says plainly that nothing is changed.
 */
export function FleetTerminalSpacingControls() {
  useFleetLocale();
  const spacing = useSyncExternalStore(
    terminalSpacingPreference.subscribe,
    terminalSpacingPreference.snapshot,
    terminalSpacingPreference.snapshot,
  );
  const row = (key: SpacingKey, suffix: string) => {
    const { min, max, step } = TERMINAL_SPACING_RANGES[key];
    const value = spacing[key];
    return (
      <NumericSettingRow
        key={key}
        label={ft(`fleet.terminal.spacing.${key}.label`)}
        hint={ft("fleet.terminal.spacing.hint")}
        value={value === DEFAULT_TERMINAL_SPACING[key] ? null : value}
        initial={DEFAULT_TERMINAL_SPACING[key]}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        defaultLabel={ft("fleet.terminal.spacing.default")}
        decreaseLabel={ft(`fleet.terminal.spacing.${key}.reduce`)}
        increaseLabel={ft(`fleet.terminal.spacing.${key}.increase`)}
        resetLabel={ft(`fleet.terminal.spacing.${key}.reset`)}
        onChange={(next) => terminalSpacingPreference.set(key, next)}
      />
    );
  };
  return (
    <>
      {row("lineHeight", "×")}
      {row("letterSpacing", " px")}
    </>
  );
}
