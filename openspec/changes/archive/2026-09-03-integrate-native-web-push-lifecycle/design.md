## Context

See `proposal.md` and `specs/fleet-native-web-push-actions/spec.md`. Collie v1.2.0 already implements
`push-keys`, `push-test`, the `push {list|forget|keys|test}` command family, VAPID storage, browser
subscription controls, and delivery. Its upstream plugin manifest exposes only the two safe
no-argument operations as Herdr actions. The Fleet manifest retained its own lifecycle actions but
dropped those Push entries.

## Goals / Non-Goals

**Goals:**

- Restore the two upstream operational actions against the Fleet plugin's actual config/state.
- Keep every credential, subscription, diagnostic, and delivery behavior in Collie's existing CLI
  and bridge code.
- Preserve explicit restart and per-browser enablement steps.
- Keep the manifest change small and auditable.

**Non-Goals:**

- New Fleet Push modules, notification APIs, service-worker behavior, browser controls, or policy.
- Automatic key creation/rotation, subscription, restart, test delivery, or live configuration.
- Argument-bearing Herdr actions for subject changes, forced rotation, subscription listing, or
  forgetting.
- Discord, aggregate collectors, multi-host routing, Pack, SSH, Gateway, STT, release, or production
  deployment changes.

## Decisions

### 1. Restore the upstream action commands directly in the Fleet manifest

Add `push-keys` and `push-test` to `herdr-plugin.toml` with commands
`bash scripts/collie-ctl.sh push-keys` and `bash scripts/collie-ctl.sh push-test`. Herdr already
supplies the plugin config/state environment to actions; the Collie shim resolves/builds the same
binary and delegates to the one CLI implementation.

Do not route these verbs through `scripts/herdr-fleet.sh`: that launcher is the owned
generation-control boundary and accepts lifecycle operations, while Push commands are existing
Collie operator operations. Adding a second dispatch branch there would duplicate a command surface
without adding authority.

Alternatives rejected:

- Add Fleet-owned Push wrappers: duplicates tested upstream behavior and creates another secret
  handling path.
- Expose the entire `push` command family as actions: list/forget and forced rotation need arguments
  or terminal review and do not fit fixed no-argument Herdr actions.
- Generate keys during install/start: creates a credential without operator intent and makes key
  lifecycle implicit.

### 2. Reuse the existing plugin-manifest invasive boundary

`herdr-plugin.toml` is already an exact invasive path because Herdr reads identity, build, lifecycle,
and actions only there. Extend that entry's intent/verification rather than adding another invasive
entry for the same path. No owned block is added because no Fleet runtime implementation is needed.

Focused tests inspect the manifest and require exactly one action for each id, the frozen Collie
shim command, and no action that embeds `--force`, a key, subject, endpoint, or subscription
mutation.

### 3. Clarify inherited Push without claiming Fleet notification behavior

Update the Fleet public guide to distinguish Collie's native optional Web Push from deferred
Fleet-specific external/aggregate notifications. Link or reuse the existing Collie command
documentation rather than duplicating key-generation and subscription procedures.

### 4. Validate without mutating live Push state

Tests exercise Collie's existing Push CLI suites and the manifest contract in synthetic temporary
configuration. Staging verification re-links the exact candidate so Herdr reports both actions, but
does not invoke `push-keys` or `push-test`; real VAPID state and subscriptions remain untouched.

## Risks / Trade-offs

- **[An action writes the wrong `.env`]** -> Delegate to the same Collie CLI context used by every
  other action and assert the frozen shim path.
- **[Existing keys are rotated accidentally]** -> Expose no `--force` argument in the fixed action;
  Collie's native no-argument refusal remains controlling.
- **[The action appears to enable Push by itself]** -> Specify and document restart plus browser
  subscription as separate explicit steps.
- **[Fleet docs duplicate upstream and drift]** -> State only the Fleet action boundary and refer to
  existing Collie Push documentation for detailed behavior.

## Migration Plan

1. Add focused manifest assertions against the exact two action definitions.
2. Add the manifest entries and update the existing invasive entry, Fleet guide, and Changelog.
3. Run focused Push/manifest tests during implementation.
4. At commit readiness, run the full root/Web gates once, both typechecks, lint, version/fork,
   production build, strict OpenSpec validation, and staged diff review.
5. Push the exact candidate and update the isolated v3 staging checkout without invoking either
   Push action or changing live keys/subscriptions.
6. Roll back by redeploying the previous exact commit; existing Push configuration and subscriptions
   remain untouched in either direction.
