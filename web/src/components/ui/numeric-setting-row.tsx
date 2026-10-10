import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface NumericSettingRowProps {
  label: string;
  hint?: string;
  value: number | null;
  initial: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  defaultLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  resetLabel: string;
  resetValue?: number | null;
  onChange(value: number | null): void;
}
/** One labelled, bounded numeric choice with an explicit default. */
export function NumericSettingRow({ label, hint, value, initial, min, max, step, suffix, defaultLabel, decreaseLabel, increaseLabel, resetLabel, resetValue = null, onChange }: NumericSettingRowProps) {
  const current = value ?? initial;
  const change = (delta: number) => onChange(Math.round(Math.min(max, Math.max(min, current + delta)) * 100) / 100);
  return <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
    <div className="min-w-0"><span className="block text-sm font-medium">{label}</span>{hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}</div>
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={decreaseLabel} disabled={current <= min} onClick={() => change(-step)}><Minus className="size-4" aria-hidden /></Button>
      <output aria-label={label} className="w-20 text-center text-xs tabular-nums">{value === null ? defaultLabel : `${value.toFixed(step >= 1 ? 0 : 2)}${suffix}`}</output>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={increaseLabel} disabled={current >= max} onClick={() => change(step)}><Plus className="size-4" aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={resetLabel} disabled={value === resetValue} onClick={() => onChange(resetValue)}><RotateCcw className="size-4" aria-hidden /></Button>
    </div>
  </div>;
}
