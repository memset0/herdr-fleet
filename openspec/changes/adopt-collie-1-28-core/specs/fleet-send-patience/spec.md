## MODIFIED Requirements

### Requirement: Callers wait at least as long as a send may take
The send's total deadline SHALL account for all enabled read windows, permitted retries, cleanup and measured write costs. A longer window MUST NOT impose a fixed delay once the screen provides decisive evidence.

The phone's request for a Send Protocol send (on a local pane, or through the reply route of a crew member's pane) SHALL allow longer than the lead's forward of that reply route, and the lead's forward of a member's reply route SHALL allow longer than the Send Protocol's full possible duration. Other forwarded writes and other phone mutations SHALL keep their existing budgets.

#### Scenario: A slow send on a member's pane
- **WHEN** a member takes most of its lock bound to answer a send
- **THEN** the lead still relays the member's answer and the phone still receives it

#### Scenario: Upstream adds a late-probe recovery window
- **WHEN** a send consumes that window or its permitted retry in addition to ordinary steps and write costs
- **THEN** neither caller abandons it before its full bounded result, and no caller silently replays an uncertain send
