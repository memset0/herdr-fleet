/**
 * Where a Pane's terminal actually is.
 *
 * The lead can answer that question for its own Panes and cannot answer it for anybody else's:
 * Collie drops `terminal_id` when it builds its Pane model, so nothing the lead receives about a
 * member's Panes carries one, and nothing may make it carry one. A lead able to name a terminal on
 * a machine it does not own is a lead able to type into it.
 *
 * So a placement is one of two things, and the difference is not a transport detail. A local
 * placement names a terminal, because the lead resolved it. A peer placement names a PANE and the
 * loopback endpoint that peer's own service answers on, because only that peer may turn the one into
 * the other, and it does so each time it is asked.
 */

/** A loopback endpoint, structurally the configuration's own shape. */
export interface PlacementEndpoint {
  readonly host: string;
  readonly port: number;
}

export type Placement =
  | {
      readonly kind: "local";
      readonly terminalId: string;
      /** The Pane this terminal was resolved from, carried so diagnostics can name a Pane. */
      readonly paneId: string;
    }
  | {
      readonly kind: "peer";
      /** The member this Pane lives on, as the address and the reachability list both name it. */
      readonly host: string;
      readonly paneId: string;
      /** Where the lead reaches that member's terminal service. Never handed to a browser. */
      readonly endpoint: PlacementEndpoint;
    };

/**
 * The key a session set holds a placement under.
 *
 * A Pane id alone is not one: the same Pane id exists on every machine in a pack, so two members'
 * Panes would share a session and one operator's keystrokes would land on the other's terminal.
 */
export function placementKey(placement: Placement): string {
  return placement.kind === "local"
    ? `local ${placement.terminalId}`
    : `peer ${placement.host} ${placement.paneId}`;
}

/**
 * What a diagnostic may say about a placement: the Pane, and the machine it lives on.
 *
 * Never the terminal id. The diagnostics boundary lists Pane and Host identity and does not list a
 * terminal id, and a log line is exactly the place a value ends up somewhere nobody meant it to.
 */
export function placementLabel(placement: Placement): string {
  return placement.kind === "local" ? `local ${placement.paneId}` : `${placement.host} ${placement.paneId}`;
}
