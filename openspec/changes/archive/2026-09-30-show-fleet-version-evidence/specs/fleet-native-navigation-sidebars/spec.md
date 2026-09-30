## MODIFIED Requirements

### Requirement: A Host row is the machine, and reports it

A Host row SHALL draw the machine it stands for in the column its disclosure control would occupy,
using Collie's own server glyph tinted with that machine's own colour — the same per-member tint
every other host-aware Collie surface uses — and SHALL NOT draw a disclosure arrow there. Every
member of the roster is a row in this list whether or not it holds anything, so the question the list
is scanned for is which machine each row is, and an arrow answers that for none of them.

The row SHALL report whether that machine is answering. When it is not — unreachable, never seen, or
refused on protocol — the glyph SHALL change as well as its colour, and the row SHALL say so in words
at its trailing end, in the position a Pane row's state occupies. Colour alone MUST NOT carry the
fact. A machine that is answering SHALL say nothing, and a snapshot with no roster at all SHALL draw
the plain untinted glyph and no connectivity word, because there is no such question on a single
machine.

The row SHALL report connectivity and version evidence as independent facts. Existing unreachable,
never-seen, slow-link and protocol wording and styling SHALL continue to derive from the lead's
existing health view. Beside it, the row SHALL show the member's full reported Fleet runtime identity
when that identity is parseable and outdated, manual-major, development, or last-reported. When the
identity is absent or unparseable, the row SHALL report "Version unknown" and MUST NOT echo the raw
reported value, because an unparseable identity is arbitrary member text. A version state
MUST NOT change the connectivity glyph, tint, sorting, disclosure, navigation, selection, folding,
retained rows, or terminal actions. Patch differences within one major.minor MUST NOT add an outdated
label.

The row SHALL still disclose when it has children, and its disclosure state SHALL be announced on the
control that remains — the row's own label — so nothing is lost with the arrow. Fleet MUST NOT
introduce a second host health model, a second host palette, a second vocabulary for a machine that is
down, an update action, a per-row request, or a private installation-state source.

#### Scenario: The roster holds a member that is not answering
- **WHEN** the hierarchy lists a member the lead cannot reach
- **THEN** that row's glyph is the refusal one, in the refusal colour, and the row says it is unreachable in words

#### Scenario: The roster holds a member that is answering
- **WHEN** the hierarchy lists a member that is answering
- **THEN** that row's glyph carries the member's own tint and the row says nothing about its connectivity state

#### Scenario: A single-machine snapshot
- **WHEN** the hierarchy lists one machine and there is no roster
- **THEN** the row draws the plain glyph with no tint and no connectivity word

#### Scenario: Operator opens and closes a Host row
- **WHEN** the operator activates a Host row that has children
- **THEN** it discloses and conceals as before, and its state is announced on the row's own label

#### Scenario: A reachable host reports an older minor
- **WHEN** fresh shared release evidence identifies a higher Fleet minor than the host's reported runtime
- **THEN** the Host row shows the outdated state and full reported version while preserving its reachable glyph, tint, position, disclosure, and actions

#### Scenario: An unreachable host retains a version
- **WHEN** the lead reports that a host is not writable and retains that host's prior runtime version
- **THEN** the row keeps its unreachable presentation and separately labels the version as last reported

#### Scenario: Version evidence is unknown
- **WHEN** a host has no parseable runtime identity or fresh release conclusion
- **THEN** the row reports the applicable unknown or unavailable version state without hiding the host or changing navigation, and an unknown state says "Version unknown" without echoing any unparseable reported value

#### Scenario: Compatible patch skew exists
- **WHEN** the host and newest stable release share a major.minor and differ only by patch
- **THEN** the Host row does not present a peer-required update

### Requirement: The phone's hierarchy is the rail arriving from the edge

The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows and footer. It MAY add only
what a drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a
second visual treatment of the same surface.

It SHALL leave a usable strip of the surface behind it visible, so it reads as a panel that can be
dismissed by tapping past rather than as a route the operator has navigated to, and its width SHALL
be capped near the wide-layout rail's own resting width rather than growing with the viewport.

The shared footer SHALL keep the existing Collie/TTYD surface selector and place the current page's
Herdr Fleet build identity beneath it. The desktop hierarchy rail SHALL render the same footer
ordering. The footer build identity SHALL be independent of selected host, member reachability, and
release discovery. It SHALL preserve development and available commit qualification and MUST NOT
replace either surface choice or reduce its keyboard, touch, or narrow-screen access.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title, its rows and its footer are the wide-layout rail's, with a dismiss control added

#### Scenario: The drawer stands on a wide phone
- **WHEN** the drawer is opened on a viewport wide enough that a share of it would exceed the rail's resting width
- **THEN** the drawer takes the capped width, and a strip of the surface behind it stays visible and tappable

#### Scenario: The hierarchy footer is drawn on desktop and mobile
- **WHEN** either native hierarchy surface is visible
- **THEN** the Collie/TTYD selector appears first and the current page's Herdr Fleet build identity appears beneath it

#### Scenario: The page is a development build
- **WHEN** the current bundle carries a development build identity
- **THEN** both hierarchy surfaces retain that development qualification in their shared footer

#### Scenario: The selected host or release source changes
- **WHEN** host selection changes or published release evidence is unavailable
- **THEN** the footer's page build remains unchanged and both selector choices remain usable
