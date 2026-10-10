import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { NumericSettingRow } from "@/components/ui/numeric-setting-row";
import { CHAT_DENSITY_KEY, CHAT_SPACING_MIN, CHAT_SPACING_MAX, DENSITY_RANGES, boundDensity, readDensity, type ChatDensity, type DensityKey } from "@/lib/fleet-chat-density";
export { CHAT_SPACING_MIN, CHAT_SPACING_MAX } from "@/lib/fleet-chat-density";
import { asJsonNumber, parseJson } from "@/lib/json";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";

export const CHAT_SPACING_KEY = "fleet:chat-letter-spacing:v1";

function bounded(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(CHAT_SPACING_MAX, Math.max(CHAT_SPACING_MIN, value)) * 100) / 100 : 0;
}
function readSpacing(): number {
  try { return bounded(asJsonNumber(parseJson(localStorage.getItem(CHAT_SPACING_KEY) ?? "0")) ?? 0); }
  catch { return 0; }
}
interface ChatTypography extends ChatDensity {
  setDensity(key: DensityKey, value: number | null): void;
  classes: string;
  spacing: number;
  setSpacing(value: number): void;
  style: CSSProperties;
}
const ChatTypographyContext = createContext<ChatTypography | null>(null);

export function FleetChatTypographyProvider({ children }: { children: ReactNode }) {
  const [spacing, setValue] = useState(readSpacing);
  const [density, setDensityValue] = useState(readDensity);
  const setDensity = useCallback((key: DensityKey, value: number | null) => {
    setDensityValue(previous => {
      const next = { ...previous, [key]: boundDensity(key, value) };
      try { localStorage.setItem(CHAT_DENSITY_KEY, JSON.stringify({ version: 1, ...next })); } catch { /* Retain this tab's in-memory choice. */ }
      return next;
    });
  }, []);
  const setSpacing = useCallback((value: number) => {
    const next = bounded(value);
    setValue(next);
    try { localStorage.setItem(CHAT_SPACING_KEY, JSON.stringify(next)); } catch { /* Keep the current browser's in-memory choice. */ }
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === CHAT_SPACING_KEY || event.key === null) setValue(readSpacing()); if (event.key === CHAT_DENSITY_KEY || event.key === null) setDensityValue(readDensity()); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const value = useMemo(() => {
    // SAFETY: this one custom property contains only a bounded numeric em value or the normal keyword.
    const style = { "--fleet-chat-letter-spacing": spacing === 0 ? "normal" : `${spacing}em` } as CSSProperties;
    const classes: string[] = [];
    if (density.lineHeight !== null) {
      Object.assign(style, { "--fleet-chat-line-height": String(density.lineHeight) });
      classes.push("[&_[data-slot=session-stream]_*]:[line-height:var(--fleet-chat-line-height)]");
    }
    if (density.blockPadding !== null) {
      Object.assign(style, { "--fleet-chat-block-padding": `${density.blockPadding}px` });
      classes.push("[&_[data-slot=session-stream]_[data-chat-inset]]:[padding-block:var(--fleet-chat-block-padding)]");
    }
    if (density.blockGap !== null) {
      Object.assign(style, { "--fleet-chat-block-gap": `${density.blockGap}px` });
      classes.push("[&_[data-slot=session-stream]>[data-block]]:[margin-block:calc(var(--fleet-chat-block-gap)_-_24px)] [&_[data-slot=session-stream]>[data-block]:not([data-block]~[data-block])]:[margin-top:-12px] [&_[data-slot=session-stream]>[data-block]:not(:has(~[data-block]))]:[margin-bottom:-12px]");
    }
    return { spacing, setSpacing, ...density, setDensity, style, classes: classes.join(" ") };
  }, [spacing, setSpacing, density, setDensity]);
  return <ChatTypographyContext value={value}>{children}</ChatTypographyContext>;
}
export function useFleetChatTypography() { return useContext(ChatTypographyContext); }

export function FleetChatSpacingControls() {
  const prefs = useFleetChatTypography();
  useFleetLocale();
  if (!prefs) return null;
  return <>
    <NumericSettingRow label={ft("fleet.chat.spacing.label")} hint={ft("fleet.chat.spacing.hint")}
      value={prefs.spacing} initial={0} min={CHAT_SPACING_MIN} max={CHAT_SPACING_MAX} step={0.01} suffix=" em"
      defaultLabel={ft("fleet.chat.density.default")} decreaseLabel={ft("fleet.chat.spacing.reduce")} increaseLabel={ft("fleet.chat.spacing.increase")} resetLabel={ft("fleet.chat.spacing.reset")}
      resetValue={0} onChange={value => prefs.setSpacing(value ?? 0)} />
    {(["lineHeight", "blockPadding", "blockGap"] as const).map(key => <NumericSettingRow key={key}
      label={ft(`fleet.chat.density.${key}.label`)} hint={ft("fleet.chat.density.hint")} value={prefs[key]} {...DENSITY_RANGES[key]}
      defaultLabel={ft("fleet.chat.density.default")} decreaseLabel={ft(`fleet.chat.density.${key}.reduce`)} increaseLabel={ft(`fleet.chat.density.${key}.increase`)} resetLabel={ft(`fleet.chat.density.${key}.reset`)}
      onChange={value => prefs.setDensity(key, value)} />)}
  </>;
}
