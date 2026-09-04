import { useEffect, useRef, useState } from "react";

import { FleetPanel } from "@/components/fleet-panel";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

/**
 * Every question the keyboard asks, asked the same way.
 *
 * Two surfaces needed one line of text — a name, an answer — and each had grown its own copy of the
 * heading, the focused-and-selected field, the Enter/Escape handling and the reserved footer line.
 * Two places is where a pattern gets promoted; the third would have been three spellings of the same
 * question.
 *
 * THE SEAM IS THE SUBMITTED STRING, and deliberately nothing more. Everything above it is
 * presentation and is written once here; everything below it — whether a blank clears a label,
 * whether an answer has to be `y` — stays with the caller, because those really are different and a
 * shared component that knew about them would need a mode flag per caller.
 *
 * THE INITIAL VALUE IS AN INITIAL VALUE. It is read once and never watched, and callers mount one
 * panel per target with a `key`. That is what stops a poll landing a fresh label on top of a
 * half-typed name — a rule the rename input had to discover, and which every later caller now gets
 * without having to learn it.
 */

export interface FleetPromptPanelProps {
  /** What is being asked. A confirmation puts its default answer here, beside the question. */
  readonly title: string;
  /** One line under it saying what this costs. Omitted where there is no cost to state. */
  readonly detail?: string;
  readonly initialValue: string;
  /** The resting text of the reserved line. */
  readonly hint: string;
  /** A validation error or a refused mutation, shown in that same line instead of the hint. */
  readonly error?: string | null;
  readonly busy?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function FleetPromptPanel({
  title,
  detail,
  initialValue,
  hint,
  error = null,
  busy = false,
  onSubmit,
  onClose,
}: FleetPromptPanelProps) {
  useLocale();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    // Selected, not just focused: an operator opening this means to REPLACE what is in it far more
    // often than to edit it, and a caret at the end makes the common case start with a select-all.
    input.select();
  }, []);

  return (
    <FleetPanel open onClose={onClose} label={title}>
      <div data-slot="fleet-prompt-panel" className="flex flex-col">
        <div className="border-b border-rule px-3 pb-1.5 pt-2">
          <div className="text-sm font-medium">{title}</div>
          {detail !== undefined && detail !== "" && (
            <p className="text-[11px] text-muted-foreground">{detail}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          aria-label={title}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit(value);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          className="h-12 w-full bg-transparent px-3 text-sm outline-none"
        />
        {/* One reserved line, so a refusal appearing does not resize the panel (DESIGN.md §2). */}
        <p
          className={cn(
            "min-h-8 border-t border-rule px-3 py-2 text-[11px]",
            error === null ? "text-muted-foreground" : "text-status-blocked",
          )}
          role={error === null ? undefined : "alert"}
        >
          {error ?? hint}
        </p>
      </div>
    </FleetPanel>
  );
}
