import { CloudOff, WifiOff } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { savedAtLabel } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Collie's lost-connection badge, for a header row that declines the Collie mark.
 *
 * Collie 1.18 hangs a small badge on its mark while the bridge is not answering, so the state stays
 * on screen after the operator has dismissed the connection strip. The Pane route declines that mark
 * (fleet-pane-chrome), which would take the badge with it. This draws the same icon, picked by the
 * same `online` fact, in the same danger ink, and says the same words the mark's button says while
 * lost, so a reader of the Pane header learns what a reader of any other header learns.
 */
export function FleetLostBadge({ online, lastSeenAt }: { online: boolean; lastSeenAt?: number | undefined }) {
  useLocale();
  const Icon = online ? CloudOff : WifiOff;
  const label =
    lastSeenAt === undefined ? t("nav.home.aria.lost") : t("nav.home.aria.lostAt", { time: savedAtLabel(lastSeenAt) });
  return (
    <span
      role="img"
      aria-label={label}
      data-slot="fleet-lost-badge"
      data-icon={online ? "cloud-off" : "wifi-off"}
      className="grid size-11 shrink-0 place-items-center"
    >
      <Icon aria-hidden className="size-4 text-status-blocked" />
    </span>
  );
}
