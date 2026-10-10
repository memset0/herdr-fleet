import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { asJsonNumber, parseJson } from "@/lib/json";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";

export const CHAT_SPACING_KEY = "fleet:chat-letter-spacing:v1";
export const CHAT_SPACING_MIN = -0.08;
export const CHAT_SPACING_MAX = 0.12;

function bounded(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(CHAT_SPACING_MAX, Math.max(CHAT_SPACING_MIN, value)) * 100) / 100 : 0;
}
function readSpacing(): number {
  try { return bounded(asJsonNumber(parseJson(localStorage.getItem(CHAT_SPACING_KEY) ?? "0")) ?? 0); }
  catch { return 0; }
}
interface ChatTypography {
  spacing: number;
  setSpacing(value: number): void;
  style: CSSProperties;
}
const ChatTypographyContext = createContext<ChatTypography | null>(null);

export function FleetChatTypographyProvider({ children }: { children: ReactNode }) {
  const [spacing, setValue] = useState(readSpacing);
  const setSpacing = useCallback((value: number) => {
    const next = bounded(value);
    setValue(next);
    try { localStorage.setItem(CHAT_SPACING_KEY, JSON.stringify(next)); } catch { /* Keep the current browser's in-memory choice. */ }
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === CHAT_SPACING_KEY || event.key === null) setValue(readSpacing()); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const value = useMemo(() => {
    // SAFETY: this one custom property contains only a bounded numeric em value or the normal keyword.
    const style = { "--fleet-chat-letter-spacing": spacing === 0 ? "normal" : `${spacing}em` } as CSSProperties;
    return { spacing, setSpacing, style };
  }, [spacing, setSpacing]);
  return <ChatTypographyContext value={value}>{children}</ChatTypographyContext>;
}
export function useFleetChatTypography() { return useContext(ChatTypographyContext); }

export function FleetChatSpacingControls() {
  const prefs = useFleetChatTypography();
  useFleetLocale();
  if (!prefs) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
    <div className="min-w-0"><span className="block text-sm font-medium">{ft("fleet.chat.spacing.label")}</span>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{ft("fleet.chat.spacing.hint")}</p></div>
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={ft("fleet.chat.spacing.reduce")} disabled={prefs.spacing <= CHAT_SPACING_MIN} onClick={() => prefs.setSpacing(prefs.spacing - 0.01)}><Minus className="size-4" aria-hidden /></Button>
      <output aria-label={ft("fleet.chat.spacing.label")} className="w-20 text-center text-xs tabular-nums">{prefs.spacing.toFixed(2)} em</output>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={ft("fleet.chat.spacing.increase")} disabled={prefs.spacing >= CHAT_SPACING_MAX} onClick={() => prefs.setSpacing(prefs.spacing + 0.01)}><Plus className="size-4" aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={ft("fleet.chat.spacing.reset")} disabled={prefs.spacing === 0} onClick={() => prefs.setSpacing(0)}><RotateCcw className="size-4" aria-hidden /></Button>
    </div>
  </div>;
}
