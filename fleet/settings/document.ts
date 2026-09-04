// Fleet's own settings document: its shape, its defaults, and the whole-document validation that
// decides whether one is allowed to replace the effective settings.
//
// WHOLE-DOCUMENT, and that word is the contract. A document is accepted or rejected entire; there is
// no partial application and no "the good half took". An operator saving a file with one typo'd
// command id gets that id named back and keeps the bindings they had, which is the only outcome that
// leaves them with a keyboard they can still use to fix it.
//
// Pure and fs-free, so the text area can validate exactly what the Gateway will, and both can be
// tested without a browser or a disk.

import type { JsonObject, JsonValue } from "../../bridge/json.ts";
import { bindingKey, chordsEqual, formatBinding, parseBinding, type Binding } from "../ui/commands/bindings.ts";
import { DEFAULT_COMMAND_PREFIX, isCommandId, type CommandId } from "../ui/commands/catalog.ts";
import { findDuplicateBinding, resolveBindings } from "../ui/commands/effective.ts";

export const FLEET_SETTINGS_FILENAME = "settings.json";
export const FLEET_SETTINGS_SCHEMA_VERSION = 1;

/** The keys a document may carry. Anything else is a rejection, not a thing to ignore. */
const TOP_LEVEL_KEYS = new Set(["schemaVersion", "shortcuts"]);
const SHORTCUT_KEYS = new Set(["prefix", "bindings"]);

export interface FleetSettings {
  readonly prefix: string;
  /** Only the commands the operator named. Absent means "keep the shipped default". */
  readonly bindings: ReadonlyMap<CommandId, readonly Binding[]>;
  /** Bindings that will work on some browsers and not others, for the editor to mark. */
  readonly risky: readonly string[];
}

export const DEFAULT_FLEET_SETTINGS: FleetSettings = {
  prefix: DEFAULT_COMMAND_PREFIX,
  bindings: new Map(),
  risky: [],
};

export interface SettingsRejection {
  /** Where the fault is, in the document's own terms. */
  readonly at: string;
  readonly message: string;
}

export type SettingsParseResult =
  | { readonly ok: true; readonly settings: FleetSettings }
  | { readonly ok: false; readonly rejection: SettingsRejection };

function reject(at: string, message: string): SettingsParseResult {
  return { ok: false, rejection: { at, message } };
}

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a parsed document.
 *
 * The caller has already turned text into JSON — a syntax error is that step's to report, with the
 * position only it knows. Everything from "is this the right shape" onward is here.
 */
export function parseFleetSettings(value: JsonValue | undefined): SettingsParseResult {
  if (!isPlainObject(value)) return reject("", "the document must be a JSON object");

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) return reject(key, `unknown setting "${key}"`);
  }

  const version = value.schemaVersion;
  if (version !== undefined && version !== FLEET_SETTINGS_SCHEMA_VERSION) {
    return reject("schemaVersion", `expected schemaVersion ${FLEET_SETTINGS_SCHEMA_VERSION}`);
  }

  const shortcuts = value.shortcuts;
  if (shortcuts === undefined) return { ok: true, settings: DEFAULT_FLEET_SETTINGS };
  if (!isPlainObject(shortcuts)) return reject("shortcuts", "shortcuts must be an object");
  for (const key of Object.keys(shortcuts)) {
    if (!SHORTCUT_KEYS.has(key)) return reject(`shortcuts.${key}`, `unknown setting "${key}"`);
  }

  let prefix = DEFAULT_COMMAND_PREFIX;
  if (shortcuts.prefix !== undefined) {
    if (typeof shortcuts.prefix !== "string") {
      return reject("shortcuts.prefix", "the prefix must be a string");
    }
    const parsed = parseBinding(shortcuts.prefix);
    if (!parsed.ok) {
      return reject("shortcuts.prefix", `${shortcuts.prefix} is not a usable chord`);
    }
    if (parsed.binding.kind !== "direct") {
      return reject("shortcuts.prefix", "the prefix is itself a chord, not a prefix binding");
    }
    prefix = shortcuts.prefix;
  }
  const prefixChord = parseBinding(prefix);

  const risky: string[] = [];
  const bindings = new Map<CommandId, readonly Binding[]>();
  const raw = shortcuts.bindings;
  if (raw !== undefined) {
    if (!isPlainObject(raw)) return reject("shortcuts.bindings", "bindings must be an object");
    for (const [id, list] of Object.entries(raw)) {
      const at = `shortcuts.bindings.${id}`;
      if (!isCommandId(id)) return reject(at, `unknown command "${id}"`);
      if (!Array.isArray(list)) return reject(at, "a command's bindings must be an array");
      const own: Binding[] = [];
      for (const text of list) {
        if (typeof text !== "string") return reject(at, "a binding must be a string");
        const parsed = parseBinding(text);
        if (!parsed.ok) return reject(at, `${text} is not a usable binding (${parsed.failure.reason})`);
        // A direct binding on the prefix chord would make the prefix unreachable, and every
        // sequential binding with it. Refused here rather than left to the recognizer's ordering.
        if (
          parsed.binding.kind === "direct" &&
          prefixChord.ok &&
          chordsEqual(parsed.binding.chord, prefixChord.binding.chord)
        ) {
          return reject(at, `${text} is the prefix itself`);
        }
        if (parsed.hazard === "risky") risky.push(formatBinding(parsed.binding));
        // A command that names the same binding twice is a typo, not an alias.
        if (own.some((existing) => bindingKey(existing) === bindingKey(parsed.binding))) {
          return reject(at, `${text} is listed twice`);
        }
        own.push(parsed.binding);
      }
      bindings.set(id, own);
    }
  }

  // Checked over the EFFECTIVE set, so a document that moves one command onto another's untouched
  // default is caught as well as one that names the same chord twice.
  const clash = findDuplicateBinding(resolveBindings(bindings));
  if (clash !== null) {
    return reject(
      `shortcuts.bindings.${clash.commands[1]}`,
      `${clash.label} is already bound to ${clash.commands[0]}`,
    );
  }

  return { ok: true, settings: { prefix, bindings, risky } };
}

/** Parse text, so a syntax error is reported as one rather than as a shape problem. */
export function parseFleetSettingsText(text: string): SettingsParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, settings: DEFAULT_FLEET_SETTINGS };
  let value: JsonValue;
  try {
    // SAFETY: `JSON.parse` answers with exactly a JsonValue by construction, and every field below
    // is read through the guards in this module before it is believed.
    value = JSON.parse(trimmed) as JsonValue;
  } catch (error) {
    return reject("", error instanceof Error ? error.message : "the document is not valid JSON");
  }
  return parseFleetSettings(value);
}

/** The document as it is written back, so a round trip through the editor is stable. */
export function serializeFleetSettings(settings: FleetSettings): string {
  const bindings: Record<string, string[]> = {};
  for (const [id, own] of settings.bindings) {
    bindings[id] = own.map((binding) => formatBinding(binding));
  }
  return `${JSON.stringify(
    {
      schemaVersion: FLEET_SETTINGS_SCHEMA_VERSION,
      shortcuts: { prefix: settings.prefix, bindings },
    },
    null,
    2,
  )}\n`;
}
