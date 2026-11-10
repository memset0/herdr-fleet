# Moving an existing Fleet to Core in 4.0.0

4.0.0 adopts Collie 1.28.0. Its Core adapter is upstream functionality; Fleet adds the authenticated
Gateway, shared navigation, terminal surface and patient send policy. This is a major migration:
backend selection and lifecycle invocation change. Keep the previous generation and configuration
until the replacement has passed its checks. Do not cut or migrate a major without owner authorization.

## Before switching

- Verify the already installed `herdr-core` and its selected session with `herdr-core server status`.
  Fleet does not start or stop it. Record its permanent identity and existing terminal count.
- Record the exact current Fleet generation, native crew membership, configuration and state. Keep
  browser credentials, pairing, certificates, associations, display settings and speech configuration.
- Build one exact reviewed product release using `scripts/herdr-fleet.sh build` in a separate candidate
  checkout. A failed build must leave the installed generation running.

## Select the backend

Add these fields to the existing `[collie]` table; preserve its host/port and every other table:

```toml
mux = "herdr-core"
core_session = "default"
core_socket = "/example/runtime/herdr-core/default.sock"
```

Use the actual local Core socket. The explicit socket wins over inherited shell selectors. Do not
point it at a remote socket, a TUI socket, a holder socket or another user’s Core. For a different
session, name both its session and matching socket. A missing selected Core is unavailable; Fleet
never silently selects another runtime.

The existing upstream TUI adapter remains supported independently. Migrating Core is not permission
to remove an existing TUI server, its sessions or other plugins.

## Control Fleet directly

The names of the following storage variables remain for data continuity; they do not require a TUI
plugin registry. Supply the installed release, existing state and reviewed configuration explicitly:

```sh
export HERDR_PLUGIN_ROOT=/example/fleet/release
export HERDR_PLUGIN_STATE_DIR=/example/fleet/state
export HERDR_FLEET_CONFIG=/example/fleet/config/fleet.toml
"$HERDR_PLUGIN_ROOT/scripts/herdr-fleet.sh" status
"$HERDR_PLUGIN_ROOT/scripts/herdr-fleet.sh" stop
"$HERDR_PLUGIN_ROOT/scripts/herdr-fleet.sh" start
```

Stop only Fleet at the final switch, install the built candidate and new configuration, and invoke
its direct control entrypoint. Update any already-authorized boot or maintenance trigger to the same
entrypoint and environment; do not create or enable a service as an installation side effect.

Verify authenticated Web access, the selected Core’s terminals, screen reads, message outcomes,
terminal attachment, explicit resize and browser exclusivity. Check that Core identity and terminal
processes survived the Fleet restart. Level enrolled crew members lead first, using the same exact
release; report an unavailable or unverified member as pending.

On failed activation, stop only the replacement Fleet, restore the previous payload/configuration
and start that generation through its original direct control entrypoint. Preserve diagnostic and
rollback state. Never reset crew trust to make a replacement appear healthy.

## What changed and what remains

- Core terminal references include permanent runtime identity, so local address reuse cannot inherit
  old TUI associations. Old unresolved records remain recoverable without guessed conversion.
- Slow-screen windows remain patient and end on evidence immediately. Upstream’s late-probe,
  incomplete-screen and post-record token fixes replace the equivalent older workarounds. The
  forwarding and browser budgets outlast the complete bounded send, including recovery and writes.
- Todoist OAuth, API, task delivery, sidebar and settings are removed. Fleet does not delete or
  revoke external tasks, credentials or association files; retain them for an independent replacement.
- Upstream’s anonymous install ping is disabled in the Fleet profile to retain the existing egress
  boundary. Upstream operation outside the Fleet profile retains upstream defaults.
