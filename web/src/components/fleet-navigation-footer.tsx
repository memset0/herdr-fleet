import { FleetPaneSurfaceToggle } from "@/components/fleet-pane-surface-toggle";
import { useLocale } from "@/hooks/use-locale";
import { BUILD } from "@/lib/build";
import { t } from "@/lib/i18n";

/** The hierarchy rail's one footer, reused verbatim by its mobile drawer. */
export function FleetNavigationFooter() {
  useLocale();
  return (
    <div>
      <FleetPaneSurfaceToggle />
      <div className="px-3 pb-2 text-center text-[10px] leading-3 text-muted-foreground">
        <span>{t("fleet.version.footerName")}</span>{" "}
        {/* A qualified version and commit are machine build ids, not bare semver (DESIGN.md §5).
            `BUILD.version` is the page's own `-dev` stamp and never a selected host's. */}
        <span className={/[-+]/.test(BUILD.version) ? "font-mono" : undefined}>
          v{BUILD.version}
        </span>
        <span className="font-mono"> · {BUILD.sha}</span>
      </div>
    </div>
  );
}
