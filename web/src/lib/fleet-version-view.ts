import { fetchCrew, isApiErrorStatus } from "@/lib/api";

/**
 * The shell's one version view, from one `/api/crew` read: the lead's own runtime version (the
 * reference every member is compared against) and each member's runtime report.
 */
export interface FleetVersionView {
  lead: string | null;
  members: Array<{ id: string; version?: string }>;
}

let current: FleetVersionView = { lead: null, members: [] };
let refreshing: Promise<void> | null = null;

/** The last settled view; `{ lead: null, members: [] }` until the first census read answers. */
export function currentFleetVersionView(): FleetVersionView {
  return current;
}

/**
 * Refresh optional version evidence beside, never in front of, the usable snapshot. One `/api/crew`
 * read carries both halves, so the pair is coherent. Never awaited by the loader: the next ordinary
 * revalidation picks up a settled refresh. A solo bridge's 404 resets the view to unknown.
 */
export function refreshFleetVersionView(): void {
  if (refreshing !== null) return;
  refreshing = fetchCrew()
    .then((status) => {
      current = {
        lead: status.self.version,
        members: status.members.map((member) =>
          member.version === undefined ? { id: member.id } : { id: member.id, version: member.version },
        ),
      };
      return undefined;
    })
    .catch((error) => {
      if (isApiErrorStatus(error, 404)) current = { lead: null, members: [] };
    })
    .finally(() => {
      refreshing = null;
    });
}
