// The state machine behind the keyboard: given key events and the effective bindings, decide whether
// anything was invoked, whether the browser's default must be stopped, and whether a prefix is now
// pending.
//
// It is a plain object over an injected clock, with no DOM and no timers of its own. That is what
// makes the two rules most likely to break here testable without a browser: the pending prefix
// EXPIRES, and the decision to prevent a default has to be synchronous with the event. A machine
// that owned a `setTimeout` would have to be tested by waiting; this one is tested by moving a
// number.
//
// It never registers a listener. The component that mounts it feeds it every keydown from ONE
// capture-phase listener, which is what lets an armed prefix take `Escape`, `Tab` and the arrows
// ahead of the composer without the composer knowing anything about it.

import {
  chordMatchesEvent,
  formatBinding,
  isModifierCode,
  type Binding,
  type Chord,
} from "./bindings.ts";
import type { CommandId } from "./catalog.ts";

/** The two seconds a pending prefix waits. Long enough to be deliberate, short enough to forget. */
export const PREFIX_TIMEOUT_MS = 2000;

/** The fields of a key event this machine reads, and no others. */
export interface RecognizerKeyEvent {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
}

export type RecognizerOutcome =
  /** Not ours. The caller must not prevent anything. */
  | { readonly kind: "ignored" }
  /** The prefix was accepted and is now pending. */
  | { readonly kind: "prefix-armed" }
  /** A pending prefix ended without a command. `prevent` is true only when we consumed the key. */
  | { readonly kind: "prefix-cancelled"; readonly prevent: boolean }
  /** A complete binding matched. */
  | {
      readonly kind: "command";
      readonly id: CommandId;
      readonly binding: Binding;
      /** How the binding actually pressed is spelled, for the acknowledgement. */
      readonly label: string;
    };

export interface RecognizerOptions {
  /** The chord that starts a sequence. */
  readonly prefix: Chord;
  /** How the prefix is spelled, for the acknowledgement's leading half. */
  readonly prefixLabel: string;
  /**
   * The effective bindings, READ AT MATCH TIME rather than captured.
   *
   * A function and not a value, because the operator's document arrives after the first render: a
   * machine that closed over the map it was built with kept matching the shipped defaults forever,
   * and the only reason a changed PREFIX worked was that its own dependency happened to rebuild the
   * machine. Reading them makes that staleness impossible instead of fixed by a dependency list.
   */
  readonly bindings: () => ReadonlyMap<CommandId, readonly Binding[]>;
  readonly now: () => number;
  readonly timeoutMs?: number;
}

export interface Recognizer {
  /** Feed one keydown. The caller prevents the default exactly when this says to. */
  handle: (event: RecognizerKeyEvent) => RecognizerOutcome;
  /** True while a prefix is pending — the caller uses this to arm its capture listener. */
  armed: () => boolean;
  /** Drop a pending prefix. Blur, document hiding and route changes call this. */
  cancel: () => void;
}

/** Whether an outcome means the caller must call `preventDefault()`. */
export function shouldPrevent(outcome: RecognizerOutcome): boolean {
  if (outcome.kind === "command" || outcome.kind === "prefix-armed") return true;
  if (outcome.kind === "prefix-cancelled") return outcome.prevent;
  return false;
}

export function createRecognizer(options: RecognizerOptions): Recognizer {
  const timeout = options.timeoutMs ?? PREFIX_TIMEOUT_MS;
  let armedAt: number | null = null;

  function expired(at: number): boolean {
    return armedAt !== null && at - armedAt > timeout;
  }

  function findBinding(
    event: RecognizerKeyEvent,
    kind: Binding["kind"],
  ): { id: CommandId; binding: Binding } | null {
    for (const [id, bindings] of options.bindings()) {
      for (const binding of bindings) {
        if (binding.kind !== kind) continue;
        if (chordMatchesEvent(binding.chord, event)) return { id, binding };
      }
    }
    return null;
  }

  function label(binding: Binding): string {
    // A prefix binding is spelled as what the operator actually pressed — the prefix chord, a space,
    // then the second chord — rather than the literal word `Prefix`, which names the setting and not
    // the keys.
    if (binding.kind !== "prefix") return formatBinding(binding);
    return `${options.prefixLabel} ${formatBinding({ kind: "direct", chord: binding.chord })}`;
  }

  return {
    armed: () => armedAt !== null,

    cancel: () => {
      armedAt = null;
    },

    handle: (event) => {
      // Auto-repeat is the key still being held, not a second press. It must not fire a command and
      // must not cancel a pending prefix — holding a key down would otherwise cancel the sequence
      // the operator is in the middle of.
      if (event.repeat) return { kind: "ignored" };
      // A modifier's own keydown is part of every chord and the start of none.
      if (isModifierCode(event.code)) return { kind: "ignored" };

      const at = options.now();
      if (expired(at)) armedAt = null;

      if (armedAt !== null) {
        // Re-pressing the prefix restarts the wait rather than cancelling it. Pressing it twice is
        // what a hand does when it is not sure the first one landed.
        if (chordMatchesEvent(options.prefix, event)) {
          armedAt = at;
          return { kind: "prefix-armed" };
        }
        // Escape is the deliberate way out, so it is consumed: it means "never mind", not "send an
        // Escape to whatever is behind me".
        if (
          event.code === "Escape" &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.shiftKey &&
          !event.metaKey
        ) {
          armedAt = null;
          return { kind: "prefix-cancelled", prevent: true };
        }
        const match = findBinding(event, "prefix");
        if (match !== null) {
          armedAt = null;
          return { kind: "command", id: match.id, binding: match.binding, label: label(match.binding) };
        }
        // An unregistered second chord ends the sequence and is NOT consumed: the operator typed
        // something we have no meaning for, and swallowing it would lose a keystroke they meant for
        // the surface underneath.
        armedAt = null;
        return { kind: "prefix-cancelled", prevent: false };
      }

      // Unarmed. The prefix is checked first so that a document which also binds the prefix chord
      // directly cannot silently make the prefix unreachable; the settings validator rejects that
      // collision, and this ordering is what keeps the failure recoverable if one ever slips through.
      if (chordMatchesEvent(options.prefix, event)) {
        armedAt = at;
        return { kind: "prefix-armed" };
      }

      const direct = findBinding(event, "direct");
      if (direct !== null) {
        return { kind: "command", id: direct.id, binding: direct.binding, label: label(direct.binding) };
      }

      return { kind: "ignored" };
    },
  };
}
