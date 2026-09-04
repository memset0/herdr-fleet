import { useEffect, useRef, useState } from "react";

import { FleetPanel } from "@/components/fleet-panel";
import { useLocale } from "@/hooks/use-locale";
import * as api from "@/lib/api";
import { describeApiError, describeThrownError } from "@/lib/api-error-message";
import { t } from "@/lib/i18n";
import type { Scope } from "@/lib/scope";
import { setStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Renaming, where the keyboard is.
 *
 * The action sheet already renames, and this is deliberately not it. A rename begun from the
 * keyboard has to put its field where the operator is already looking — the command bar's own
 * position, on the command bar's own panel — rather than sliding a thumb-sized surface up from the
 * bottom edge of the screen. Closing keeps the sheet, because a close needs the blast-radius
 * confirmation the sheet already is; there is nothing about Enter that makes a destructive
 * confirmation better in the middle of the screen.
 *
 * What it does NOT reinvent is the meaning. It calls the same client functions the sheet calls, and
 * keeps each target's existing rule for a blank value: a Tab must be named, and a Pane's blank
 * clears its label. Two call sites for one function is the ordinary shape of two surfaces offering
 * one action; driving the sheet's private rename mode from outside would be far worse.
 */

export type RenameTarget =
  | { readonly kind: "tab"; readonly tabId: string; readonly label: string }
  | { readonly kind: "pane"; readonly paneId: string; readonly label: string };

export interface FleetRenameDialogProps {
  /** The exact object being renamed. The caller mounts this per target and unmounts it to close. */
  target: RenameTarget;
  scope: Scope | undefined;
  onClose: () => void;
  onRenamed: () => void;
}

export function FleetRenameDialog({ target, scope, onClose, onRenamed }: FleetRenameDialogProps) {
  useLocale();
  // THE PREFILL IS AN INITIAL VALUE, not an effect, and the caller mounts one of these per target
  // (`key`). That is what stops a poll landing a fresh label on top of a half-typed name: this
  // component never learns the label changed, because the name it is editing is the one it opened
  // with.
  const [value, setValue] = useState(target.label);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    // Selected, not just focused: the operator opened this to REPLACE a name far more often than to
    // edit one, and a caret at the end would make the common case start with a select-all.
    input.select();
  }, []);

  const isTab = target.kind === "tab";
  const trimmed = value.trim();

  const submit = async () => {
    if (saving) return;
    // A Tab must be named; a Pane's blank is Collie's own "clear the label" and is sent as one.
    if (isTab && trimmed === "") {
      setError(t("fleet.rename.blank"));
      return;
    }
    setSaving(true);
    try {
      const result = isTab
        ? await api.renameTab(target.tabId, trimmed, scope)
        : await api.renamePane(target.paneId, trimmed, scope);
      if (result.ok) {
        setStatus(
          isTab
            ? t("space.tab.renamed")
            : trimmed === ""
              ? t("paneActions.status.labelCleared")
              : t("paneActions.status.renamed"),
          "success",
        );
        onRenamed();
        onClose();
        return;
      }
      setError(describeApiError(result, t("space.tab.renameFailed")));
    } catch (thrown) {
      setError(describeThrownError(thrown));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FleetPanel open onClose={onClose} label={t(isTab ? "fleet.rename.tab" : "fleet.rename.pane")}>
      <div data-slot="fleet-rename-dialog" className="flex flex-col">
        <div className="border-b border-rule px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(isTab ? "fleet.rename.tab" : "fleet.rename.pane")}
        </div>
        <input
          ref={inputRef}
          type="text"
          aria-label={t(isTab ? "fleet.rename.tab" : "fleet.rename.pane")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          disabled={saving}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          className="h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        {/* One reserved line, so an error appearing does not resize the panel (DESIGN.md §2). */}
        <p
          className={cn(
            "min-h-8 border-t border-rule px-3 py-2 text-[11px]",
            error === null ? "text-muted-foreground" : "text-status-blocked",
          )}
          // The message is a refusal, and the panel is the only place it can be read.
          role={error === null ? undefined : "alert"}
        >
          {error ?? t("fleet.rename.hint")}
        </p>
      </div>
    </FleetPanel>
  );
}
