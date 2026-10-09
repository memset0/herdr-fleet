## MODIFIED Requirements

### Requirement: Native route content remains inside one persistent shell
Herdr Fleet SHALL mount one root navigation shell around Collie's existing native route outlet and
its one application header. The shell and its wide-layout rails MUST remain mounted while the
browser navigates among Home, Space, and Pane routes. Existing route components, loaders, polling,
mutation behavior, header claims, and Pane-page controls MUST remain the content of the native
outlet and the native header.

On a wide viewport the rails SHALL be the outermost columns for the full height available to the
shell, and the application header SHALL span only the route column between them. The header MUST
keep its existing single-instance identity, safe-area handling, prerelease strip, route claims,
portalled route content, and hidden-row behavior.

Route content SHALL fill the route column, and its header SHALL span the same width as its content.
No route MAY constrain itself to a narrower centred reading column — the Pane and history routes
included, which is stated because upstream centres them above the phone breakpoint and this fork
declines that, and every Settings page included, the index and each section it opens. The rails are what claims the width a centred column would otherwise leave empty, so a
cap inside them takes width from a terminal mirror rather than from emptiness, and the refusal is
declared in the fork manifest so an upstream release cannot reinstate it unreported.

The shell SHALL be a property of the Fleet build, decided when the bundle is built and never at
run time. Every production build of the browser bundle — the plugin's own build step, the
repository's root build and the lead's deployment — SHALL state that it is a Fleet build, and a bundle so built SHALL always mount the shell. A
bundle built without that statement, as upstream's component suites and browser tier build it,
SHALL render Collie's own root layout: no rails, no hierarchy trigger in the header, and the Pane
page's own switcher. Coverage of the shell-on layout, including how it nests Collie's header and
route column, SHALL live in fork-owned tests.

The shell MUST NOT use an iframe, `postMessage`, frame cache, duplicate router, alternate Gateway
model, or additional snapshot request. It MUST NOT repurpose the Pane page's existing thread
switcher as the wide-layout Agent rail.

#### Scenario: Operator navigates from Home to a Pane
- **WHEN** the operator follows native Space or Pane navigation inside the application
- **THEN** the centre outlet changes through the existing router while the same root shell, header instance, and applicable rails remain mounted

#### Scenario: Shell data is refreshed
- **WHEN** the existing root loader or poll supplies a new snapshot
- **THEN** the shell updates from that data without issuing its own snapshot request

#### Scenario: Wide layout draws the header
- **WHEN** both rails are shown
- **THEN** neither rail is overlapped by the header and the header's rule begins and ends at the route column

#### Scenario: A route that is not a Pane is displayed
- **WHEN** the dashboard, a Space, the Settings index or any of its sections, or Pack is the current route
- **THEN** its content fills the route column at every viewport width instead of being centred in a narrower reading column, and its header spans the same width as its content

#### Scenario: A Pane or history route is displayed above the phone breakpoint
- **WHEN** the operator opens a Pane or its history on a viewport wide enough for upstream's centred column
- **THEN** its content fills the route column between the rails rather than being centred in a narrower one, and its header spans that same width

#### Scenario: An upstream release centres these routes again
- **WHEN** an upstream adoption's preflight is run against a release that changes the Pane or history routes' width
- **THEN** it reports those lines as a declared fork boundary, so the release's cap is decided against rather than inherited

#### Scenario: Pane route remains native
- **WHEN** the operator opens a Pane
- **THEN** the existing Pane route, composer, strips, actions, manual fit, and thread switcher remain native outlet content without a framed copy

#### Scenario: A bundle is built for Fleet
- **WHEN** the plugin's build step, the root build or the lead's deployment produces the browser bundle
- **THEN** that bundle mounts the shell on every route

#### Scenario: A bundle is built without the Fleet statement
- **WHEN** upstream's component suites or browser tier render the application
- **THEN** they meet Collie's own root layout, with no rail, no hierarchy trigger and Collie's own Pane switcher

