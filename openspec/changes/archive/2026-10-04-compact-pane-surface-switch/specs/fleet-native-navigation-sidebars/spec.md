## MODIFIED Requirements

### Requirement: The phone's hierarchy is the rail arriving from the edge

The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows and footer. It MAY add only
what a drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a
second visual treatment of the same surface. Both rails' titles and the drawer's title SHALL wear
Collie's sheet-title style: 14px, semibold, foreground ink, in the label's own case.

It SHALL leave a usable strip of the surface behind it visible, so it reads as a panel that can be
dismissed by tapping past rather than as a route the operator has navigated to, and its width SHALL
be capped near the wide-layout rail's own resting width rather than growing with the viewport.

The shared footer SHALL keep the existing Collie/TTYD surface selector and place the current page's
Herdr Fleet build identity beneath it. The selector SHALL use one shared recessed track with an
inset selected indicator that slides horizontally between its two equal segments. The selected label
SHALL retain at least 4.5:1 contrast in either theme. Switching SHALL NOT move the labels or change
the control's height, and reduced-motion preference SHALL remove the slide. The selector SHALL retain
44px minimum hit targets while occupying less vertical space than its previous padded button row.
The build identity SHALL be a small, centered neutral-gray caption beneath the track, with a compact
row and the bottom safe-area inset preserved. It SHALL NOT reserve the bottom tab bar's height or
add a separate regional divider between the selector and caption. The desktop hierarchy rail SHALL render the same footer ordering. The footer build identity
SHALL be independent of selected host, member reachability, and crew census availability. It SHALL preserve
development and available commit qualification and MUST NOT replace either surface choice or reduce
its keyboard, touch, or narrow-screen access.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title, its rows and its footer are the wide-layout rail's, with a dismiss control added

#### Scenario: The drawer stands on a wide phone
- **WHEN** the drawer is opened on a viewport wide enough that a share of it would exceed the rail's resting width
- **THEN** the drawer takes the capped width, and a strip of the surface behind it stays visible and tappable

#### Scenario: The hierarchy footer is drawn on desktop and mobile
- **WHEN** either native hierarchy surface is visible
- **THEN** the Collie/TTYD selector appears first and the current page's Herdr Fleet build identity appears beneath it

#### Scenario: The footer meets the tab bar
- **WHEN** the dashboard tab bar is beside the rail or beneath the drawer at the default text size
- **THEN** the selector and caption together occupy less height than the previous two bands, with a centered gray build caption and safe-area clearance

#### Scenario: The selected surface is read
- **WHEN** either segment is activated in either theme
- **THEN** the selected indicator slides to that segment, its label contrast is at least 4.5:1, and neither label nor the surrounding layout moves

#### Scenario: Reduced motion is requested
- **WHEN** the surface changes while reduced motion is requested
- **THEN** the indicator immediately reaches the selected segment without sliding

#### Scenario: The page is a development build
- **WHEN** the current bundle carries a development build identity
- **THEN** both hierarchy surfaces retain that development qualification in their shared footer

#### Scenario: The selected host or release source changes
- **WHEN** host selection changes or the crew census cannot be read
- **THEN** the footer's page build remains unchanged and both selector choices remain usable
