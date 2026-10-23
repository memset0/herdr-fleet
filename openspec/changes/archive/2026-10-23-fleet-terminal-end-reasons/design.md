## Context

A terminal session ends in `Session.close()` (grace timer, eviction, upstream close, failed
establishment, Gateway shutdown); a browser connection ends in `TerminalConnection.end()` (the session
ended under it, a logout/revoke, an expiry sweep, Gateway shutdown). Only the grace and eviction
paths logged, without a time. The Gateway's log function in `fleet/gateway-main.ts` is the one sink
every terminal layer writes through.

## Decisions

- **The reason is decided where the end is decided.** `Session.close(reason, detail?)` and
  `TerminalConnection.end(notice, reason?)` take the reason as an argument from their callers; the
  session logs `terminal.session-ended {pane, reason, browser, code?}` once, guarded by its existing
  idempotence. `terminal.grace-expired` and `terminal.session-evicted` are folded into it rather than
  logged beside it, so one end is one line.
- **A connection logs only ends the session did not.** When a session ends under its browser the
  session's line already says why (and `browser: 1` says someone was watching); the connection logs
  `terminal.connection-ended {pane, reason}` only for `auth-ended`, `auth-expired` and `restart`, which
  originate above the session. On restart that is one line per open browser plus one per held session.
- **Upstream exit carries the WebSocket close code, nothing else.** The terminal server's stdio stays
  ignored on purpose (its output would land in diagnostics); its process exit is the server's own,
  not the attach command's, and it races the socket close. The close code is a number and carries no
  content. An `error` before `close` reports no code.
- **Timestamps once, centrally.** The Gateway's `log()` prefixes `new Date().toISOString()`; no call
  site changes. The peer service's own logger is untouched (a peer change would make this a MINOR).
- **No reason reaches the browser.** The notice vocabulary stays closed and reason-free, so the
  surface cannot tell a restart from a revocation. Reconnect is therefore manual, and offered on every
  closed connection: a `busy` retry is refused exactly as before, so offering it there changes nothing.
- **Reconnect rebuilds through the existing path.** A retained entry already marks itself `ended` and
  is rebuilt on the next mount; Reconnect bumps an attempt counter in the effect's dependencies, so the
  effect releases the ended entry and builds a fresh terminal and socket for the same Pane and scope.
  The notice is `ui/notice.tsx` in a `ui/collapse.tsx`, with a `ui/button.tsx` action — no new primitive.

## Risks / Trade-offs

- Log lines change shape (timestamp first). Nothing in the tree parses them; operators grepping by
  event name are unaffected.
- The notice box takes height in flow while shown; the terminal is dead then, so the resize it causes
  reaches no session.
