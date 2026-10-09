import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Scaling } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { normalizeScope, type Scope } from "@/lib/scope";
import { setStatus } from "@/lib/status";
import type { JsonValue } from "../../../bridge/json.ts";
import {
  parsePaneFitAnswer,
  parsePaneFitAvailability,
  runManualPaneFit,
  type ManualPaneFitRequestResult,
  type PaneFitAvailability,
} from "../../../fleet/ui/manual-pane-fit.ts";

export type { PaneFitAvailability };

/**
 * Manual Pane fit, as the Pane page sees it: one Display row and one function.
 *
 * Everything about the fit is Fleet's. Which Hosts can fit is asked of the Fleet Gateway once per
 * document (`/fleet/api/pane-fit`), never of Collie's capability table; the request goes to the
 * Gateway's own route, which fits a lead Pane locally and asks a member's own terminal service for a
 * member's Pane. The Pane page hands the row to Display Settings' `afterTextSize` slot, so it stands
 * among the mirror's rows and never among Chat's, and hands `fit` to the `fit-pane-width` command, so
 * the keyboard and the tap share one measurement, one busy flag and one result policy.
 */

const AVAILABILITY_URL = "/fleet/api/pane-fit";

let availabilityRead: Promise<PaneFitAvailability | null> | null = null;

/** One read per document; a refusal or a missing Gateway is remembered as "no Fleet here". */
export function loadPaneFitAvailability(): Promise<PaneFitAvailability | null> {
  availabilityRead ??= fetchAvailability().catch(() => null);
  return availabilityRead;
}

async function fetchAvailability(): Promise<PaneFitAvailability | null> {
  const response = await fetch(AVAILABILITY_URL, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  // SAFETY: Response.json() yields the JSON representation; parsePaneFitAvailability narrows it.
  const value = (await response.json()) as JsonValue;
  return parsePaneFitAvailability(value);
}

/** Tests only: forget the cached read. */
export function __resetPaneFitAvailability(): void {
  availabilityRead = null;
}

export function hostCanFit(availability: PaneFitAvailability, scope: Scope | undefined): boolean {
  const { host } = normalizeScope(scope);
  return host === undefined ? availability.lead : availability.members.includes(host);
}

async function requestFit(paneId: string, cols: number, scope: Scope | undefined): Promise<ManualPaneFitRequestResult> {
  const { host, session } = normalizeScope(scope);
  const query = new URLSearchParams();
  if (host) query.set("h", host);
  if (session) query.set("s", session);
  const search = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`/fleet/api/pane/${encodeURIComponent(paneId)}/resize${search}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ cols }),
  });
  if (!response.ok) return { ok: false, reason: "failed" };
  // SAFETY: Response.json() yields the JSON representation; parsePaneFitAnswer narrows every field.
  return parsePaneFitAnswer((await response.json()) as JsonValue);
}

export interface FleetPaneFitInput {
  readonly paneId: string;
  readonly scope: Scope | undefined;
  /** The page's own read-only verdict: the control is drawn disabled, as the terminal surface does. */
  readonly readOnly: boolean;
  /** The Pane's Host is stale or unreachable, so a write cannot be trusted to land. */
  readonly hostBlocked: boolean;
  /** The Pane is gone; there is nothing to fit. */
  readonly gone: boolean;
  /** The mirror's scrollport, measured at the moment of the tap and never before. */
  readonly scrollElement: () => HTMLElement | null;
  readonly fontSize: number;
}

export interface FleetPaneFit {
  /** The Display row, or `undefined` when there is no Fleet Gateway or no Pane. */
  readonly row: ReactNode;
  /** One explicit fit attempt. A no-op while busy, read-only, blocked or unavailable. */
  readonly fit: () => Promise<void>;
}

export function useFleetPaneFit(input: FleetPaneFitInput): FleetPaneFit {
  const [availability, setAvailability] = useState<PaneFitAvailability | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      const answer = await loadPaneFitAvailability();
      if (live) setAvailability(answer);
    })();
    return () => {
      live = false;
    };
  }, []);

  const available = availability != null && hostCanFit(availability, input.scope);
  const usable = available && !input.readOnly && !input.hostBlocked;
  const { paneId, scope, fontSize, scrollElement } = input;

  const fit = useCallback(async (): Promise<void> => {
    if (busyRef.current || !usable) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await runManualPaneFit(scrollElement(), fontSize, (cols) => requestFit(paneId, cols, scope));
      if (result.ok) {
        setStatus(t("settings.display.resize.success", { cols: result.cols, rows: result.rows }), "success");
        return;
      }
      const key = {
        unsupported: "settings.display.resize.unsupported",
        geometry: "settings.display.resize.geometryError",
        conflict: "settings.display.resize.conflict",
        failed: "settings.display.resize.failed",
      } as const;
      setStatus(t(key[result.reason]), "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [usable, scrollElement, fontSize, paneId, scope]);

  const row =
    availability != null && !input.gone ? (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {t("settings.display.resize.label")}
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
              {t("settings.display.resize.badge")}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t("settings.display.resize.hint")}</p>
        </div>
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={!usable || busy}
          onClick={() => void fit()}
          aria-label={t("settings.display.resize.aria")}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Scaling />}
          {busy ? t("settings.display.resize.busy") : t("settings.display.resize.label")}
        </Button>
      </div>
    ) : undefined;

  return { row, fit };
}
