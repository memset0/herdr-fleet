import { FleetPaneSurfaceToggle } from "@/components/fleet-pane-surface-toggle";
import { useLocale } from "@/hooks/use-locale";
import { BUILD } from "@/lib/build";
import { t } from "@/lib/i18n";

/** One compact footer shared by the hierarchy rail and its mobile drawer. */
export function FleetNavigationFooter() {
  useLocale();
  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      <FleetPaneSurfaceToggle />
      <div className="flex min-h-6 items-center justify-center px-3 pb-1 text-center text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
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
