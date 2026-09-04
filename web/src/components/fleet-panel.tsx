import { useEffect, useRef, type ReactNode } from "react";

import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The panel the keyboard opens things on.
 *
 * PROMOTED, NOT COPIED. `DESIGN.md` §1 says to reach for the primitive and to promote one the moment
 * a second place needs the same visual idea — and a second place now does: the command bar and the
 * rename input are the same panel, and a keyboard surface that appeared somewhere else would read as
 * a different mechanism. Making them one component is what keeps that true rather than making it a
 * coincidence of two matching class lists.
 *
 * It lives here rather than in `components/ui/`: that directory is Collie's, and a shell existing
 * only to serve two fork surfaces is a narrower thing than a claim on it would suggest.
 *
 * Top-anchored, over a dim, at a bounded width — the geometry an operator already knows from an
 * editor's quick input. The ground, the rule and the radius are this app's own tokens, so it reads
 * as part of Fleet rather than as a widget pasted into it.
 */
export interface FleetPanelProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for assistive technology. */
  label: string;
  /** How tall the panel stands. A fixed height keeps filtering from moving the input (§2). */
  className?: string;
  children: ReactNode;
}

export function FleetPanel({ open, onClose, label, className, children }: FleetPanelProps) {
  useLocale();
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      restoreTo.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-slot="fleet-panel"
      // `items-start`, and it is not cosmetic: a flex row stretches its children by default, so a
      // panel that does not declare a height — the rename input — grew to the full height of the
      // viewport. The command bar hid the bug by always declaring one.
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t("fleet.command.bar.dismiss")}
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // `--card` is what a raised panel stands on (DESIGN.md §4), and the rule is drawn once, on
        // the panel's own edge, because that is where the ground changes.
        className={cn(
          "relative mt-[12vh] flex w-[min(94vw,40rem)] flex-col overflow-hidden rounded-xl border border-rule bg-card shadow-xl",
          className,
        )}
      >
        {children}
      </section>
    </div>
  );
}
