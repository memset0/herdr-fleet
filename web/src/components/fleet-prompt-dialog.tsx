import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

/**
 * THE QUESTION A MENU CANNOT ASK.
 *
 * A menu is a list of verbs in a 224px box pinned to a coordinate. The moment one of those verbs
 * needs an answer typed into it, the surface is the wrong shape and the wrong place: a field pinned
 * to wherever the cursor happened to be is a field the eye has to go and find, and a box sized for
 * one-word rows is a box a name does not fit in. So the question stands in the middle of the screen,
 * over a scrim, which is where every application on the operator's machine puts one.
 *
 * It is DELIBERATELY GENERIC — a label, a value, a confirm — rather than a rename dialog. Renaming a
 * Pane and renaming a Tab are already two callers, and the next surface that has to ask for one line
 * of text (a shortcut's own binding, say) is a third; a dialog that knew what a Pane was would be a
 * dialog that had to learn what everything else is.
 *
 * The bottom sheet asks the same question a different way and keeps doing so, untouched: Collie's
 * `RenameView` is a step INSIDE the sheet, which is right for a thumb — the answer arrives where the
 * question was, with the keyboard already coming up.
 */

export interface FleetPromptDialogProps {
  open: boolean;
  /** What is being named — the dialog's heading and its accessible name. */
  title: string;
  /** The field's own label. */
  label: string;
  placeholder?: string;
  /** The value to open with. Re-read every time the dialog opens, never while it stands. */
  initialValue: string;
  /** False while an empty value cannot be saved — a Tab's name, which the bridge stores literally. */
  allowEmpty?: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function FleetPromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue,
  allowEmpty = true,
  saving = false,
  onCancel,
  onSubmit,
}: FleetPromptDialogProps) {
  useLocale();
  const [value, setValue] = useState(initialValue);
  const field = useRef<HTMLInputElement>(null);

  // Reprefilled on every OPEN and never while standing, so a poll landing mid-edit cannot clobber
  // what is being typed — the same rule Collie's own rename step keeps, and for the same reason.
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // SAFETY: `document.activeElement` is typed `Element | null` and only its optional `focus()` is
    // read back, which is what covers an element that has none.
    const previous = document.activeElement as HTMLElement | null;
    field.current?.focus();
    field.current?.select();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = value.trim();
  const canSave = !saving && (allowEmpty || trimmed.length > 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    onSubmit(trimmed);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* The scrim DOES dim here, and that is the difference from the menu: a question has taken the
          screen over until it is answered, and the page behind it is out of play. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 duration-200 animate-in fade-in"
      />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-md border border-rule bg-card p-4 shadow-2xl duration-150 animate-in fade-in"
      >
        <p className="truncate text-sm font-semibold">{title}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <input
            ref={field}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            // The field is Collie's own: same height, same radius, same ring, same ground as the
            // sheet's rename step, so the two ways of asking look like one question.
            className="h-11 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="h-9">
            {t("dialog.cancel")}
          </Button>
          <Button type="submit" disabled={!canSave} className="h-9">
            {saving ? <Loader2 className="size-4 animate-spin" /> : t("actionSheet.save")}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
