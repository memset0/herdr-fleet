import { useEffect, useRef, useState } from "react";

import { FleetPanel } from "@/components/fleet-panel";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/**
 * The question a close asks, in the terminal's own shape.
 *
 * A close begun with a key is finished with a key — but not with ONE key. Closing a Tab kills every
 * Pane in it, and a command that fires the moment its chord lands is a command a mistyped sequence
 * can spend. So: a question, a default, and Enter.
 *
 * ONLY `y` CLOSES. Not "not `n`", which would close on a typo; not a truthiness test, which would
 * close on anything non-empty. A close is the one place where an answer nobody recognises has to
 * mean no.
 *
 * The `y` is prefilled and selected, and that is not a contradiction of making the safe answer easy:
 * the safe answer is still whatever you get by typing literally anything over the selection. What the
 * prefill buys is that the common case — you meant it — costs one keystroke.
 */

export interface FleetConfirmDialogProps {
  /** What is being closed, already named for a person. */
  readonly title: string;
  /** What closing it costs, in one line. */
  readonly detail: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function FleetConfirmDialog({ title, detail, onConfirm, onClose }: FleetConfirmDialogProps) {
  useLocale();
  const [value, setValue] = useState("y");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    input.select();
  }, []);

  const submit = () => {
    // Trimmed and case-insensitive, and compared against the one answer that means yes.
    if (value.trim().toLowerCase() === "y") onConfirm();
    onClose();
  };

  return (
    <FleetPanel open onClose={onClose} label={title}>
      <div data-slot="fleet-confirm-dialog" className="flex flex-col">
        <div className="border-b border-rule px-3 pb-1.5 pt-2">
          <div className="text-sm font-medium">{title}</div>
          <p className="text-[11px] text-muted-foreground">{detail}</p>
        </div>
        <div className="flex items-center gap-2 px-3">
          {/* The prompt spells the default in its capitalisation, which is the whole convention: the
              safe answer is the one you get without aiming. */}
          <span className="shrink-0 font-mono text-sm text-muted-foreground">
            {t("fleet.confirm.prompt")}
          </span>
          <input
            ref={inputRef}
            type="text"
            aria-label={t("fleet.confirm.prompt")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            className="h-12 w-full bg-transparent font-mono text-sm outline-none"
          />
        </div>
        <p className="border-t border-rule px-3 py-2 text-[11px] text-muted-foreground">
          {t("fleet.confirm.hint")}
        </p>
      </div>
    </FleetPanel>
  );
}
