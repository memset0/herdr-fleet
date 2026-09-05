// A command that cannot run right now, and why.
//
// THERE IS A DIFFERENCE BETWEEN A REFUSAL AND A FAILURE, and the operator can feel it. A failure is
// the app breaking: something threw, and all we can honestly say is that the command did not
// complete. A refusal is the app working — the microphone is already open, the clip is still being
// transcribed — and the operator is owed the actual sentence, because it tells them what to do next.
//
// It travels as a thrown error rather than a returned value on purpose. Every adapter is already
// `() => void | Promise<void>`, and widening that to carry an outcome would put a Fleet-shaped return
// type on every call site including the ones in Collie's own components. Throwing costs the refusing
// adapter one line and everyone else nothing.
//
// The message is shown to a person verbatim, so it is a sentence and not a code.

export class CommandRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandRefusal";
  }
}

/** Refuse, with the sentence the operator will read. */
export function refuseCommand(reason: string): never {
  throw new CommandRefusal(reason);
}

/**
 * The refusal's own sentence, or `null` when this was an ordinary failure.
 *
 * Takes the error rather than `unknown`, because a `catch` binding is exactly `Error | null` in
 * practice here — every throw on this path is one — and a caller with something else has an I/O
 * boundary to parse first, not a refusal to read.
 */
export function refusalReason(thrown: Error | null): string | null {
  return thrown instanceof CommandRefusal ? thrown.message : null;
}
