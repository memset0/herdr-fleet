import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

// The small uppercase tag that names a control/navigation row — Spaces · Tabs · Panes · Controls.
// One component so the "name the section" pattern stays visually identical everywhere it's used.
export function SectionLabel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={cn(
        "shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
