import { FleetPaneSurfaceToggle } from "@/components/fleet-pane-surface-toggle";
import { BUILD } from "@/lib/build";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import { FleetSyncControl } from "@/components/fleet-view-experience";
import { useNav } from "@/hooks/use-nav";
import { Button } from "@/components/ui/button";
import { Grid2X2 } from "lucide-react";


/** One compact footer shared by the hierarchy rail and its mobile drawer. */
export function FleetNavigationFooter() {
  useFleetLocale();
  const nav = useNav();
  return (
    <div>
      <FleetPaneSurfaceToggle />
      <div className="flex min-h-11 items-center gap-1 pr-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex min-h-6 min-w-0 flex-1 items-center justify-center px-3 pb-1 text-center text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
        <span>
          <span>{ft("fleet.version.footerName")}</span>{" "}
          {/* A qualified version and commit are machine build ids, not bare semver (DESIGN.md §5).
              `BUILD.version` is the page's own `-dev` stamp and never a selected host's. */}
          <span className={/[-+]/.test(BUILD.version) ? "font-mono" : undefined}>v{BUILD.version}</span>
          <span className="font-mono"> · {BUILD.sha}</span>
        </span>
        </div>
        <FleetSyncControl compact />
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={ft("fleet.panel.title")} title={ft("fleet.panel.title")}
          onClick={() => nav.down("/panel")}><Grid2X2 className="size-3.5" /></Button>
      </div>
    </div>
  );
}
