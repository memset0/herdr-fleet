import { FleetPaneSurfaceToggle } from "@/components/fleet-pane-surface-toggle";
import { useLocale } from "@/hooks/use-locale";
import { BUILD } from "@/lib/build";
import { t } from "@/lib/i18n";

/**
 * The hierarchy rail's one footer, reused verbatim by its mobile drawer.
 *
 * THE BUILD ROW IS COLLIE'S TAB BAR'S BAND (`ui/tab-bar.tsx`): the same 56px floor, the same rule
 * above it, the same page ground and the same bottom safe-area inset under it. On the dashboard the
 * tab bar stands at the bottom of the route column beside this rail, and beneath the drawer on a
 * phone; with the band's numbers the two rules meet on one line instead of missing each other by a
 * row and a half. The label takes the tab labels' own 11px type.
 */
export function FleetNavigationFooter() {
  useLocale();
  return (
    <div>
      <FleetPaneSurfaceToggle />
      <div className="flex min-h-14 items-center justify-center border-t border-rule bg-background px-3 pb-[env(safe-area-inset-bottom)] text-center text-[11px] leading-tight text-muted-foreground">
        <span>
          <span>{t("fleet.version.footerName")}</span>{" "}
          {/* A qualified version and commit are machine build ids, not bare semver (DESIGN.md §5).
              `BUILD.version` is the page's own `-dev` stamp and never a selected host's. */}
          <span className={/[-+]/.test(BUILD.version) ? "font-mono" : undefined}>v{BUILD.version}</span>
          <span className="font-mono"> · {BUILD.sha}</span>
        </span>
      </div>
    </div>
  );
}
