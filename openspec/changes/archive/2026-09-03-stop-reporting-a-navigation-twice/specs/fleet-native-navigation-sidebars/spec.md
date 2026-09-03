## ADDED Requirements

### Requirement: The shell reports its own route changes
Because the shell's rails and header remain mounted across every route change and the arriving route
draws its own chrome, Herdr Fleet SHALL NOT surface the application's ambient busy indicator for a
route navigation. It SHALL continue to surface it for a write in flight and for a background
revalidation that has genuinely hung, since nothing else on the screen reports either.

#### Scenario: Operator opens a Pane from the dashboard
- **WHEN** the navigation's own load runs long
- **THEN** no ambient strip appears, and the arriving route reports its own loading state

#### Scenario: A background poll hangs
- **WHEN** a revalidation stays in flight past its own threshold
- **THEN** the ambient strip appears exactly as it did before

### Requirement: The hierarchy has one density at every width
The hierarchy SHALL draw its rows at one compact height and one type size at every viewport width,
so the surface a phone opens is the surface a wide viewport keeps. A row SHALL carry horizontal
padding of its own, so a row with no disclosure control does not begin flush against the rail's edge.

Surfaces the operator aims at rather than scans — the Agent rows, the Pane page's strips and its
control row — keep their own touch-sized floors.

#### Scenario: The hierarchy is read on a phone
- **WHEN** the hierarchy surface is open below the wide-layout threshold
- **THEN** its rows are the same height and type size as the wide-layout rail's

#### Scenario: A leaf row is drawn
- **WHEN** a row has no disclosure control
- **THEN** its icon begins inside the row's own padding rather than at the surface's edge
