import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { asJsonObject, parseJson } from "../../web/src/lib/json.ts";
import { diskSettingsIo } from "../settings/store.ts";
import type { TerminalRef } from "../bindings/identity.ts";
import { DEFAULT_PANEL_ROWS, DEFAULT_PANEL_COLUMNS, equalReference, gridDimension, PANEL_SLOT_COUNT, parseSlots, type ViewCommand, type ViewSnapshot } from "./document.ts";

export interface ViewStateIo {
  read: (path: string) => Promise<string | null>;
  write: (path: string, text: string) => Promise<void>;
}
const disk: ViewStateIo = {
  async read(path) {
    try { return await readFile(path, "utf8"); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  },
  write: diskSettingsIo.write,
};

export function createViewStateStore(path: string, io: ViewStateIo = disk) {
  const generation = randomUUID();
  let revision = 0;
  let selection: TerminalRef | null = null;
  let pending = Promise.resolve();
  const readLayout = async () => {
    const text = await io.read(path);
    if (text === null) return { rows: DEFAULT_PANEL_ROWS, columns: DEFAULT_PANEL_COLUMNS, slots: Array.from({ length: PANEL_SLOT_COUNT }, () => null) };
    if (Buffer.byteLength(text) > 128 * 1024) throw new Error("Panel document too large");
    const document = asJsonObject(parseJson(text));
    const rows = gridDimension(document?.rows), columns = gridDimension(document?.columns);
    const slots = rows && columns && document?.version === 1 ? parseSlots(document.slots, rows * columns) : null;
    if (!slots || !rows || !columns) throw new Error("Panel document invalid");
    return { rows, columns, slots };
  };
  const snapshot = (layout: { rows: number; columns: number; slots: readonly (TerminalRef | null)[] }): ViewSnapshot => ({ generation, revision, selection, ...layout });
  return {
    async read() { await pending; return snapshot(await readLayout()); },
    mutate(command: ViewCommand, validate: (terminal: TerminalRef) => Promise<boolean>) {
      const apply = async () => {
        const layout = await readLayout();
        const { slots } = layout;
        if (command.type !== "layout" && command.terminal && !(await validate(command.terminal))) return { ok: false as const, error: "unavailable" as const };
        if (command.type === "select") {
          selection = command.terminal;
          revision += 1;
        } else if (command.type === "layout") {
          if (layout.rows !== command.expectedRows || layout.columns !== command.expectedColumns) return { ok: false as const, error: "conflict" as const, snapshot: snapshot(layout) };
          const count = command.rows * command.columns;
          if (slots.slice(count).some((ref) => ref !== null)) return { ok: false as const, error: "occupied" as const, snapshot: snapshot(layout) };
          const changed = { rows: command.rows, columns: command.columns, slots: Array.from({ length: count }, (_, index) => slots[index] ?? null) };
          await io.write(path, JSON.stringify({ version: 1, ...changed }) + "\n");
          return { ok: true as const, snapshot: snapshot(changed) };
        } else {
          if (layout.rows !== command.rows || layout.columns !== command.columns || !equalReference(slots[command.index] ?? null, command.expected)) {
            return { ok: false as const, error: "conflict" as const, snapshot: snapshot(layout) };
          }
          // Moving a favorite clears its old slot, never the Agent from the queue.
          const changed = slots.map((entry, index) => index === command.index ? command.terminal :
            command.terminal && equalReference(entry, command.terminal) ? null : entry);
          const next = { ...layout, slots: changed };
          await io.write(path, JSON.stringify({ version: 1, ...next }) + "\n");
          return { ok: true as const, snapshot: snapshot(next) };
        }
        return { ok: true as const, snapshot: snapshot(layout) };
      };
      const result = pending.then(apply);
      pending = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
export type ViewStateStore = ReturnType<typeof createViewStateStore>;
