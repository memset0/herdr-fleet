import { asJsonNumber, asJsonObject, asJsonString, type JsonValue } from "../../web/src/lib/json.ts";
import { parseTerminalReference, sameTerminal, type TerminalRef } from "../bindings/identity.ts";

export const VIEW_STATE_PATH = "/fleet/api/view-state";
export const PANEL_SLOT_COUNT = 12;
export const DEFAULT_PANEL_ROWS = 3;
export const DEFAULT_PANEL_COLUMNS = 4;
export function gridDimension(value: JsonValue | undefined): number | null {
  const number = asJsonNumber(value);
  return number !== undefined && Number.isInteger(number) && number >= 1 && number <= 6 ? number : null;
}
export interface ViewSnapshot {
  readonly generation: string;
  readonly revision: number;
  readonly selection: TerminalRef | null;
  readonly slots: readonly (TerminalRef | null)[];
  readonly rows: number;
  readonly columns: number;
}
export type ViewCommand =
  | { readonly type: "select"; readonly terminal: TerminalRef }
  | { readonly type: "slot"; readonly index: number; readonly expected: TerminalRef | null; readonly terminal: TerminalRef | null; readonly rows: number; readonly columns: number }
  | { readonly type: "layout"; readonly rows: number; readonly columns: number; readonly expectedRows: number; readonly expectedColumns: number };

export function equalReference(a: TerminalRef | null, b: TerminalRef | null): boolean {
  return a === null || b === null ? a === b : sameTerminal(a, b);
}

export function parseSlots(value: JsonValue | undefined, count: number): (TerminalRef | null)[] | null {
  if (!Array.isArray(value) || value.length !== count) return null;
  const result: (TerminalRef | null)[] = [];
  for (const entry of value) {
    const ref = entry === null ? null : parseTerminalReference(entry);
    if (entry !== null && ref === null) return null;
    if (ref && result.some((previous) => equalReference(previous, ref))) return null;
    result.push(ref);
  }
  return result;
}

export function parseViewSnapshot(value: JsonValue | undefined): ViewSnapshot | null {
  const object = asJsonObject(value);
  const rows = gridDimension(object?.rows), columns = gridDimension(object?.columns);
  if (!rows || !columns) return null;
  const generation = asJsonString(object?.generation), slots = parseSlots(object?.slots, rows * columns);
  const revision = asJsonNumber(object?.revision);
  const selection = object?.selection === null ? null : parseTerminalReference(object?.selection);
  if (!generation || !slots || revision === undefined || revision < 0 || !Number.isSafeInteger(revision) ||
    (object?.selection !== null && !selection)) return null;
  return { generation, revision, selection, slots, rows, columns };
}

export function parseViewCommand(value: JsonValue | undefined): ViewCommand | null {
  const object = asJsonObject(value);
  if (!object) return null;
  const rows = gridDimension(object.rows), columns = gridDimension(object.columns);
  if (object.type === "layout") {
    const expectedRows = gridDimension(object.expectedRows), expectedColumns = gridDimension(object.expectedColumns);
    return rows && columns && expectedRows && expectedColumns ? { type: "layout", rows, columns, expectedRows, expectedColumns } : null;
  }
  const terminal = object.terminal === null ? null : parseTerminalReference(object.terminal);
  if (object.type === "select") return terminal ? { type: "select", terminal } : null;
  if (object.type !== "slot" || (object.terminal !== null && !terminal)) return null;
  const expected = object.expected === null ? null : parseTerminalReference(object.expected);
  if (object.expected !== null && !expected) return null;
  const index = asJsonNumber(object.index);
  if (index === undefined || !Number.isSafeInteger(index) || !rows || !columns) return null;
  return index >= 0 && index < rows * columns ? { type: "slot", index, expected, terminal, rows, columns } : null;
}
