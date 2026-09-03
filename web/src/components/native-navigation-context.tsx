import { PanelLeft } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

/**
 * The one seam between the Fleet navigation shell and the two Collie-owned surfaces that have to
 * show something of it — the application header, which hosts the narrow-layout hierarchy trigger,
 * and the Pane page, whose existing switcher entry presents the Agent rail.
 *
 * It is a context and not a prop chain because both consumers are mounted BELOW the shell and
 * neither is reachable from it: the header is rendered by the root route inside the shell's route
 * column, and the switcher sits four levels down inside the Pane page. Prop-drilling either one
 * would put a Fleet-shaped prop on a Collie route boundary that has no other reason to know Fleet
 * exists.
 *
 * It lives in its own module rather than in the shell so that importing the seam does not import
 * the whole shell — the Pane page needs the switcher and nothing else.
 */
export interface NativePaneSwitcherPresentation {
  /** The sheet's title, because the sheet no longer lists panes. */
  title: string;
  content: ReactNode;
}

export interface NativeNavigationContextValue {
  hierarchyOpen: boolean;
  toggleHierarchy: () => void;
  /** Registers the header trigger so the shell can return focus to it when the overlay closes. */
  setTrigger: (element: HTMLButtonElement | null) => void;
  paneSwitcher: NativePaneSwitcherPresentation;
}

const NativeNavigationContext = createContext<NativeNavigationContextValue | null>(null);

export function NativeNavigationProvider({
  value,
  children,
}: {
  value: NativeNavigationContextValue;
  children: ReactNode;
}) {
  return (
    <NativeNavigationContext.Provider value={value}>{children}</NativeNavigationContext.Provider>
  );
}

/**
 * What the Pane page's switcher sheet should show, or `null` when the page is mounted outside the
 * shell — Collie's own tests and playground, where the upstream pane list stays the answer.
 */
export function useNativePaneSwitcher(): NativePaneSwitcherPresentation | null {
  return useContext(NativeNavigationContext)?.paneSwitcher ?? null;
}

/**
 * The header's leading control on a narrow viewport. It renders nothing on a wide one — where both
 * rails are already on screen — and nothing at all outside the shell, so the header keeps working
 * unchanged wherever Collie mounts it alone.
 */
export function NativeHierarchyToggle() {
  const navigation = useContext(NativeNavigationContext);
  useLocale();
  if (navigation === null) return null;
  return (
    <button
      ref={navigation.setTrigger}
      type="button"
      aria-expanded={navigation.hierarchyOpen}
      aria-controls="fleet-hierarchy-overlay"
      aria-label={t("fleet.navigation.openHierarchy")}
      onClick={navigation.toggleHierarchy}
      className="-ml-2 grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground xl:hidden"
    >
      <PanelLeft className="size-5" aria-hidden />
    </button>
  );
}
