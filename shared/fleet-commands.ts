export const FLEET_SHORTCUT_SCHEMA_VERSION = 1 as const;
export const FLEET_SHORTCUT_PREFIX_TIMEOUT_MS = 2_000;

export type FleetCommandScope = "fleet" | "selected-pane";

export interface FleetCommandDefinition {
  id: string;
  name: string;
  scope: FleetCommandScope;
}
const fixedCommands = [
  { id: "open-fleet-settings", name: "Open Fleet Settings", scope: "fleet" },
  { id: "open-command-palette", name: "Open Command Palette", scope: "fleet" },
  { id: "toggle-fleet-sidebars", name: "Toggle Fleet Sidebars", scope: "fleet" },
  { id: "rename-space", name: "Rename Space", scope: "fleet" },
  { id: "close-space", name: "Close Space", scope: "fleet" },
  { id: "create-tab", name: "Create Tab", scope: "fleet" },
  { id: "next-tab", name: "Next Tab", scope: "fleet" },
  { id: "previous-tab", name: "Previous Tab", scope: "fleet" },
  { id: "rename-tab", name: "Rename Tab", scope: "fleet" },
  { id: "close-tab", name: "Close Tab", scope: "fleet" },
  { id: "next-pane-in-tab", name: "Next Pane in Tab", scope: "fleet" },
  { id: "previous-pane-in-tab", name: "Previous Pane in Tab", scope: "fleet" },
  { id: "close-pane", name: "Close Pane", scope: "selected-pane" },
  { id: "fit-pane-width", name: "Fit Current Pane Width", scope: "selected-pane" },
  { id: "rename-pane", name: "Rename Pane", scope: "selected-pane" },
  { id: "previous-pane", name: "Previous Pane in Fleet", scope: "fleet" },
  { id: "next-pane", name: "Next Pane in Fleet", scope: "fleet" },
  { id: "previous-agent", name: "Previous Agent", scope: "fleet" },
  { id: "next-agent", name: "Next Agent", scope: "fleet" },
  { id: "last-pane", name: "Last Pane", scope: "fleet" },
  { id: "copy-fleet-pane-link", name: "Copy Fleet Pane Link", scope: "fleet" },
  { id: "toggle-type-mode", name: "Toggle Type Mode", scope: "selected-pane" },
  { id: "send-escape", name: "Send Escape", scope: "selected-pane" },
  { id: "send-enter", name: "Send Enter", scope: "selected-pane" },
  { id: "send-up-arrow", name: "Send Up Arrow", scope: "selected-pane" },
  { id: "send-down-arrow", name: "Send Down Arrow", scope: "selected-pane" },
  { id: "send-left-arrow", name: "Send Left Arrow", scope: "selected-pane" },
  { id: "send-right-arrow", name: "Send Right Arrow", scope: "selected-pane" },
  { id: "send-space", name: "Send Space", scope: "selected-pane" },
  { id: "send-ctrl-c", name: "Send Ctrl+C", scope: "selected-pane" },
] as const satisfies readonly FleetCommandDefinition[];

function ordinalCommands(prefix: "select-tab" | "select-agent", noun: "Tab" | "Agent"): FleetCommandDefinition[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `Select ${noun} ${index + 1}`,
    scope: "fleet" as const,
  }));
}

export const FLEET_COMMANDS: readonly FleetCommandDefinition[] = Object.freeze([
  ...fixedCommands.slice(0, 8),
  ...ordinalCommands("select-tab", "Tab"),
  ...fixedCommands.slice(8, 19),
  ...ordinalCommands("select-agent", "Agent"),
  ...fixedCommands.slice(19),
]);

export type FleetCommandId = string;

const COMMAND_IDS = new Set(FLEET_COMMANDS.map((command) => command.id));

export function isFleetCommandId(value: unknown): value is FleetCommandId {
  return typeof value === "string" && COMMAND_IDS.has(value);
}

export function fleetCommand(commandId: string): FleetCommandDefinition | null {
  return FLEET_COMMANDS.find((command) => command.id === commandId) ?? null;
}

export const FLEET_PUBLIC_DEFAULT_BINDINGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "open-fleet-settings": ["Prefix+S"],
  "open-command-palette": ["Prefix+?", "Ctrl+Shift+P"],
  "toggle-fleet-sidebars": ["Prefix+B"],
  "rename-space": ["Prefix+Shift+W"],
  "close-space": ["Prefix+Shift+D"],
  "create-tab": ["Prefix+C", "Prefix+V", "Prefix+-"],
  "next-tab": ["Prefix+N"],
  "previous-tab": ["Prefix+P"],
  ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`select-tab-${index + 1}`, [`Prefix+${index + 1}`]])),
  "rename-tab": ["Prefix+Shift+T"],
  "close-tab": ["Prefix+Shift+X"],
  "next-pane-in-tab": ["Prefix+Tab"],
  "previous-pane-in-tab": ["Prefix+Shift+Tab"],
  "close-pane": ["Prefix+X"],
  "fit-pane-width": ["Prefix+R", "Alt+S"],
  "rename-pane": ["Prefix+Shift+P"],
  "previous-pane": ["Alt+K"],
  "next-pane": ["Alt+J"],
  "previous-agent": ["Alt+H"],
  "next-agent": ["Alt+L"],
  ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`select-agent-${index + 1}`, [`Alt+${index + 1}`]])),
  "last-pane": [],
  "copy-fleet-pane-link": [],
  "toggle-type-mode": [],
  "send-escape": [],
  "send-enter": [],
  "send-up-arrow": [],
  "send-down-arrow": [],
  "send-left-arrow": [],
  "send-right-arrow": [],
  "send-space": [],
  "send-ctrl-c": [],
});

export interface FleetShortcutDocument {
  schemaVersion: typeof FLEET_SHORTCUT_SCHEMA_VERSION;
  prefix: string;
  bindings: Record<string, string[]>;
}

export interface FleetKeyChord {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  label: string;
}

export interface FleetEffectiveBinding {
  commandId: FleetCommandId;
  kind: "direct" | "prefix";
  chord: FleetKeyChord;
  label: string;
}

export interface FleetShortcutConfiguration {
  schemaVersion: typeof FLEET_SHORTCUT_SCHEMA_VERSION;
  prefix: FleetKeyChord;
  bindings: readonly FleetEffectiveBinding[];
  bindingsByCommand: Readonly<Record<string, readonly FleetEffectiveBinding[]>>;
}

const DOCUMENT_KEYS = new Set(["schemaVersion", "prefix", "bindings"]);
const MAX_BINDINGS_PER_COMMAND = 16;
const MAX_TOTAL_BINDINGS = 256;
const MODIFIER_LABELS = new Map([
  ["ctrl", "Ctrl"],
  ["control", "Ctrl"],
  ["alt", "Alt"],
  ["option", "Alt"],
  ["shift", "Shift"],
  ["meta", "Meta"],
  ["cmd", "Meta"],
  ["command", "Meta"],
]);

const SPECIAL_KEYS = new Map<string, { code: string; label: string; impliedShift?: boolean }>([
  ["?", { code: "Slash", label: "?", impliedShift: true }],
  ["-", { code: "Minus", label: "-" }],
  ["tab", { code: "Tab", label: "Tab" }],
  ["escape", { code: "Escape", label: "Escape" }],
  ["esc", { code: "Escape", label: "Escape" }],
  ["enter", { code: "Enter", label: "Enter" }],
  ["space", { code: "Space", label: "Space" }],
  ["up", { code: "ArrowUp", label: "Up" }],
  ["arrowup", { code: "ArrowUp", label: "Up" }],
  ["down", { code: "ArrowDown", label: "Down" }],
  ["arrowdown", { code: "ArrowDown", label: "Down" }],
  ["left", { code: "ArrowLeft", label: "Left" }],
  ["arrowleft", { code: "ArrowLeft", label: "Left" }],
  ["right", { code: "ArrowRight", label: "Right" }],
  ["arrowright", { code: "ArrowRight", label: "Right" }],
]);

function exactKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  const extras = Object.keys(record).filter((key) => !allowed.has(key));
  if (extras.length) throw new Error(`${label} contains unknown field(s): ${extras.join(", ")}`);
}

function keyToken(token: string, label: string): { code: string; label: string; impliedShift?: boolean } {
  const special = SPECIAL_KEYS.get(token.toLowerCase());
  if (special) return special;
  if (/^[A-Za-z]$/.test(token)) return { code: `Key${token.toUpperCase()}`, label: token.toUpperCase() };
  if (/^[0-9]$/.test(token)) return { code: `Digit${token}`, label: token };
  throw new Error(`${label} uses unsupported key ${JSON.stringify(token)}`);
}

export function parseFleetKeyChord(value: unknown, label = "shortcut"): FleetKeyChord {
  if (typeof value !== "string" || value.trim() !== value || !value) {
    throw new Error(`${label} must be a non-empty canonical chord`);
  }
  const tokens = value.split("+");
  if (tokens.some((token) => !token)) throw new Error(`${label} contains an empty key token`);
  const terminal = tokens.at(-1)!;
  const key = keyToken(terminal, label);
  const modifiers = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: Boolean(key.impliedShift) };
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIER_LABELS.get(token.toLowerCase());
    if (!modifier) throw new Error(`${label} contains unsupported modifier ${JSON.stringify(token)}`);
    const property = modifier === "Alt" ? "altKey" : modifier === "Ctrl" ? "ctrlKey" : modifier === "Meta" ? "metaKey" : "shiftKey";
    if (modifiers[property]) throw new Error(`${label} repeats modifier ${modifier}`);
    modifiers[property] = true;
  }
  const parts = [
    modifiers.ctrlKey ? "Ctrl" : "",
    modifiers.altKey ? "Alt" : "",
    modifiers.shiftKey && !key.impliedShift ? "Shift" : "",
    modifiers.metaKey ? "Meta" : "",
    key.label,
  ].filter(Boolean);
  return { code: key.code, ...modifiers, label: parts.join("+") };
}

export function fleetChordSignature(chord: Pick<FleetKeyChord, "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): string {
  return [chord.code, chord.altKey, chord.ctrlKey, chord.metaKey, chord.shiftKey].join("|");
}

function parseBinding(commandId: string, value: unknown): FleetEffectiveBinding {
  if (typeof value !== "string") throw new Error(`bindings.${commandId} entries must be strings`);
  const prefix = value.startsWith("Prefix+");
  const chordText = prefix ? value.slice("Prefix+".length) : value;
  if (!chordText || chordText.includes("Prefix")) throw new Error(`bindings.${commandId} contains an invalid Prefix binding`);
  const chord = parseFleetKeyChord(chordText, `bindings.${commandId}`);
  if (prefix && chord.code === "Escape" && !chord.altKey && !chord.ctrlKey && !chord.metaKey && !chord.shiftKey) {
    throw new Error(`bindings.${commandId} cannot bind bare Prefix+Escape because Escape cancels prefix mode`);
  }
  return { commandId, kind: prefix ? "prefix" : "direct", chord, label: prefix ? `Prefix ${chord.label}` : chord.label };
}

export interface ParseFleetShortcutDocumentOptions {
  requireComplete?: boolean;
}

export function parseFleetShortcutDocument(
  value: unknown,
  options: ParseFleetShortcutDocumentOptions = {},
): FleetShortcutConfiguration {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("shortcut config must be an object");
  const record = value as Record<string, unknown>;
  exactKeys(record, DOCUMENT_KEYS, "shortcut config");
  if (record.schemaVersion !== FLEET_SHORTCUT_SCHEMA_VERSION) {
    throw new Error(`shortcut config schemaVersion must be ${FLEET_SHORTCUT_SCHEMA_VERSION}`);
  }
  const prefix = parseFleetKeyChord(record.prefix, "shortcut config prefix");
  if (!record.bindings || typeof record.bindings !== "object" || Array.isArray(record.bindings)) {
    throw new Error("shortcut config bindings must be an object");
  }
  const rawBindings = record.bindings as Record<string, unknown>;
  const unknownIds = Object.keys(rawBindings).filter((id) => !COMMAND_IDS.has(id));
  if (unknownIds.length) throw new Error(`shortcut config contains unknown command id(s): ${unknownIds.join(", ")}`);
  if (options.requireComplete) {
    const missingIds = FLEET_COMMANDS.map((command) => command.id).filter((id) => !(id in rawBindings));
    if (missingIds.length) throw new Error(`shortcut config omits command id(s): ${missingIds.join(", ")}`);
  }

  const bindings: FleetEffectiveBinding[] = [];
  const bindingsByCommand: Record<string, readonly FleetEffectiveBinding[]> = {};
  const signatures = new Map<string, string>();
  for (const command of FLEET_COMMANDS) {
    const configured = rawBindings[command.id] ?? [];
    if (!Array.isArray(configured) || configured.length > MAX_BINDINGS_PER_COMMAND) {
      throw new Error(`bindings.${command.id} must be an array with at most ${MAX_BINDINGS_PER_COMMAND} entries`);
    }
    const commandBindings = configured.map((entry) => parseBinding(command.id, entry));
    for (const binding of commandBindings) {
      const signature = `${binding.kind}|${fleetChordSignature(binding.chord)}`;
      const owner = signatures.get(signature);
      if (owner) throw new Error(`shortcut binding collision between ${owner} and ${command.id}: ${binding.label}`);
      signatures.set(signature, command.id);
      bindings.push(binding);
    }
    bindingsByCommand[command.id] = Object.freeze(commandBindings);
  }
  if (bindings.length > MAX_TOTAL_BINDINGS) throw new Error(`shortcut config exceeds ${MAX_TOTAL_BINDINGS} bindings`);
  const prefixCollision = signatures.get(`direct|${fleetChordSignature(prefix)}`);
  if (prefixCollision) throw new Error(`shortcut prefix collides with direct binding for ${prefixCollision}`);
  return {
    schemaVersion: FLEET_SHORTCUT_SCHEMA_VERSION,
    prefix,
    bindings: Object.freeze(bindings),
    bindingsByCommand: Object.freeze(bindingsByCommand),
  };
}

export function publicFleetShortcutDocument(): FleetShortcutDocument {
  return {
    schemaVersion: FLEET_SHORTCUT_SCHEMA_VERSION,
    prefix: "Ctrl+B",
    bindings: Object.fromEntries(FLEET_COMMANDS.map((command) => [
      command.id,
      [...(FLEET_PUBLIC_DEFAULT_BINDINGS[command.id] ?? [])],
    ])),
  };
}

export interface FleetShortcutEventLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}

export type FleetShortcutRecognition =
  | { kind: "ignored" }
  | { kind: "prefix" }
  | { kind: "cancelled" }
  | { kind: "command"; commandId: FleetCommandId; bindingLabel: string };

function eventChord(event: FleetShortcutEventLike): FleetKeyChord {
  return {
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    label: "",
  };
}

function pureModifier(code: string): boolean {
  return /^(?:Alt|AltLeft|AltRight|Control|ControlLeft|ControlRight|Meta|MetaLeft|MetaRight|Shift|ShiftLeft|ShiftRight)$/.test(code);
}

export interface FleetShortcutRecognizer {
  handle(event: FleetShortcutEventLike): FleetShortcutRecognition;
  cancel(): void;
  pending(): boolean;
}

export function createFleetShortcutRecognizer(
  configuration: FleetShortcutConfiguration,
  now: () => number = Date.now,
  timeoutMs = FLEET_SHORTCUT_PREFIX_TIMEOUT_MS,
): FleetShortcutRecognizer {
  const direct = new Map<string, FleetEffectiveBinding>();
  const prefixed = new Map<string, FleetEffectiveBinding>();
  for (const binding of configuration.bindings) {
    (binding.kind === "direct" ? direct : prefixed).set(fleetChordSignature(binding.chord), binding);
  }
  let pendingSince: number | null = null;
  const boundedTimeout = Math.max(1, Math.min(timeoutMs, FLEET_SHORTCUT_PREFIX_TIMEOUT_MS));
  const cancel = () => { pendingSince = null; };
  return {
    handle(event) {
      if (event.repeat || pureModifier(event.code)) return { kind: "ignored" };
      const current = now();
      if (pendingSince !== null && current - pendingSince >= boundedTimeout) pendingSince = null;
      const signature = fleetChordSignature(eventChord(event));
      if (pendingSince !== null) {
        pendingSince = null;
        if (event.code === "Escape" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          return { kind: "cancelled" };
        }
        const binding = prefixed.get(signature);
        return binding
          ? { kind: "command", commandId: binding.commandId, bindingLabel: `${configuration.prefix.label} ${binding.chord.label}` }
          : { kind: "cancelled" };
      }
      const binding = direct.get(signature);
      if (binding) return { kind: "command", commandId: binding.commandId, bindingLabel: binding.label };
      if (signature === fleetChordSignature(configuration.prefix)) {
        pendingSince = current;
        return { kind: "prefix" };
      }
      return { kind: "ignored" };
    },
    cancel,
    pending: () => pendingSince !== null,
  };
}
