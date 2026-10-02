import { asJsonObject, asJsonString, parseJson, type JsonValue } from "../../web/src/lib/json.ts";

export const TAGS_PATH = "/fleet/api/pane-tags";
export const MAX_TAGS = 256;
export const MAX_PLACES = 4096;
export const MAX_NAME = 64;
export const MAX_TAGS_PER_PANE = 32;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const TAG_COLORS = ["#64748b", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"] as const;

export interface PanePlace { row: string; space: string }
export interface PaneTag { id: string; name: string; color: string }
export interface TagAssignment extends PanePlace { tags: string[] }
export interface TagDocument { schemaVersion: 1; tags: PaneTag[]; panes: TagAssignment[] }
export interface TagSnapshot { version: string; document: TagDocument }
export type TagCommand =
  | { kind: "attach"; pane: PanePlace; name: string }
  | { kind: "detach"; pane: PanePlace; id: string }
  | { kind: "edit"; id: string; name: string; color: string };
export type TagProblem = "invalid" | "duplicate" | "limit" | "missing";

export function emptyTags(): TagDocument { return { schemaVersion: 1, tags: [], panes: [] }; }
export function normalizeTagName(name: string): string { return name.trim().normalize("NFC"); }
export function validTagName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME && !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}
export function samePlace(a: PanePlace, b: PanePlace): boolean { return a.row === b.row && a.space === b.space; }
export function tagsForPane(document: TagDocument, pane: PanePlace): PaneTag[] {
  const ids = document.panes.find((entry) => samePlace(entry, pane))?.tags ?? [];
  const definitions = new Map(document.tags.map((tag) => [tag.id, tag]));
  return ids.flatMap((id) => { const tag = definitions.get(id); return tag ? [tag] : []; });
}

function placeOf(value: JsonValue | undefined): PanePlace | null {
  const obj = asJsonObject(value);
  const row = asJsonString(obj?.row);
  const space = asJsonString(obj?.space);
  if (!row || row.length > 2048 || !space || space.length > 512) return null;
  return { row, space };
}
function idOf(value: JsonValue | undefined): string | null {
  const id = asJsonString(value);
  return id && /^[a-zA-Z0-9-]{1,80}$/u.test(id) ? id : null;
}
function colorOf(value: JsonValue | undefined): string | null {
  const color = asJsonString(value);
  return color && /^#[0-9a-fA-F]{6}$/u.test(color) ? color.toLowerCase() : null;
}
function nameOf(value: JsonValue | undefined): string | null {
  const raw = asJsonString(value);
  if (raw === undefined) return null;
  const name = normalizeTagName(raw);
  return validTagName(name) ? name : null;
}

export function parseTagCommand(value: JsonValue | undefined): TagCommand | null {
  const obj = asJsonObject(value);
  if (!obj) return null;
  if (obj.kind === "edit") {
    const id = idOf(obj.id), name = nameOf(obj.name), color = colorOf(obj.color);
    return id && name && color ? { kind: "edit", id, name, color } : null;
  }
  const pane = placeOf(obj.pane);
  if (!pane) return null;
  if (obj.kind === "attach") {
    const name = nameOf(obj.name);
    return name ? { kind: "attach", pane, name } : null;
  }
  if (obj.kind === "detach") {
    const id = idOf(obj.id);
    return id ? { kind: "detach", pane, id } : null;
  }
  return null;
}

export function parseTagDocument(input: JsonValue | undefined): TagDocument | null {
  const obj = asJsonObject(input);
  if (!obj || obj.schemaVersion !== 1 || !Array.isArray(obj.tags) || !Array.isArray(obj.panes)) return null;
  if (obj.tags.length > MAX_TAGS || obj.panes.length > MAX_PLACES) return null;
  const tags: PaneTag[] = [], panes: TagAssignment[] = [];
  const ids = new Set<string>(), names = new Set<string>(), places = new Set<string>();
  for (const value of obj.tags) {
    const tag = asJsonObject(value);
    const id = idOf(tag?.id), name = nameOf(tag?.name), color = colorOf(tag?.color);
    if (!id || !name || !color || ids.has(id) || names.has(name)) return null;
    ids.add(id); names.add(name); tags.push({ id, name, color });
  }
  for (const value of obj.panes) {
    const entry = asJsonObject(value), place = placeOf(value);
    if (!entry || !place || !Array.isArray(entry.tags) || entry.tags.length > MAX_TAGS_PER_PANE) return null;
    const key = JSON.stringify([place.row, place.space]);
    if (places.has(key)) return null;
    places.add(key);
    const attached: string[] = [];
    for (const rawId of entry.tags) {
      const id = idOf(rawId);
      if (!id || !ids.has(id) || attached.includes(id)) return null;
      attached.push(id);
    }
    panes.push({ ...place, tags: attached });
  }
  return { schemaVersion: 1, tags, panes };
}

export function parseTagSnapshot(text: string): TagSnapshot | null {
  const obj = asJsonObject(parseJson(text));
  const version = asJsonString(obj?.version), document = parseTagDocument(obj?.document);
  return version !== undefined && document ? { version, document } : null;
}

export function changeTags(
  current: TagDocument, command: TagCommand, newTag: () => { id: string; color: string },
): { ok: true; document: TagDocument } | { ok: false; error: TagProblem } {
  const tags = current.tags.map((tag) => ({ ...tag }));
  let panes = current.panes.map((pane) => ({ ...pane, tags: [...pane.tags] }));
  if (command.kind === "edit") {
    const tag = tags.find((entry) => entry.id === command.id);
    if (!tag) return { ok: false, error: "missing" };
    if (tags.some((entry) => entry.id !== tag.id && entry.name === command.name)) return { ok: false, error: "duplicate" };
    tag.name = command.name; tag.color = command.color;
  } else if (command.kind === "detach") {
    panes = panes.map((entry) => samePlace(entry, command.pane) ? { ...entry, tags: entry.tags.filter((id) => id !== command.id) } : entry)
      .filter((entry) => entry.tags.length > 0);
  } else {
    let pane = panes.find((entry) => samePlace(entry, command.pane));
    if (pane && pane.tags.length >= MAX_TAGS_PER_PANE) return { ok: false, error: "limit" };
    if (!pane && panes.length >= MAX_PLACES) return { ok: false, error: "limit" };
    let tag = tags.find((entry) => entry.name === command.name);
    if (!tag) {
      if (tags.length >= MAX_TAGS) return { ok: false, error: "limit" };
      tag = { ...newTag(), name: command.name }; tags.push(tag);
    }
    if (!pane) { pane = { ...command.pane, tags: [] }; panes.push(pane); }
    if (!pane.tags.includes(tag.id)) pane.tags.push(tag.id);
  }
  return { ok: true, document: { schemaVersion: 1, tags, panes } };
}
