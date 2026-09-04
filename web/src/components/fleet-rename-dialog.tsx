import { useState } from "react";

import { FleetPromptPanel } from "@/components/fleet-prompt-panel";
import { useLocale } from "@/hooks/use-locale";
import * as api from "@/lib/api";
import { describeApiError, describeThrownError } from "@/lib/api-error-message";
import { t } from "@/lib/i18n";
import type { Scope } from "@/lib/scope";
import { setStatus } from "@/lib/status";

/**
 * Renaming, where the keyboard is.
 *
 * The row-actions surface already renames, and this is deliberately not it. A rename begun from the
 * keyboard has to put its field where the operator is already looking — the command bar's own
 * position — rather than sliding a thumb-sized surface up from the bottom edge. Closing keeps that
 * surface for the pointer, because a close needs the blast-radius confirmation it already is.
 *
 * What this does NOT reinvent is the meaning. It calls the same client functions that surface calls,
 * and keeps each target's existing rule for a blank value: a Tab must be named, and a Pane's blank
 * clears its label. Two call sites for one function is the ordinary shape of two surfaces offering
 * one action; driving the other one's private rename mode from outside would be far worse.
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isTab = target.kind === "tab";
  const title = t(isTab ? "fleet.rename.tab" : "fleet.rename.pane");

  const submit = async (value: string) => {
    if (saving) return;
    const trimmed = value.trim();
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
    <FleetPromptPanel
      title={title}
      initialValue={target.label}
      hint={t("fleet.rename.hint")}
      error={error}
      busy={saving}
      onClose={onClose}
      onSubmit={(value) => void submit(value)}
    />
  );
}
