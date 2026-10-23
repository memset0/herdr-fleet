## MODIFIED Requirements

### Requirement: Herdr Fleet exposes Collie's native Push setup and test actions
The Herdr Fleet plugin SHALL expose a no-argument `push-keys` action that delegates to Collie's
existing Push-key command and a no-argument `push-test` action that delegates to Collie's existing
test-delivery command. Both actions MUST resolve the same plugin configuration and state directories
used by the Fleet-launched Collie process: each action SHALL run through the Fleet launcher, which
states Collie's state directory exactly as the Fleet runtime derives it for its Collie child and then
delegates to Collie's bootstrap shim with the matching native verb.

The actions MUST invoke the upstream Collie command implementation rather than implementing key
generation, subscription access, or delivery behavior in Fleet-owned runtime code. Their ids SHALL
remain stable for Herdr action invocation.

#### Scenario: Operator generates initial Push keys
- **WHEN** the operator invokes the Fleet `push-keys` action for an unconfigured plugin profile
- **THEN** Collie's native command generates and stores the VAPID keypair in that profile's active configuration

#### Scenario: Operator sends a test notification
- **WHEN** the operator invokes the Fleet `push-test` action after Push is configured and a device is subscribed
- **THEN** Collie's native command sends its standard test notification through the existing subscription store

#### Scenario: Herdr resolves the action
- **WHEN** Herdr reads the Fleet plugin manifest
- **THEN** both action ids resolve to the Fleet launcher, which delegates to the existing Collie bootstrap shim and its matching native CLI verb

#### Scenario: A browser subscribed through the running Fleet
- **WHEN** the operator invokes the Fleet `push-test` action after a browser subscribed through the Fleet-launched Collie
- **THEN** the action reads that process's subscription store and reports delivery to that device rather than reporting that no device is subscribed
