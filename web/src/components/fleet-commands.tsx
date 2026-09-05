import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Binding } from "../../../fleet/ui/commands/bindings.ts";
import { parseBinding } from "../../../fleet/ui/commands/bindings.ts";
import {
  DEFAULT_COMMAND_PREFIX,
  commandById,
  type CommandDefinition,
  type CommandId,
  type CommandScope,
} from "../../../fleet/ui/commands/catalog.ts";
import { commandRows, resolveBindings, type CommandRow } from "../../../fleet/ui/commands/effective.ts";
import { prefixHints, type PrefixHints } from "../../../fleet/ui/commands/prefix-hints.ts";
import { refusalReason } from "../../../fleet/ui/commands/refusal.ts";
import {
  createRecognizer,
  shouldPrevent,
  PREFIX_TIMEOUT_MS,
  type Recognizer,
} from "../../../fleet/ui/commands/recognizer.ts";
import type { PaneRoster, RosterEntry } from "../../../fleet/ui/pane-roster.ts";
import { FleetCommandBar, type CommandBarMode } from "@/components/fleet-command-bar";
import { FleetPrefixHints } from "@/components/fleet-prefix-hints";
import {
  captureComposerCaret,
  noteComposition,
  parkCaretForPrefix,
  parkedCaretForPrefix,
  returnFocusToComposer,
  unparkCaretForPrefix,
} from "@/lib/fleet-composer-focus";
import { t } from "@/lib/i18n";
import { setStatus } from "@/lib/status";

/**
 * The keyboard layer's one mount point: it holds the effective bindings, owns the single capture
 * listener, dispatches every invocation, and stands the command bar up.
 *
 * WHY ONE PROVIDER AND NOT A HOOK PER SURFACE. Every command has to reach the same dispatcher
 * whether it came from a key, the bar, or a control, because that is what makes "one allowlisted
 * action per command" true rather than aspirational. A hook per caller would be a second dispatch
 * path the first time someone was in a hurry.
 */

/** Where an invocation came from. It decides only what the acknowledgement says. */
export type CommandSource = "shortcut" | "ui";

/** What a command actually does. Registered by the surface that owns the action, never by a key. */
export type CommandAdapter = () => void | Promise<void>;

export type CommandAdapters = Partial<Record<CommandId, CommandAdapter>>;

export interface FleetCommandsValue {
  /** Run a command through the one dispatcher. `bindingLabel` is set only by the recognizer. */
  invoke: (id: CommandId, source: CommandSource, bindingLabel?: string) => void;
  /**
   * Contribute the adapters a mounted surface owns, and take them away when it unmounts.
   *
   * This is the seam the Pane-scoped commands travel through. The shell cannot own `fit-pane-width`
   * or a key send — the geometry and the pane's own writer live on the Pane page — and the
   * alternative, threading a callback down through four components, would put a Fleet-shaped prop on
   * every one of them. A registration is exactly as narrow as the command it registers.
   */
  register: (lookup: () => CommandAdapters) => () => void;
  /** Every command with its effective bindings, in catalog order. */
  rows: readonly CommandRow[];
  /** Whether this command has somewhere to act right now. */
  isAvailable: (command: CommandDefinition) => boolean;
  openBar: (mode: CommandBarMode) => void;
}

const FleetCommandsContext = createContext<FleetCommandsValue | null>(null);

/**
 * The commands whose whole effect is something the operator is already looking at.
 *
 * Navigating somewhere ANSWERS itself: the new Pane is on screen, and a floating note saying which
 * key you pressed is a second copy of a fact the screen already carries. `DESIGN.md` §11 puts
 * success on the floating channel only "when the outcome is not visible at the point of action",
 * and for these it is.
 *
 * Everything not listed here does something the screen does not obviously show — a resize, a mode
 * flip, a key sent into a terminal, a link on the clipboard — and those say so.
 */
function isSelfEvident(id: CommandId): boolean {
  if (id.startsWith("select-tab-") || id.startsWith("select-agent-")) return true;
  return (
    id === "open-command-bar" ||
    id === "open-pane-switcher" ||
    id === "open-fleet-settings" ||
    id === "toggle-fleet-sidebars" ||
    id === "next-tab" ||
    id === "previous-tab" ||
    id === "create-tab" ||
    id === "next-pane-in-tab" ||
    id === "previous-pane-in-tab" ||
    id === "next-pane" ||
    id === "previous-pane" ||
    id === "last-pane" ||
    id === "next-agent" ||
    id === "previous-agent" ||
    id === "rename-tab" ||
    id === "rename-pane" ||
    // Opening a surface IS the answer: the sheet is on screen, and a note saying which key opened it
    // would be a second copy of what the operator is already looking at.
    id === "close-tab" ||
    id === "close-pane"
  );
}

/**
 * The commands that leave the operator looking at a DIFFERENT draft.
 *
 * The distinction only decides where the caret lands afterwards: an offset captured in the composer
 * of the pane you were on means nothing in the composer of the pane you are on now, so these end at
 * the end of the field and everything else goes back where it was. A close counts — the pane it
 * closed is not the pane the app falls back to.
 */
function movesPane(id: CommandId): boolean {
  if (id.startsWith("select-tab-") || id.startsWith("select-agent-")) return true;
  return (
    id === "create-tab" ||
    id === "next-tab" ||
    id === "previous-tab" ||
    id === "close-tab" ||
    id === "next-pane-in-tab" ||
    id === "previous-pane-in-tab" ||
    id === "close-pane" ||
    id === "next-pane" ||
    id === "previous-pane" ||
    id === "last-pane" ||
    id === "next-agent" ||
    id === "previous-agent"
  );
}

export interface FleetCommandsProviderProps {
  /** The actions, supplied by whichever surface owns each one. */
  adapters: CommandAdapters;
  /** Whether a scope has a target right now — resolved once, before any adapter runs. */
  available: (scope: CommandScope) => boolean;
  /** The roster the Pane mode snapshots when it opens. */
  roster: PaneRoster;
  onOpenPane: (entry: RosterEntry) => void;
  /** The operator's own bindings, when a settings document has replaced any. */
  overrides?: ReadonlyMap<CommandId, readonly Binding[]>;
  /** The configured prefix, spelled as the operator writes it. */
  prefix?: string;
  children: ReactNode;
}

/**
 * How long a pending prefix waits before it offers help.
 *
 * Out of the recognizer's two-second budget, which leaves 1.6s of visibility — the part that has to
 * be usable. It is also comfortably longer than a deliberate two-key sequence takes to type, so an
 * operator who knows the key never learns this panel exists, which is the whole point of the delay:
 * showing it instantly would flash it a hundred times a day to tell somebody what they already know.
 */
const PREFIX_HINT_DELAY_MS = 400;

export function FleetCommandsProvider({
  adapters,
  available,
  roster,
  onOpenPane,
  overrides,
  prefix = DEFAULT_COMMAND_PREFIX,
  children,
}: FleetCommandsProviderProps) {
  const [bar, setBar] = useState<CommandBarMode | null>(null);
  // `null` unless a prefix has been pending long enough to be worth helping with.
  const [pending, setPending] = useState<PrefixHints | null>(null);

  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);
  // A prefix that does not parse falls back to the shipped one rather than leaving the operator with
  // no prefix at all; the settings document's own validation is where a bad value is reported.
  const prefixChord = useMemo(() => {
    const parsed = parseBinding(prefix);
    if (parsed.ok) return { chord: parsed.binding.chord, label: prefix };
    const shipped = parseBinding(DEFAULT_COMMAND_PREFIX);
    return {
      chord: shipped.ok ? shipped.binding.chord : null,
      label: DEFAULT_COMMAND_PREFIX,
    };
  }, [prefix]);

  const rows = useMemo(
    () => commandRows(bindings, prefixChord.label),
    [bindings, prefixChord.label],
  );

  const isAvailable = useCallback(
    (command: CommandDefinition) => available(command.scope),
    [available],
  );

  // Read through a ref inside the listener so the recognizer is built once and never re-registered
  // mid-keystroke: a listener rebuilt on every render would drop a pending prefix each time the
  // snapshot polled.
  const latest = useRef({ adapters, available, bindings });
  latest.current = { adapters, available, bindings };

  const openBar = useCallback((mode: CommandBarMode) => setBar(mode), []);

  // Layers, newest first. A ref rather than state: a Pane page mounting must not re-render the whole
  // shell, and the dispatcher reads this at invocation time anyway.
  const layers = useRef<(() => CommandAdapters)[]>([]);
  const register = useCallback((lookup: () => CommandAdapters) => {
    layers.current = [lookup, ...layers.current];
    return () => {
      layers.current = layers.current.filter((entry) => entry !== lookup);
    };
  }, []);

  const invoke = useCallback(
    (id: CommandId, source: CommandSource, bindingLabel?: string) => {
      const command = commandById(id);
      const current = latest.current;
      // READ FIRST, before anything runs. The keydown that brought us here is still the event being
      // dispatched, so the composer is still holding the caret the operator pressed the key with;
      // one `await` later it is on `body` and the offset is gone.
      //
      // A PREFIX SEQUENCE ALREADY TOOK IT. While a prefix is armed the caret is parked off the
      // composer, so the live read here would answer `null` and every prefix command would land at
      // the end of the field instead of where the operator was. The arm's own capture is preferred
      // wherever there is one; a direct chord parked nothing and the live read is the accurate one.
      const caret = parkedCaretForPrefix() ?? captureComposerCaret();

      if (id === "open-command-bar" || id === "open-pane-switcher") {
        setBar(id === "open-command-bar" ? "command" : "pane");
        return;
      }

      if (!current.available(command.scope)) {
        setStatus(t("fleet.command.unavailable", { name: command.name }), "warn");
        return;
      }
      const adapter =
        layers.current.map((layer) => layer()[id]).find((entry) => entry !== undefined) ??
        current.adapters[id];
      if (adapter === undefined) {
        setStatus(t("fleet.command.unavailable", { name: command.name }), "warn");
        return;
      }

      void (async () => {
        let refused: string | null = null;
        let failed = false;
        try {
          await adapter();
        } catch (thrown) {
          // A REFUSAL IS NOT A FAILURE. The command decided it could not run and said why in a
          // sentence meant for a person; anything else is the app breaking, and all we can honestly
          // report for that is that the command did not complete.
          refused = refusalReason(thrown instanceof Error ? thrown : null);
          failed = refused === null;
        }
        // Both ways. A command that threw moved nothing, and the caret it took is owed back just as
        // much as one that worked.
        //
        // `unpark` first and unconditionally: it clears the parked state whether or not a prefix was
        // involved, and hands the same offset to the same restore path, so there is one return and
        // not two racing each other.
        const mode = movesPane(id) ? "end" : "restore";
        unparkCaretForPrefix(mode);
        returnFocusToComposer(caret, mode);
        if (refused !== null) {
          // The command's own words, on the error channel, and nothing else happened.
          setStatus(refused, "error");
          return;
        }
        if (failed) {
          // The action's own surface reports what went wrong where it can; this is the floor, so a
          // thrown adapter still tells the operator their key did not do the thing.
          setStatus(t("fleet.command.failed", { name: command.name }), "error");
          return;
        }
        if (isSelfEvident(id)) return;
        const label =
          source === "shortcut" && bindingLabel !== undefined
            ? `${bindingLabel} · ${command.name}`
            : command.name;
        setStatus(label, "success");
      })();
    },
    [],
  );

  // ONE capture-phase listener, for the life of the provider. Capture is the whole of the focus
  // arbitration: the composer's direct-typing mode reads its keys in the textarea's own bubble-phase
  // handler, so this runs first without the composer knowing anything about it.
  const recognizer = useRef<Recognizer | null>(null);
  useEffect(() => {
    const chord = prefixChord.chord;
    if (chord === null) return;
    const machine = createRecognizer({
      prefix: chord,
      prefixLabel: prefixChord.label,
      bindings: () => latest.current.bindings,
      now: () => Date.now(),
    });
    recognizer.current = machine;

    let hintTimer: ReturnType<typeof setTimeout> | null = null;
    // Parking's OWN timer, and it has to be its own: the recognizer's two-second expiry is noticed on
    // the next key, which is right for a pure machine over an injected clock and useless here — an
    // operator who arms the prefix and then walks away produces no next key, and the caret would stay
    // parked for as long as the page is open.
    let parkTimer: ReturnType<typeof setTimeout> | null = null;
    const forgetHints = () => {
      if (hintTimer !== null) clearTimeout(hintTimer);
      hintTimer = null;
      setPending(null);
    };
    const endPark = (mode: "restore" | "end") => {
      if (parkTimer !== null) clearTimeout(parkTimer);
      parkTimer = null;
      unparkCaretForPrefix(mode);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const outcome = machine.handle(event);
      // Every outcome ends the previous wait. `prefix-armed` then starts a new one — including when
      // the operator presses the prefix twice, which restarts the recognizer's clock too.
      forgetHints();
      if (outcome.kind === "prefix-armed") {
        // The caret goes somewhere an input method cannot compose into, for as long as the sequence
        // is pending. `parkCaretForPrefix` is idempotent, so a second press does not overwrite the
        // offset it took on the first.
        parkCaretForPrefix();
        if (parkTimer !== null) clearTimeout(parkTimer);
        parkTimer = setTimeout(() => endPark("restore"), PREFIX_TIMEOUT_MS);
        hintTimer = setTimeout(
          () => setPending(prefixHints(latest.current.bindings)),
          PREFIX_HINT_DELAY_MS,
        );
      } else if (outcome.kind !== "command") {
        // Escape, an unregistered second chord, or a key that was never part of a sequence. The
        // caret goes back where it was; an unregistered chord's own character is lost, which is the
        // accepted cost of having preempted the input method (see the requirement).
        endPark("restore");
      }
      // Synchronously, in the event. Anything deferred here lets the browser print, reload, or type
      // the character before we have decided we wanted it.
      if (shouldPrevent(outcome)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (outcome.kind === "command") {
        // The dispatcher reads the parked caret and then returns it, so the park is released without
        // moving anything here — `invoke` owns the restore, including the end-of-field rule for a
        // command that moved the operator.
        if (parkTimer !== null) clearTimeout(parkTimer);
        parkTimer = null;
        invoke(outcome.id, "shortcut", outcome.label);
      }
    };
    const drop = () => {
      machine.cancel();
      forgetHints();
      // The page stopped receiving keys, so the sequence is over whether or not a key says so.
      endPark("restore");
    };

    // Keyup decides nothing. It is only how the machine lets go of a modifier it recorded, which is
    // what keeps a sided chord from matching long after that side was released.
    const onKeyUp = (event: KeyboardEvent) => machine.release(event);
    // The two events that say an input method is mid-word. Owned here rather than ported into the
    // composer: they bubble, and the layer that already holds a document-level key listener can hold
    // these without anything upstream changing.
    const onCompositionStart = () => noteComposition(true);
    const onCompositionEnd = () => noteComposition(false);

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    window.addEventListener("blur", drop);
    document.addEventListener("visibilitychange", drop);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
      window.removeEventListener("blur", drop);
      document.removeEventListener("visibilitychange", drop);
      forgetHints();
      // UNPARK, not just cancel the timer. A provider torn down while a prefix was pending would
      // otherwise leave the caret standing on an element nothing can type into, with no listener
      // left alive to ever give it back.
      endPark("restore");
      recognizer.current = null;
    };
  }, [prefixChord, invoke]);

  const value = useMemo<FleetCommandsValue>(
    () => ({ invoke, rows, isAvailable, openBar, register }),
    [invoke, rows, isAvailable, openBar, register],
  );

  return (
    <FleetCommandsContext.Provider value={value}>
      {children}
      <FleetPrefixHints
        hints={pending}
        prefixLabel={prefixChord.label}
        isAvailable={available}
      />
      <FleetCommandBar
        mode={bar}
        onClose={() => setBar(null)}
        rows={rows}
        isAvailable={isAvailable}
        roster={roster}
        onRun={(id) => invoke(id, "ui")}
        onOpenPane={(entry) => {
          onOpenPane(entry);
          // The switcher's own field had the caret; the pane it just chose gets it, at the end.
          returnFocusToComposer(null, "end");
        }}
      />
    </FleetCommandsContext.Provider>
  );
}

/** The command layer, or `null` outside it — Collie's own tests and playground mount neither. */
export function useFleetCommands(): FleetCommandsValue | null {
  return useContext(FleetCommandsContext);
}

/**
 * Register a surface's own adapters for as long as it is mounted.
 *
 * A no-op outside the command layer, which is what lets Collie's own tests and its playground mount
 * the Pane page and the composer exactly as they always have.
 *
 * WHAT IS REGISTERED IS A LOOKUP, not the object. A page that owns Pane-scoped commands must hold
 * live closures over the pane it is displaying, so its adapter object is a fresh one every render;
 * registering the object itself would then unregister and re-register on every poll. Registering a
 * stable function that reads the latest one costs nothing and cannot go stale.
 */
export function useFleetCommandAdapters(adapters: CommandAdapters): void {
  const commands = useContext(FleetCommandsContext);
  const register = commands?.register;
  const latest = useRef(adapters);
  latest.current = adapters;
  useEffect(() => {
    if (register === undefined) return;
    return register(() => latest.current);
  }, [register]);
}
