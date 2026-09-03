## Purpose

Exposes Collie's existing optional Web Push setup and test operations through the Herdr Fleet plugin
without creating a second notification implementation or storing credentials in source.

## ADDED Requirements

### Requirement: Herdr Fleet exposes Collie's native Push setup and test actions
The Herdr Fleet plugin SHALL expose a no-argument `push-keys` action that delegates to Collie's
existing Push-key command and a no-argument `push-test` action that delegates to Collie's existing
test-delivery command. Both actions MUST resolve the same plugin configuration and state directories
used by the Fleet-launched Collie process.

The actions MUST invoke the upstream Collie command implementation rather than implementing key
generation, subscription access, or delivery behavior in Fleet-owned runtime code. Their ids and
command paths SHALL remain stable for Herdr action invocation.

#### Scenario: Operator generates initial Push keys
- **WHEN** the operator invokes the Fleet `push-keys` action for an unconfigured plugin profile
- **THEN** Collie's native command generates and stores the VAPID keypair in that profile's active configuration

#### Scenario: Operator sends a test notification
- **WHEN** the operator invokes the Fleet `push-test` action after Push is configured and a device is subscribed
- **THEN** Collie's native command sends its standard test notification through the existing subscription store

#### Scenario: Herdr resolves the action
- **WHEN** Herdr reads the Fleet plugin manifest
- **THEN** both action ids resolve to the existing Collie bootstrap shim and its matching native CLI verb

### Requirement: Push actions preserve Collie's credential and subscription safeguards
The Fleet action boundary MUST preserve Collie's existing owner-only configuration writes,
symlink refusal, atomic replacement, VAPID validation, existing-key overwrite refusal, subscription
storage ownership, disabled-state diagnostics, and delivery result handling. It MUST NOT print,
commit, copy, or expose private VAPID material through Fleet status or action metadata.

The no-argument `push-keys` action MUST NOT rotate an existing keypair. Key rotation SHALL remain an
explicit terminal operation using Collie's existing force option because rotation invalidates
current subscriptions. The `push-test` action MUST fail visibly when Push is disabled or no device
is subscribed, rather than reporting a successful delivery.

#### Scenario: Push keys already exist
- **WHEN** the no-argument Fleet `push-keys` action runs against a configured profile
- **THEN** Collie's native overwrite refusal leaves the existing keys and subscriptions unchanged

#### Scenario: The active configuration is a symlink
- **WHEN** Collie's Push-key command determines that the active configuration file is symlinked
- **THEN** the action refuses to replace it and leaves both the link and its target unchanged

#### Scenario: Push is disabled
- **WHEN** the Fleet `push-test` action runs without a usable VAPID configuration or sender
- **THEN** it reports the existing disabled-state failure and sends nothing

#### Scenario: No device is subscribed
- **WHEN** the Fleet `push-test` action runs with no active subscription
- **THEN** it reports that no device is subscribed and does not claim delivery

### Requirement: Native Web Push remains optional and separately activated
Adding the Fleet actions SHALL NOT generate keys, enable browser notifications, subscribe a device,
restart the Fleet runtime, or send a notification automatically during installation, startup,
update, build, or deployment. After initial key generation, an operator SHALL explicitly restart
the Fleet runtime and enable notifications in each browser through Collie's existing Settings UI.

Fleet-specific central collectors, Discord delivery, multi-host notification routing, and
notification-policy changes remain outside this capability. Collie's browser preferences,
subscription model, service worker, and blocked/done notification semantics remain upstream
authority.

#### Scenario: A Fleet build is installed
- **WHEN** a build containing the Push actions starts without configured VAPID keys
- **THEN** Fleet and Collie remain usable with Push disabled and create no Push credential

#### Scenario: Initial keys are generated
- **WHEN** `push-keys` completes successfully
- **THEN** the running process continues using its current configuration until the operator explicitly invokes the existing Fleet restart action

#### Scenario: A browser enables notifications
- **WHEN** the operator enables notifications in Collie's Settings after the restarted bridge advertises Push
- **THEN** Collie's existing subscription flow owns the browser and server state without a Fleet-specific API
