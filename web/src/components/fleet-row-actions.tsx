import { Maximize2, Monitor, Pencil, Plus, ScrollText, Search, XCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import { pointerMenuGestures } from "../../../fleet/ui/pointer-menu.ts";
import type { MenuPoint } from "../../../fleet/ui/menu-placement.ts";
import {
  FleetContextMenu,
  FleetMenuDestructiveItem,
  FleetMenuItem,
} from "@/components/fleet-context-menu";
import { FleetPromptDialog } from "@/components/fleet-prompt-dialog";
import { ActionRow } from "@/components/action-sheet-rows";
import { BottomSheet } from "@/components/ui/sheet";
import { useSpaceActions } from "@/hooks/use-spaces";
import { PaneActionsSheet } from "@/components/pane-actions-sheet";
import { TabActionsSheet } from "@/components/tab-actions-sheet";
import { useHostWriteBlock, usePack } from "@/components/pack-provider";
import { useActionEcho } from "@/hooks/use-action-echo";
import { useLocale } from "@/hooks/use-locale";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import * as api from "@/lib/api";
import { describeApiError, describeThrownError } from "@/lib/api-error-message";
import { t, tn } from "@/lib/i18n";
import { useMuxCapability, useMuxName } from "@/lib/mux-capability";
import { setStatus } from "@/lib/status";
import { paneDisplayName } from "@/lib/types";

/**
 * WHICH SURFACE ANSWERS A ROW'S ACTIONS — decided here, at the invoke site, and nowhere else.
 *
 * There are two, and they are two COMPONENTS rather than one component in two poses:
 *
 *   · Collie's own `PaneActionsSheet` / `TabActionsSheet` — the bottom sheet, untouched, for a
 *     device with a thumb. Everything about it is upstream's and stays upstream's.
 *   · The fork's `FleetContextMenu` — a pointer's context menu at the cursor, with the fork's own
 *     density, its own dismissal, and a fade rather than a scale.
 *
 * One component wearing both costumes was tried and reverted: the sheet's own chrome and its
 * entrance are correct FOR A SHEET, and every attempt to make them behave at a cursor was another
 * branch inside a primitive that six other surfaces share. Two components, chosen once, right here,
 * leaves that primitive exactly as upstream wrote it.
 *
 * WHAT IS DUPLICATED, AND WHAT IS NOT. The menu composes its own rows, because a menu's rows are its
 * own. It does NOT re-decide anything: the capability gates, the host write block, the two-tap
 * confirm, the press echo, the API calls and every status string are the same ones the sheet uses,
 * imported rather than re-derived. So the two surfaces can diverge in shape and cannot diverge in
 * what they do — and each of these components is a drop-in for the Collie sheet it wraps, which is
 * what keeps the invoke sites to a one-word change.
 */

/**
 * A device whose ONLY pointer is a coarse one — a phone, a tablet with no mouse.
 *
 * A VETO, and deliberately not the decision. The decision is the gesture's own pointer type, which
 * the recorder already checked: a long press reports `touch` and is refused there, so what reaches
 * this hook was made by a mouse. Asking `(pointer: fine)` to CONFIRM that was measured and found
 * wrong in both directions — an environment with no pointing device attached answers `none` to fine
 * AND coarse, which silently took the menu away from a machine that had just right-clicked. So the
 * media query only gets to say NO, on the one device where it can be sure: a screen whose primary
 * pointer is coarse and which has no fine pointer at all is a phone, and a 224px box pinned to a
 * coordinate is the wrong surface for a thumb however the event was typed.
 *
 * Live, because a tablet gains and loses a mouse.
 */
function coarseOnly(): boolean {
  return (
    (window.matchMedia?.("(pointer: coarse)").matches ?? false) &&
    !(window.matchMedia?.("(any-pointer: fine)").matches ?? false)
  );
}

function useCoarseOnly(): boolean {
  const [coarse, setCoarse] = useState(coarseOnly);
  useEffect(() => {
    const queries = [window.matchMedia?.("(pointer: coarse)"), window.matchMedia?.("(any-pointer: fine)")];
    const sync = () => setCoarse(coarseOnly());
    sync();
    for (const query of queries) query?.addEventListener("change", sync);
    return () => {
      for (const query of queries) query?.removeEventListener("change", sync);
    };
  }, []);
  return coarse;
}

/**
 * The cursor this surface was opened from, or nothing.
 *
 * Claimed in a LAYOUT effect on the open transition, so the frame where the wrong surface would have
 * stood is never painted; consumed whichever surface wins, so a gesture a phone made can never place
 * something later. The record itself is `fleet/ui/pointer-menu.ts`, which states the three bounds
 * that keep a claim-by-timing honest.
 */
function useClaimedPoint(open: boolean, coarse: boolean): MenuPoint | null {
  const [at, setAt] = useState<MenuPoint | null>(null);
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      const gesture = pointerMenuGestures.take();
      setAt(gesture === null || coarse ? null : { x: gesture.x, y: gesture.y });
    } else if (!open) {
      setAt(null);
    }
    wasOpen.current = open;
  }, [open, coarse]);
  return at;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pane
// ─────────────────────────────────────────────────────────────────────────────

export function FleetPaneActions(props: ComponentProps<typeof PaneActionsSheet>) {
  useLocale();
  const { open, onClose, pane, scope, readOnly = false, onRenamed, onClosed } = props;
  const coarse = useCoarseOnly();
  const at = useClaimedPoint(open, coarse);

  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const closeEcho = useActionEcho();
  const { pending, confirm, reset } = usePendingConfirm();

  // Every gate the sheet asks, asked the same way. `pane?.host` and not the ambient scope: a pane's
  // own machine is the only thing that says where closing it kills a terminal.
  const hostBlock = useHostWriteBlock(pane?.host);
  const canRename = useMuxCapability("renamePane");
  const canClose = useMuxCapability("closePane");
  const canFocus = useMuxCapability("setFocus");
  const localMuxName = useMuxName();
  const { lead } = usePack();
  // `useMuxName()` answers for the collie THIS PAGE runs on. A pane on some other member may be
  // driven by a different multiplexer entirely, so naming the local one there would be a guess
  // dressed as a fact — the fallback copy is used instead. Same rule as the sheet's.
  const focusMux = pane?.host === undefined || pane.host === lead ? localMuxName : "";

  useEffect(() => {
    if (open) return;
    setRenaming(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (at === null) return <PaneActionsSheet {...props} />;

  const name = pane ? paneDisplayName(pane) : t("paneActions.title.fallback");
  const blocked = readOnly || hostBlock !== undefined;

  async function save(next: string) {
    if (!pane || saving) return;
    setSaving(true);
    try {
      const res = await api.renamePane(pane.paneId, next, scope);
      if (res.ok) {
        setStatus(
          next ? t("paneActions.status.renamed") : t("paneActions.status.labelCleared"),
          "success",
        );
        onRenamed();
        onClose();
      } else {
        setStatus(describeApiError(res, t("paneActions.status.renameFailed")), "error");
      }
    } catch (e) {
      setStatus(describeThrownError(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (!pane || closeEcho.pending) return;
    const target = pane;
    if (!confirm(target.paneId)) return;
    await closeEcho.run(target.paneId, async () => {
      try {
        const res = await api.closePane(target.paneId, scope);
        if (!res.ok) {
          setStatus(describeApiError(res, t("paneActions.status.closeFailed")), "error");
          return false;
        }
        onClose();
        onClosed(target.paneId);
        return true;
      } catch (e) {
        setStatus(describeThrownError(e), "error");
        return false;
      }
    });
  }

  async function showInTerminal() {
    if (!pane || focusing) return;
    setFocusing(true);
    try {
      const res = await api.focusPane(pane.paneId, scope);
      if (res.ok) {
        setStatus(t("paneActions.focus.done"), "success");
        onClose();
      } else {
        setStatus(describeApiError(res, t("paneActions.focus.failed")), "error");
      }
    } catch (e) {
      setStatus(describeThrownError(e), "error");
    } finally {
      setFocusing(false);
    }
  }

  return (
    <>
      <FleetContextMenu open={open && !renaming} at={at} onClose={onClose} label={name}>
        {blocked ? (
          <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
            {readOnly
              ? t("paneActions.readOnly")
              : t("paneActions.hostBlockSuffix", { hostBlock: hostBlock ?? "" })}
          </p>
        ) : (
          <>
            {/* The cheap, reversible half first — the same order the sheet keeps, and for the same
                reason: rename and close are the half you arrive at deliberately. */}
            {props.onFind && (
              <FleetMenuItem
                icon={<Search className="size-3 shrink-0 text-muted-foreground" />}
                label={t("chat.find.label")}
                onSelect={() => {
                  onClose();
                  props.onFind?.();
                }}
              />
            )}
            {props.onHistory && (
              <FleetMenuItem
                icon={<ScrollText className="size-3 shrink-0 text-muted-foreground" />}
                label={t("chat.history.label")}
                onSelect={() => {
                  onClose();
                  props.onHistory?.();
                }}
              />
            )}
            {props.onZen && (
              <FleetMenuItem
                icon={<Maximize2 className="size-3 shrink-0 text-muted-foreground" />}
                label={t("chat.zen.label")}
                onSelect={() => {
                  onClose();
                  props.onZen?.();
                }}
              />
            )}
            {/* Each row asks its OWN capability and a row the multiplexer cannot back is HIDDEN —
                the sheet's rule, kept, because a permanently dead entry is worse than a short list. */}
            {canRename.capable && (
              <FleetMenuItem
                icon={<Pencil className="size-3 shrink-0 text-muted-foreground" />}
                label={t("paneActions.rename.label")}
                onSelect={() => setRenaming(true)}
              />
            )}
            {canFocus.capable && (
              <FleetMenuItem
                icon={<Monitor className="size-3 shrink-0 text-muted-foreground" />}
                label={
                  focusMux
                    ? t("paneActions.focus.labelWithMux", { mux: focusMux })
                    : t("paneActions.focus.labelFallback")
                }
                busy={focusing}
                onSelect={() => void showInTerminal()}
              />
            )}
            {canClose.capable && (
              <FleetMenuDestructiveItem
                icon={<XCircle className="size-3 shrink-0" />}
                label={t("paneActions.close.label")}
                confirmLabel={t("paneActions.close.confirm")}
                busyLabel={t("paneActions.close.closing")}
                armed={pane !== null && pending === pane.paneId}
                busy={closeEcho.pending}
                onSelect={() => void requestClose()}
              />
            )}
            {!canRename.capable && !canClose.capable && !canFocus.capable && (
              <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
                {canRename.note || canClose.note || canFocus.note || t("paneActions.empty.fallback")}
              </p>
            )}
          </>
        )}
      </FleetContextMenu>
      <FleetPromptDialog
        open={open && renaming}
        title={name}
        label={t("actionSheet.label")}
        placeholder={t("paneActions.rename.placeholder")}
        initialValue={pane?.paneLabel ?? ""}
        saving={saving}
        // A blank pane field CLEARS the label (blank → null on the bridge), so an empty value saves.
        allowEmpty
        onCancel={() => setRenaming(false)}
        onSubmit={(value) => void save(value)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab
// ─────────────────────────────────────────────────────────────────────────────

export function FleetTabActions(props: ComponentProps<typeof TabActionsSheet>) {
  useLocale();
  const { open, onClose, tab, scope, readOnly = false, onRenamed, onClosed } = props;
  const coarse = useCoarseOnly();
  const at = useClaimedPoint(open, coarse);

  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeEcho = useActionEcho();
  const { pending, confirm, reset } = usePendingConfirm();

  // A tab has no host of its own — the tab list is the LEAD's, and both writes are addressed by the
  // ambient scope, so the block is asked one dimension up. Same gate as the sheet's.
  const hostBlock = useHostWriteBlock(scope?.host);
  const canRename = useMuxCapability("renameTab");
  const canClose = useMuxCapability("closeTab");

  useEffect(() => {
    if (open) return;
    setRenaming(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (at === null) return <TabActionsSheet {...props} />;

  const name = tab ? t("space.tab.titleWithLabel", { label: tab.label }) : t("space.tab.titleFallback");
  const blocked = readOnly || hostBlock !== undefined;
  // Closing a tab kills every pane in it — name the blast radius on the confirm so it is honest.
  const paneCount = tab?.paneCount ?? 0;
  const confirmLabel =
    paneCount > 0 ? tn("space.tab.closeConfirm", paneCount) : t("space.tab.closeConfirmPlain");

  async function save(next: string) {
    if (!tab || saving || !next) return;
    setSaving(true);
    try {
      const res = await api.renameTab(tab.tabId, next, scope);
      if (res.ok) {
        setStatus(t("space.tab.renamed"), "success");
        onRenamed();
        onClose();
      } else {
        setStatus(describeApiError(res, t("space.tab.renameFailed")), "error");
      }
    } catch (e) {
      setStatus(describeThrownError(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (!tab || closeEcho.pending) return;
    const target = tab;
    if (!confirm(target.tabId)) return;
    await closeEcho.run(target.tabId, async () => {
      try {
        const res = await api.closeTab(target.tabId, scope);
        if (!res.ok) {
          setStatus(describeApiError(res, t("space.tab.closeFailed")), "error");
          return false;
        }
        onClose();
        onClosed(target.tabId);
        return true;
      } catch (e) {
        setStatus(describeThrownError(e), "error");
        return false;
      }
    });
  }

  return (
    <>
      <FleetContextMenu open={open && !renaming} at={at} onClose={onClose} label={name}>
        {blocked ? (
          <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
            {readOnly
              ? t("space.tab.readOnly")
              : t("space.tab.hostBlockSuffix", { hostBlock: hostBlock ?? "" })}
          </p>
        ) : (
          <>
            {canRename.capable && (
              <FleetMenuItem
                icon={<Pencil className="size-3 shrink-0 text-muted-foreground" />}
                label={t("space.tab.rename")}
                onSelect={() => setRenaming(true)}
              />
            )}
            {canClose.capable && (
              <FleetMenuDestructiveItem
                icon={<XCircle className="size-3 shrink-0" />}
                label={t("space.tab.close")}
                confirmLabel={confirmLabel}
                busyLabel={t("space.tab.closing")}
                armed={tab !== null && pending === tab.tabId}
                busy={closeEcho.pending}
                onSelect={() => void requestClose()}
              />
            )}
            {!canRename.capable && !canClose.capable && (
              <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
                {canRename.note || canClose.note || t("space.tab.empty.fallback")}
              </p>
            )}
          </>
        )}
      </FleetContextMenu>
      <FleetPromptDialog
        open={open && renaming}
        title={name}
        label={t("actionSheet.label")}
        placeholder={t("space.tab.placeholder")}
        initialValue={tab?.label ?? ""}
        saving={saving}
        // A tab has no "clear": herdr stores "" literally and rejects null, so a blank cannot save.
        allowEmpty={false}
        onCancel={() => setRenaming(false)}
        onSubmit={(value) => void save(value)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Space
// ─────────────────────────────────────────────────────────────────────────────

export interface FleetSpaceActionsProps {
  open: boolean;
  onClose: () => void;
  /** The Space acted on, or null when nothing is open. */
  space: { workspaceId: string; label: string } | null;
  readOnly?: boolean;
}

/**
 * A SPACE'S ACTIONS, and the short list is the honest one.
 *
 * Collie has no Space actions sheet, because until now a Space row offered nothing — so unlike the
 * Pane and the Tab there is no upstream surface to wrap, and this draws both forms itself: Collie's
 * own `BottomSheet` and `ActionRow` for a thumb, the fork's menu for a cursor. Same pair, same
 * choice, same rule.
 *
 * WHAT IS NOT HERE, AND WHY. Renaming a Space is not offered. Herdr itself has `workspace.rename`
 * (HERDR_API.md, live-verified), but nothing between here and it does: there is no `renameSpace` in
 * the multiplexer capability set, no verb on the adapter contract, no route on the bridge and no
 * client function — so a row offering it would be offering something that cannot land, which is the
 * one thing a row in this tree may never do. Adding it is a change to Collie's own mux contract
 * across three adapters, not a Fleet presentation decision.
 *
 * Opening a Tab, by contrast, is a verb the whole chain already has, and the act itself is Collie's:
 * `useSpaceActions().newTab` carries the read-only gate, the refusal copy, the revalidation and the
 * navigation into the new pane, exactly as the tab strip's own + button does.
 */
export function FleetSpaceActions({ open, onClose, space, readOnly = false }: FleetSpaceActionsProps) {
  useLocale();
  const coarse = useCoarseOnly();
  const at = useClaimedPoint(open, coarse);
  const { newTab } = useSpaceActions();
  const canCreate = useMuxCapability("createTab");
  const hostBlock = useHostWriteBlock(undefined);

  const label = space?.label ?? "";
  const blocked = readOnly || hostBlock !== undefined;
  const add = () => {
    if (!space) return;
    onClose();
    void newTab(space.workspaceId);
  };

  const rows = blocked ? (
    <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
      {readOnly ? t("paneActions.readOnly") : t("paneActions.hostBlockSuffix", { hostBlock: hostBlock ?? "" })}
    </p>
  ) : canCreate.capable ? null : (
    <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
      {canCreate.note || t("paneActions.empty.fallback")}
    </p>
  );

  if (at !== null) {
    return (
      <FleetContextMenu open={open} at={at} onClose={onClose} label={label}>
        {rows ?? (
          <FleetMenuItem
            icon={<Plus className="size-3 shrink-0 text-muted-foreground" />}
            label={t("space.tabStrip.new.aria")}
            onSelect={add}
          />
        )}
      </FleetContextMenu>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={label}>
      {rows ?? (
        <div className="flex flex-col gap-1">
          <ActionRow
            icon={<Plus className="size-4 shrink-0 text-muted-foreground" />}
            label={t("space.tabStrip.new.aria")}
            onClick={add}
          />
        </div>
      )}
    </BottomSheet>
  );
}
