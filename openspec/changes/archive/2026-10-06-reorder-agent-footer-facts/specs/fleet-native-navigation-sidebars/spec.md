## MODIFIED Requirements

### Requirement: Agent rail reuses native Agent behavior
The wide-layout Agent rail and the narrow-layout Agent surface SHALL present the same Agent rows. They
SHALL lead with a Pinned group holding this device's pinned Agent panes in the adopted Collie's own
pinned order, under Collie's muted section caption with no dot and no count. The remaining rows SHALL
follow Collie's own triage sections, labels, group order and membership, with Recent ordered by
descending `lastSeenAt` and Ready/Working by descending `lastActiveAt`; Needs SHALL retain its input
order. Equal timestamps SHALL preserve input order and missing timestamps SHALL follow timed rows.
The rail, command bar roster snapshot, next/previous navigation and numbered selection SHALL share
this same order,
with each pinned pane listed once, in the Pinned group. A section left with no rows SHALL be dropped;
a section heading SHALL count every pane of its bucket, pinned or not, so no two headings count one
pane. Triage section headings SHALL use Collie's workspace-heading voice — foreground ink, 13px, the
label in its own case — except where Collie itself renders a section in its alert accent. Shell rows
MUST NOT be introduced into the Agent surface.

Above the groups the rail SHALL draw the dashboard's own summary line over every Agent: its all-clear
wording SHALL appear exactly when the dashboard's would — when no pane needs the operator and none is
finished and unseen — and otherwise the same counts with their words. The rail MUST NOT spell the
same fact in different words from the dashboard.

The row itself is fork-owned. It SHALL lead with one integrated 32px Agent mark, with its shortcut ordinal at the lower-left corner and the Pane's state dot at the lower-right corner, and it SHALL say
WHERE the work is before WHAT it is doing: the Space in a muted style, then the name the operator gave
the work in the plain one at 12px and medium weight; beneath it,
in 11px muted type, what the Pane is doing. A reserved third line SHALL lead with host/session metadata, followed by tags, with the row's age at the trailing right edge. The avatar SHALL span only the first two text lines. Tags MAY wrap onto additional lines, with the age right-aligned on the last line. The name SHALL follow the same rule the hierarchy uses —
the operator's own Pane name, else the Tab's, never a number the multiplexer assigned. The row SHALL
present the Space, separator and work name as one single-line phrase, applying ellipsis only at the trailing end of that entire phrase when it does not fit. The Space MUST NOT be separately truncated or allocated a smaller fixed share. The integrated avatar cluster SHALL retain its own space beside both text lines, outside that phrase, and the phrase MUST NOT overlap the actions. The row SHALL
omit any additional visible per-row unseen mark and its reserved slot, while retaining accessible unseen wording; group labels and summary counts SHALL continue to express unseen state. The row SHALL
carry the `data-glide` part names Collie's own rows carry for the dot, the mark and the name.

Collie's own Agent list and card MUST remain unchanged apart from the star port, so every other
surface that renders them is unaffected. The navigation shell MUST NOT add a pin or favourite store,
alter triage classification, change manual Pane fit, or create a separate Agent fetch or backend model.

#### Scenario: Favorites change while the Agent rail is visible
- **WHEN** the operator stars a rail row, or pins its pane from Collie's own sheet
- **THEN** the row leaves its triage section for the Pinned group at the top of the rail, its section heading still counts it, and the shell adds no navigation or request behavior

#### Scenario: The dashboard says something is unseen
- **WHEN** no pane is blocked and one finished pane is unseen
- **THEN** the rail's summary line names the unseen count with its word, as the dashboard's does, and does not say that nothing needs the operator

#### Scenario: Operator opens an Agent from the responsive overlay
- **WHEN** the operator activates the Pane page's pane-switcher entry and then activates an Agent row
- **THEN** the same rows are presented in that entry's existing sheet, Collie's existing Pane navigation runs once, and the sheet closes

#### Scenario: Wide viewport hides the pane-switcher entry
- **WHEN** the Agent rail is shown
- **THEN** the Pane page exposes no pane-switcher entry and the Pane page's own composer, strips, and thread sidebar are unchanged

#### Scenario: A rail row is drawn
- **WHEN** a row stands for a Pane
- **THEN** it leads with one 32px Agent mark carrying the ordinal and state at its lower corners, the Space precedes the work's name on the first line in 12px type, and what the Pane is doing follows beneath in 11px type

#### Scenario: More rows than a single key can address
- **WHEN** the rail holds more rows than one keypress can reach
- **THEN** the rows past that limit carry no ordinal, because a badge there would promise a shortcut that does not exist

#### Scenario: Existing Agent behavior evolves
- **WHEN** Collie changes its triage group order or its pinned order in a compatible future update
- **THEN** the rail inherits that group and pinned ordering while Fleet retains its specified within-group timestamp ordering

#### Scenario: Timestamps disagree with placement order
- **WHEN** Recent, Ready or Working contains rows whose timestamps differ from their input placement order
- **THEN** Recent lists the newest last-seen row first and Ready/Working list the newest last-active row first, while group order is unchanged

#### Scenario: Rows share or lack a timestamp
- **WHEN** two rows in a time-ordered group have equal timestamps, and other rows have no timestamp
- **THEN** tied rows keep their input order and untimed rows follow all timed rows in their own input order

#### Scenario: A pinned row has an older timestamp
- **WHEN** a pinned row is older than an unpinned row in its original bucket
- **THEN** it still leads in the native Pinned group and appears nowhere else

#### Scenario: Navigation reads the reordered roster
- **WHEN** the operator cycles next or previous, selects a numbered row, or opens the command bar
- **THEN** those surfaces use the Agent rail's same timestamp-ordered roster

#### Scenario: The combined heading is wider than the row
- **WHEN** the Space and work name together exceed the title area
- **THEN** one trailing ellipsis shortens the combined phrase, with no separate Space ellipsis, while its fixed marks and actions remain visible

#### Scenario: A Ready unseen row is displayed
- **WHEN** an Agent row is finished and unseen
- **THEN** its native status remains visible but no additional visible unseen mark or blank mark slot follows its heading, while the group and summary retain their unseen information

### Requirement: A rail row's controls and facts sit at opposite corners
An Agent rail row SHALL place its star at the trailing end of the two-line body, and SHALL reserve that
width on the row so neither line runs under it; the age SHALL end the footer's final line at the card's standard right content inset without reserving that control width. The star SHALL be drawn whether or not the row is pinned, because a control that
appears only on hover is a control a touch device does not have.

#### Scenario: A row is drawn on a touch device
- **WHEN** the rail lists a row that is not pinned
- **THEN** its star is still drawn, muted, at the row's trailing end

#### Scenario: A row carries an age
- **WHEN** the row's section dates its rows
- **THEN** the age ends the footer's final line, outside the two-line body's action reserve

### Requirement: An Agent row says which host it came from
Each Agent row SHALL carry the host it belongs to through Collie's own pane meta — the borderless
host marker and session marker Collie's dashboard rows end their first line with — so
the vocabulary and the styling are the ones every other host-aware Collie row already uses. In the
rail it SHALL lead the third-row footer before all tag badges, while the age occupies the final right edge. The host
marker SHALL be absent on a snapshot with a single host, by the marker's own rule, and the rail MUST
NOT introduce a second way of naming a host. The rail SHALL omit prompt-cache readings, including cold/warm labels and cache-expiry timers, without changing those readings on other surfaces.

#### Scenario: Agents from two members are listed
- **WHEN** the rail lists rows from more than one member
- **THEN** each row's footer begins with Collie's pane meta naming its host, in the borderless form the dashboard row uses

#### Scenario: A solo snapshot is listed
- **WHEN** the rail lists rows from one host only
- **THEN** no host marker is drawn on any row

#### Scenario: A pane reports prompt-cache state
- **WHEN** an Agent row receives a cache reading
- **THEN** its rail presentation omits that reading while retaining applicable host and session metadata
