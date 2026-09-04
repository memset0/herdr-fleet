import { FleetPromptPanel } from "@/components/fleet-prompt-panel";
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
 *
 * `y/N` IS PART OF THE QUESTION, in the heading. In front of the field it read as a prefix of what
 * you were typing, and an operator who selects-all and types had to work out whether it would be
 * replaced.
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
  return (
    <FleetPromptPanel
      title={`${title} ${t("fleet.confirm.prompt")}`}
      detail={detail}
      initialValue="y"
      hint={t("fleet.confirm.hint")}
      onClose={onClose}
      onSubmit={(value) => {
        // Trimmed and case-insensitive, and compared against the one answer that means yes.
        if (value.trim().toLowerCase() === "y") onConfirm();
        onClose();
      }}
    />
  );
}
