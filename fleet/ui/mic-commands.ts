// What the microphone commands do, and when they refuse.
//
// PURE, AND HERE, because the alternative is guard clauses inside Collie's composer — an upstream
// file, where downstream logic does not belong and where nothing can test it without a browser, a
// MediaRecorder and a provider. What crosses the boundary is a decision; the composer reads it and
// calls the recorder it already owns.
//
// THE REFUSAL IS THE INTERESTING HALF. A button that cannot be pressed says so by being disabled,
// and a key has no disabled state to look at — so every condition that greys the microphone button
// out becomes a sentence instead, and the operator is told which one they hit. A refusal changes
// nothing: it is a statement about the world, not an attempt at the action.

/** The recorder's phase, as Collie's own hook reports it. */
export type MicPhase = "idle" | "requesting" | "recording" | "transcribing";

/** Everything the decision depends on, read at the moment the command runs. */
export interface MicConditions {
  /** Whether there is a provider AND a browser that can record. `false` is the feature being off. */
  readonly available: boolean;
  /** The composer is locked: a gone Pane, a read-only Pane, a host block, the idle pause. */
  readonly locked: boolean;
  /** Type-into-terminal is armed, which owns the composer's input while it is. */
  readonly directTyping: boolean;
  /** A guarded send is in flight. */
  readonly sending: boolean;
  readonly phase: MicPhase;
}

export type MicCommand = "start" | "stop" | "toggle";

/** Why a microphone command did nothing. The caller turns it into the operator's own language. */
export type MicRefusal =
  | "absent"
  | "locked"
  | "direct"
  | "sending"
  | "transcribing"
  | "already-recording"
  | "not-recording";

export type MicDecision =
  | { readonly kind: "start" }
  | { readonly kind: "stop" }
  | { readonly kind: "refuse"; readonly refusal: MicRefusal };

/**
 * What a microphone command should do right now.
 *
 * The order of the checks is the order the operator would want to hear about them: the ones that are
 * about the whole feature first, then the ones about this moment, then the one about this particular
 * command. Being told "the microphone is already recording" when the real problem is that there is
 * no microphone would send them looking in the wrong place.
 *
 * `transcribing` REFUSES THE TOGGLE rather than picking whichever half is legal. A clip in flight is
 * a transcript the operator is still owed; starting a second one abandons it, and stopping something
 * that is not recording is not a thing. A toggle whose two halves are both refused is refused.
 */
function refuse(refusal: MicRefusal): MicDecision {
  return { kind: "refuse", refusal };
}

export function decideMicCommand(command: MicCommand, conditions: MicConditions): MicDecision {
  if (!conditions.available) return refuse("absent");
  if (conditions.locked) return refuse("locked");
  if (conditions.directTyping) return refuse("direct");
  if (conditions.sending) return refuse("sending");
  if (conditions.phase === "transcribing") return refuse("transcribing");

  const recording = conditions.phase === "recording";
  if (command === "toggle") return recording ? { kind: "stop" } : { kind: "start" };
  if (command === "start") return recording ? refuse("already-recording") : { kind: "start" };
  return recording ? { kind: "stop" } : refuse("not-recording");
}
