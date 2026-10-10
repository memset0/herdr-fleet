import { isFleetBuild } from "./fleet-build";
import { asJsonNumber, asJsonObject, parseJson } from "./json";

export const CHAT_SPACING_MIN = -0.12;
export const CHAT_SPACING_MAX = 0.12;
export const CHAT_DENSITY_KEY = "fleet:chat-density:v1";
export const DENSITY_RANGES = {
  lineHeight: { min: 1.1, max: 2, step: 0.05, initial: 1.6, suffix: "×" },
  blockPadding: { min: 0, max: 16, step: 1, initial: 8, suffix: "px" },
  blockGap: { min: 0, max: 24, step: 1, initial: 8, suffix: "px" },
} as const;
export type DensityKey = keyof typeof DENSITY_RANGES;
export interface ChatDensity { lineHeight: number | null; blockPadding: number | null; blockGap: number | null }
export const DEFAULT_DENSITY: ChatDensity = { lineHeight: null, blockPadding: null, blockGap: null };
export function fleetChatFontMinimum(): number { return isFleetBuild() ? 10 : 12; }
export function boundDensity(key: DensityKey, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const range = DENSITY_RANGES[key];
  return Math.round(Math.min(range.max, Math.max(range.min, value)) * 100) / 100;
}
export function readDensity(): ChatDensity {
  try {
    const record = asJsonObject(parseJson(localStorage.getItem(CHAT_DENSITY_KEY) ?? "null"));
    if (!record || record.version !== 1) return DEFAULT_DENSITY;
    return {
      lineHeight: boundDensity("lineHeight", asJsonNumber(record.lineHeight) ?? null),
      blockPadding: boundDensity("blockPadding", asJsonNumber(record.blockPadding) ?? null),
      blockGap: boundDensity("blockGap", asJsonNumber(record.blockGap) ?? null),
    };
  } catch { return DEFAULT_DENSITY; }
}
