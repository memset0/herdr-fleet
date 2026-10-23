## Decisions

- **The intent rides the upgrade URL as `takeover=1`.** It is decided before the session is acquired,
  so the first frame (always the viewport) is too late without a third message kind, and the frame
  grammar deliberately cannot express one. Admission already enumerates its query parameters and
  refuses extras; adding one allowed name with one allowed value is the narrowest change. The intent
  travels beside the target (`Admission.takeover`, `TerminalUpgrade.takeover`), never inside
  `TerminalTarget`, because it selects nothing and the resolver must not see it.
- **The swap happens in `Session.attach`.** `attach(client, { takeover: true })` on a held session
  with a client: the old client is unset, logged `terminal.session-taken`, told through a new
  `AttachedClient.taken()` (the connection ends with notice `taken`), then the new client attaches and
  receives the retained window exactly as a returning browser does. The old connection's own detach
  is then a no-op because the session no longer holds it, so no grace timer starts. The upstream,
  server and Herdr attachment are untouched.
- **Notice vocabulary gains `taken`.** Closed and reason-free like the rest. The surface maps it to
  its own sentence and offers Reconnect; Reconnect sees `busy` and offers Take over, so taking it back
  is two deliberate acts and nothing loops on its own.
- **Surface.** Take over sets a one-shot ref read when the next link is built, then reuses
  Reconnect's attempt bump. The notice's action slot holds both buttons when busy.

## Risks / Trade-offs

- Two operators can trade a terminal back and forth; each swap is an explicit act and is logged.
- A take-over resizes the terminal to the new browser's viewport, as any attach does.
