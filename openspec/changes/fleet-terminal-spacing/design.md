## Decisions

- **Where the controls stand.** The terminal surface's font size is Collie's per-device Text size in
  the Pane's Display sheet (`display-prefs.tsx`, non-Chat branch). That branch already has a Fleet
  slot directly below Text size (`afterTextSize`, the `native-manual-pane-fit-port`), filled by the
  owned `useFleetPaneFit().row`. The spacing rows join that node from the owned side, only while the
  surface switch selects the terminal, so no upstream file changes. They reuse
  `ui/numeric-setting-row.tsx`, the primitive Chat spacing already uses.
- **Storage.** Collie's Text size lives in this browser's own display preferences, which are
  upstream's file; spacing is kept the same way — per browser — in a Fleet key
  (`herdr-fleet:terminal-spacing:v1`, `{version:1, lineHeight, letterSpacing}`) behind a try/catch
  store like the surface switch.
- **Ranges.** xterm 6.0.0 throws on `lineHeight < 1` and does not validate `letterSpacing`. Line
  height 1.0–2.0 step 0.05; letter spacing −1–4 px step 0.5 (the low end stays positive at the
  smallest Text size). Out-of-range, non-numeric or wrong-version values read as the field default.
- **Live refit.** Spacing joins the surface's `TerminalFace` (family, size, line height, letter
  spacing). A change re-runs the surface effect, which already compares the retained terminal's face
  with the wanted one and updates `terminal.options` in place followed by a re-measure and the
  ordinary viewport report — the path a font change already takes. The pool therefore never serves a
  terminal at stale spacing and never rebuilds one for it.
