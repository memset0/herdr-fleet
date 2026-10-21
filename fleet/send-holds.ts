// Fleet sends a message now or not at all (fleet-no-send-hold).
//
// Collie v1.22.6 puts a send it may not type yet (a turn the harness cannot take a message in, a box
// it cannot read, a probe that met a moving screen) in a per-pane hold queue, and types it once a poll
// reads the pane free, often only when the turn ends ("Queued. Sends when the turn ends."). The
// operator wants no such wait: a send that can go in goes in at once (a queueing harness's own queue,
// a steering Enter), and one that cannot is refused there and then, with its reason, for the person to
// resend. Requests already held when this switch turned off still drain through the release poll.

/** Whether a refused send joins the pane's hold queue. Off in Fleet; tests of Collie's queue turn it on. */
export const sendHolds = { enabled: false };
