## MODIFIED Requirements

### Requirement: Terminal horizontal clearance participates in measured fit
The terminal surface SHALL have a small, symmetric horizontal inset matching the native mirror's existing content gutter, approximately two character cells in total rather than a new reading-column layout. The inset SHALL reduce the actual width available to the emulator's measured grid; it MUST NOT merely cover output or alter a reported column count independently of rendered geometry.

The inset SHALL preserve the full native route column on desktop and remain inside the viewport on phones. Fitting SHALL continue to floor complete measured cells from available content width and account for the renderer's existing scrollbar and geometry rules. Necessary updates on viewport, rail, rotation, type-size, and font-load changes SHALL remain effective. This alignment MUST NOT suppress a necessary resize or claim that matching horizontal clearance eliminates every resize or guarantees identical rows.

Only the current mounted terminal host with a positive drawable content width and height SHALL report a fitted viewport. A detached, superseded, or zero-area layout measurement MUST NOT resize a held terminal. When the visible content area returns, its first real geometry SHALL be reported normally; valid small viewports MUST NOT be excluded by their column or row values.

In addition to symmetric padding, the terminal SHALL reserve the browser's native vertical scrollbar gutter in its actual drawable layout, matching an overflowing mirror's usable width at equal cell metrics. Overlay scrollbars SHALL consume no additional layout width. This reservation SHALL remain stable when terminal content changes; a mirror without vertical overflow MAY be wider. The surface MUST NOT fetch or render hidden mirror content to decide the reservation, and MUST NOT invoke the mirror's manual resize action.

The change MUST NOT modify terminal or mirror font families, fallbacks, preferences, preference keys, or font-loading behavior. The mirror's existing layout and manual-fit behavior SHALL remain unchanged.

#### Scenario: The terminal is fitted with horizontal clearance
- **WHEN** the terminal is measured in a visible Pane
- **THEN** both horizontal insets are inside its layout bounds and the displayed grid and reported columns derive from the remaining usable width

#### Scenario: Surfaces share measured cell metrics
- **WHEN** both surfaces have the same route width and cell metrics and the mirror has a native vertical scrollbar
- **THEN** the terminal reserves the same native scrollbar width and horizontal padding before fitting whole cells, matching the manual-fit column count at equal cell metrics without a hard-coded column correction

#### Scenario: A phone or narrow desktop is used
- **WHEN** the Pane is drawn at a narrow viewport or between resized desktop rails
- **THEN** the inset does not create page-level horizontal overflow or clip the first or final fitted column

#### Scenario: Font loading or viewport geometry changes
- **WHEN** a font finishes loading or the attached terminal's viewport changes
- **THEN** the existing remeasurement updates the real padded grid and reports any necessary geometry change, without changing font choices or preference state

#### Scenario: Only horizontal padding changes
- **WHEN** the inset is applied at unchanged height and cell metrics
- **THEN** the row fit and native AppBar geometry are unchanged, and only the usable horizontal content space is reduced

#### Scenario: A former host reports after a surface switch
- **WHEN** a queued measurement belongs to a detached or superseded terminal host
- **THEN** it sends no geometry and cannot change the held terminal, while the new host reports its own real fit

#### Scenario: Drawable space disappears temporarily
- **WHEN** the current host has zero drawable width or height and later gains a positive content area
- **THEN** the zero-area measurement sends no geometry and the restored area reports its first real fit, including a valid small viewport

#### Scenario: The browser uses overlay scrollbars
- **WHEN** the browser draws native scrollbars over content rather than reserving layout width
- **THEN** the terminal adds no scrollbar-width subtraction and retains its symmetric padding

#### Scenario: The mirror has no vertical overflow
- **WHEN** the mirror would not need a vertical scrollbar
- **THEN** the terminal still targets the overflowing-mirror width, without hidden mirror rendering or content-dependent gutter changes
