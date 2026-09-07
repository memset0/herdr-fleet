## ADDED Requirements

### Requirement: Both Pane surfaces use the same native AppBar
Selecting the terminal surface SHALL replace the Pane's content, not its native AppBar. The same native Pane header owner SHALL supply identity, the applicable agent mark and state, Pane-name disambiguation, working-directory context, host context, overview navigation, status announcements, and Pane actions in both modes. At the same viewport and with the same Pane metadata, the header's information, controls, positions, height, safe-area handling, and accessible semantics SHALL be identical between surfaces.

The terminal surface MUST NOT provide an alternative header or a separately styled imitation. Switching surface SHALL leave the native header mounted. Existing native controls and functions MUST NOT be removed or weakened from the mirror to produce parity. Existing capability, content-availability, session, and write-authorization gates SHALL continue to apply rather than becoming terminal-mode exclusions.

The terminal's connection state, dimensions, read-only indication, and selection/copy feedback SHALL remain available inside terminal content. Those facts MUST NOT substitute for the native AppBar or be removed as though they were a duplicate AppBar.

#### Scenario: The same Pane switches surfaces on a desktop
- **WHEN** the operator switches between mirror and terminal for the same Pane at the same desktop viewport
- **THEN** the native AppBar remains mounted with the same identity, host context, actions, positions, and height, while only the Pane content changes

#### Scenario: The same Pane switches surfaces on a phone
- **WHEN** the operator switches surfaces at a phone viewport
- **THEN** the same native hierarchy trigger, Pane identity and available actions remain reachable with unchanged hit areas and without horizontal page overflow

#### Scenario: Pane metadata changes while the terminal is visible
- **WHEN** the shared snapshot changes the Pane's name, working directory, host health, or agent state
- **THEN** the terminal-mode AppBar reflects the same native naming, truncation, state, and stale-data rules as the mirror

#### Scenario: The operator uses Pane actions
- **WHEN** an existing Pane action is available and the operator activates it from either surface
- **THEN** the existing action surface, scope, authorization, confirmations, navigation, and focus behavior apply, with no terminal-only replacement menu

#### Scenario: The operator finds text or enters Zen
- **WHEN** rendered output is available and the operator invokes Find, or invokes Zen where the existing preference enables it
- **THEN** the native control operates on the visible surface, Find retains its query and match-navigation behavior without requesting hidden mirror text, and Zen retains its existing entry and exit behavior

#### Scenario: Terminal dimensions are needed
- **WHEN** a connected terminal reports its current geometry or a terminal-specific notice
- **THEN** the information remains legible in terminal content and the native AppBar remains intact above it

### Requirement: Terminal horizontal clearance participates in measured fit
The terminal surface SHALL have a small, symmetric horizontal inset matching the native mirror's existing content gutter, approximately two character cells in total rather than a new reading-column layout. The inset SHALL reduce the actual width available to the emulator's measured grid; it MUST NOT merely cover output or alter a reported column count independently of rendered geometry.

The inset SHALL preserve the full native route column on desktop and remain inside the viewport on phones. Fitting SHALL continue to floor complete measured cells from available content width and account for the renderer's existing scrollbar and geometry rules. Necessary updates on viewport, rail, rotation, type-size, and font-load changes SHALL remain effective. This alignment MUST NOT suppress a necessary resize or claim that matching horizontal clearance eliminates every resize or guarantees identical rows.

Only the current mounted terminal host with a positive drawable content width and height SHALL report a fitted viewport. A detached, superseded, or zero-area layout measurement MUST NOT resize a held terminal. When the visible content area returns, its first real geometry SHALL be reported normally; valid small viewports MUST NOT be excluded by their column or row values.

The change MUST NOT modify terminal or mirror font families, fallbacks, preferences, preference keys, or font-loading behavior. The mirror's existing layout and manual-fit behavior SHALL remain unchanged.

#### Scenario: The terminal is fitted with horizontal clearance
- **WHEN** the terminal is measured in a visible Pane
- **THEN** both horizontal insets are inside its layout bounds and the displayed grid and reported columns derive from the remaining usable width

#### Scenario: Surfaces share measured cell metrics
- **WHEN** both surfaces have the same route width and cell metrics and no differing scrollbar reservation
- **THEN** the horizontal inset reduces their usable-width difference compared with the unpadded terminal, subject to whole-cell rounding rather than a hard-coded column correction

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
