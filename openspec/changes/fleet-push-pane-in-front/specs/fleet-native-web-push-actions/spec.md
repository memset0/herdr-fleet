## ADDED Requirements

### Requirement: A pane notification is withheld only while that pane is in front of the operator
When a push about a pane arrives, the application SHALL withhold its system notification only if a
window of the application has focus and shows that same pane — the address a tap on the notification
would open, compared by path and by host and session as the application normalises them. In every
other case it SHALL show the notification, including when an application window is open and visible
but not focused, and when the focused window shows a different pane, a different host's pane with the
same id, or a page that is not a pane. A push that opens no pane SHALL NOT be withheld by this rule.
Machine alerts and retractions SHALL keep Collie's existing handling.

#### Scenario: The app is open behind other windows
- **WHEN** a pane's push arrives while an application window is open and visible but another program has focus
- **THEN** the system notification is shown

#### Scenario: The operator is looking at that pane
- **WHEN** a pane's push arrives while the focused application window shows that pane on the same host and session
- **THEN** the system notification is withheld

#### Scenario: The operator is looking at another pane
- **WHEN** a pane's push arrives while the focused application window shows a different pane, or the same pane id on another host
- **THEN** the system notification is shown

#### Scenario: A test push arrives
- **WHEN** a push that opens no pane arrives while an application window has focus
- **THEN** the system notification is shown

## MODIFIED Requirements

### Requirement: Native Web Push remains optional and separately activated
Adding the Fleet actions SHALL NOT generate keys, enable browser notifications, subscribe a device,
restart the Fleet runtime, or send a notification automatically during installation, startup,
update, build, or deployment. After initial key generation, an operator SHALL explicitly restart
the Fleet runtime and enable notifications in each browser through Collie's existing Settings UI.

Fleet-specific central collectors, Discord delivery, multi-host notification routing, and
notification-policy changes remain outside this capability. Collie's browser preferences,
subscription model, service worker, and blocked/done notification semantics remain upstream
authority, except when a pane notification is withheld, which the requirement below decides.

#### Scenario: A Fleet build is installed
- **WHEN** a build containing the Push actions starts without configured VAPID keys
- **THEN** Fleet and Collie remain usable with Push disabled and create no Push credential

#### Scenario: Initial keys are generated
- **WHEN** `push-keys` completes successfully
- **THEN** the running process continues using its current configuration until the operator explicitly invokes the existing Fleet restart action

#### Scenario: A browser enables notifications
- **WHEN** the operator enables notifications in Collie's Settings after the restarted bridge advertises Push
- **THEN** Collie's existing subscription flow owns the browser and server state without a Fleet-specific API
