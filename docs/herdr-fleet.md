# Herdr Fleet downstream runtime

Herdr Fleet adds an authenticated Herdr plugin boundary to the exact Collie baseline recorded in
[`FORK.toml`](../FORK.toml). Collie's PWA, bridge API, multiplexer adapters, Pack implementation, and
standalone deployment alternatives remain upstream behavior.

Schema 1 remains the deliberately solo-compatible Fleet lead profile: one Collie process, one
password/session Gateway, and one public HTTPS origin. Schema 2 adds only the role-aware foundation
for selecting Collie's native Pack authority. It does not implement SSH reachability, enroll a
member, contact a peer, aggregate Hosts, distribute software, or replace Collie's native Pack
router, loaders, and UI. Collie's native optional Web Push remains available unchanged.

The full Collie Pack security harness for this baseline is verified on Bun 1.3.14. Its pinned-client
TLS canary does not hold on Bun 1.3.12, so Pack or later multi-host behavior must not be enabled on an
older, unverified Bun runtime. The first schema keeps Pack unconfigured and exposes no Pack route.

## Private configuration

The runtime reads `fleet.toml` only from `HERDR_FLEET_CONFIG` or from `fleet.toml` beneath the
Herdr-provided plugin configuration directory. The resolved file must be owner-only (`0600`) and
must live outside the source checkout. The repository ignores a root `fleet.toml` as a final guard,
but an ignored checkout file is not the recommended live location.

Schema version 1 accepts these fields:

| Table | Fields | Contract |
| --- | --- | --- |
| root | `schema_version`, `role` | Version is `1`; role is exactly `lead`. |
| `listen` | `host`, `port` | Gateway listener; host is loopback. |
| `public` | `origin` | One exact HTTPS origin with no path, query, fragment, or user information. |
| `collie` | `host`, `port` | One distinct loopback Collie endpoint. |
| `auth` | `username`, `password_hash`, `session_secret`, `session_ttl_seconds` | One account, an approved Argon2id hash, at least 32 random base64url secret bytes, and a bounded lifetime. |
| `auth.rate_limit` | bounded failure/window/block/source and aggregate fields | Optional overrides for the finite login budgets. |
| `proxy` | `client_ip_header` | Header the loopback HTTPS proxy replaces with one client IP. |

Every table rejects unknown fields. `peer`, `hosts`, `transport`, `reachability`, `ssh`, and `pack`
are not dormant options in version 1: supplying one fails startup without partially enabling it. The Pack trust and
operations JSON files remain Collie-managed state and are never configuration inputs.

Do not commit a complete configuration, password hash, signing secret, session state, hostname,
device mapping, or private path. Public tests construct synthetic values in temporary directories.

Schema version 2 selects Collie's native Pack lifecycle without copying its trust state:

| Role | Required tables | Runtime |
| --- | --- | --- |
| `lead` | root, `lifecycle`, `listen`, `public`, `collie`, `auth`; optional `auth.rate_limit`, `proxy` and `reachability` | One loopback Collie plus one loopback authenticated Gateway. |
| `peer` | root, `lifecycle`, `collie`, `transport` | One loopback Collie plus one supervised SSH link; no Gateway, browser account, session store, or public listener. |

Both roles require:

```toml
schema_version = 2
role = "peer" # or "lead"

[lifecycle]
mode = "native-pack"
pack_state = "collie"

[collie]
host = "127.0.0.1"
port = 8787
```

A Lead then supplies the same synthetic-shape Gateway tables documented for schema 1. A Peer must
not supply them. Neither role accepts members, Pack secrets, certificates, fingerprints, passwords,
remote commands, or alternate trust paths.

### Reachability

Reachability is the operator's, exactly as `PACK_PROTOCOL.md` §8.2 states: Collie authenticates a
member, and nothing here does. A Peer opens one outbound SSH connection carrying two loopback
projections and nothing else — a remote projection publishing this Peer's own `[collie]` endpoint at
a Lead-local address, and a local projection publishing the Lead's Collie at a Peer-local address.
The Peer's own projected endpoint is derived from `[collie]` rather than restated here.

```toml
[transport]
mode = "ssh-reverse"
ssh_host = "lead.example.com"
ssh_port = 22
ssh_user = "fleet-tunnel"
identity_file = "/private/fleet/id_ed25519"
known_hosts_file = "/private/fleet/known_hosts"
lead_bind_host = "127.0.0.1"
lead_bind_port = 18901
peer_bind_host = "127.0.0.1"
peer_bind_port = 18902
lead_collie_host = "127.0.0.1"
lead_collie_port = 8787
retry_max_seconds = 60
```

A Lead names where it dials each member, and only that:

```toml
[[reachability]]
member_id = "peer-a"
host = "127.0.0.1"
port = 18901
```

`mode` admits exactly `ssh-reverse`; a mode with no runtime behind it is refused rather than accepted
as dormant. Every projection bind must be loopback, a Lead rejects `[transport]`, a Peer rejects
`[[reachability]]`, and neither table accepts trust material of any kind. The identity file must be
owner-only and is checked before a connection is attempted.

The link is restricted by construction: no remote command, shell, or PTY; no inherited user SSH
configuration; no agent, X11, dynamic, or additional forwarding; no multiplexing; strict host-key
checking against the configured `known_hosts`; and `ExitOnForwardFailure`, so a projection that
cannot bind ends the attempt instead of leaving one direction silently missing. The Peer owns
recovery under bounded backoff capped by `retry_max_seconds`, and a link failure never restarts the
Collie child.

An established link asserts nothing. It grants TCP reachability and no membership, admission, or
role, and a dead link revokes nothing and changes no trust state. A Lead's `[[reachability]]` list is
a projection of the membership Collie already owns: its member ids must equal Collie's enrolled set,
checked read-only before any child starts, and a disagreement fails closed rather than being
reconciled.

Before a schema-2 child starts, Fleet uses Collie's existing trust reader and mode derivation against
the Collie child's isolated state directory. The configured role must match a valid active native
Lead or Peer state. Missing, invalid, conflicted, solo, or mismatched state fails closed. Fleet never
creates, repairs, enrolls, rotates, or otherwise writes that state.

## Membership

Herdr Fleet performs membership changes itself, through Collie's own Pack transitions and Collie's own
trust-store update seam. **Do not run Collie's `pack` verbs against a Fleet deployment.** Those verbs
resolve an upstream plugin identity from a constant and pick a host supervision tier by probing for a
service manager, so one of them writes a foreign configuration directory and registers a service
unit — and a Fleet peer runs rootless on hosts that have no service manager at all.

Fleet installs, enables and restarts no operating-system service anywhere. Its lifecycle is the
Herdr plugin's: children are supervised by the plugin's own generation-owned supervisor, and a
membership change reaches a running runtime when that plugin is restarted.

Enrolling the first peer is an explicit, ordered operator sequence. Nothing about starting,
restarting or supervising a runtime creates, spends or alters membership.

```text
on the lead    herdr-fleet pack-invite --label <name>
               herdr plugin action invoke restart --plugin memset0.herdr-fleet
on the peer    herdr-fleet pack-join --lead <origin> --address <host:port> -
on the lead    herdr plugin action invoke restart --plugin memset0.herdr-fleet
```

`--lead` is the peer's own loopback projection of the lead's Collie, so the plaintext hop lives inside
the SSH link rather than on a network. `--address` is where the lead will dial this peer, from the
lead's point of view. The invite is single-use and short-lived; it is printed once, on standard
output, and only its hash is stored. `pack-join` reads it from standard input (`-`) or an owner-only
file (`@<path>`) and refuses it as an argument, because `/proc/<pid>/cmdline` is readable by every
local uid.

The lead's enrolment path does not exist until the running lead has read a trust store, which is why
the first restart is part of the sequence rather than advice. A refused invite or an unreachable lead
leaves the peer exactly as it was.

## Authentication boundary

The Gateway owns `/auth/login` and `/auth/logout`. A successful login verifies the configured
Argon2id hash and returns a signed `__Host-` cookie backed by an owner-only active-session registry.
The cookie is Secure, HttpOnly, SameSite=Strict, Path=/, and has no Domain attribute. Logout revokes
the current server-side session before clearing the cookie.

All Lead document navigations and `/api/*` requests require a current session before Collie is contacted.
Only the authentication stylesheet and an exact set of PWA update assets are public. The service
worker sends every document navigation to the network first, so an expired or logged-out session
cannot recover an old authenticated app shell. The public Gateway never exposes `/pack/*`.

Login and logout require an exact-origin POST. Return targets are relative application paths rather
than user-provided URLs. Credential inputs, session files, attempt budgets, proxy bodies, headers,
and redirects are bounded or allowlisted, and authentication material is removed before a request
reaches Collie.

## Reverse-proxy contract

The public HTTPS proxy must:

1. Route the one configured public origin only to the loopback Fleet Gateway, never directly to
   Collie.
2. Preserve the exact public Host expected by `fleet.toml`.
3. Replace, rather than append, the configured client-IP header and discard the public caller's
   supplied forwarding value.
4. Leave the Gateway and Collie application ports unreachable from non-loopback networks.
5. Preserve no-store authentication responses and the Gateway's security headers.

The Gateway builds a new narrow upstream header set. It never forwards the Fleet cookie, browser
Authorization, forwarding headers, Tailscale identity, or device-trust assertions to Collie.

## Lifecycle

Herdr actions call the thin `scripts/herdr-fleet.sh` launcher:

- `start`/`ensure` starts one generation-qualified supervisor.
- `status` reports only safe generation, configured schema-2 role, component, PID, and readiness
  facts; schema-1 output remains unchanged.
- `restart` replaces only the supervisor's role-selected children.
- `stop` closes the private control socket and only those direct children.
- `url` prints the configured public origin.

The supervisor uses no operating-system service, pid-file discovery, port-based killing, or broad
process-name matching. Its private Unix control socket is generation-qualified; child crashes use a
bounded restart delay. Logs and session state stay beneath the owner-only plugin state directory.

A schema-2 Lead supervises Collie plus Gateway. A schema-2 Peer supervises Collie only and checks
that its loopback listener is accepting connections without attempting to bypass native Pack mTLS.
Fleet never starts a second Pack listener or projects that loopback endpoint off-host.

## Native Pack authority boundary

Fleet browser authentication and native Pack machine admission are independent. The Fleet cookie,
password material, session secret, and active session state are not placed in the Collie child
environment or translated into Pack credentials. The public Gateway returns not found for every
`/pack/*` path before proxying, including for an authenticated browser.

Collie's `pack-trust.json`, pinned certificates, Pack secret/signatures, role derivation, membership
transitions, strict no-grace rotation, member permissions, router, loaders, and native UI remain the
only Pack authority and implementation. Fleet reads that state only to confirm schema-2 role
agreement before startup. It adds no enrollment, rotation, sibling route, software-update authority,
or fallback secret.

## Native Web Push actions

Herdr Fleet exposes Collie's existing `push-keys` and `push-test` commands as fixed no-argument
plugin actions. They run through `scripts/collie-ctl.sh`, so Collie's own config-directory
resolution, mode-600 writes, existing-key refusal, subscription store, and diagnostics remain the
only implementation.

The actions do not enable Push automatically. Generate initial keys only when intended, invoke the
existing Fleet `restart` action so the running bridge reads them, then enable notifications in each
browser through Collie's Settings. The fixed `push-keys` action cannot rotate existing keys; forced
rotation and subscription list/forget operations remain terminal commands because they require
explicit arguments or review. See [`voice-and-push.md`](voice-and-push.md#web-push-optional) for the
native Collie workflow.

## Manual Pane fit

On a writable Herdr Pane, native Display Settings includes a `Resize` row directly below
`Text size`, marked `Custom`. A tap measures the current terminal mirror, converts its usable width
to complete monospace cells, clamps the result to 20–500 columns, and preserves the trusted current
viewport row count.

This is an explicit action only. Opening the drawer or changing the browser, font, route, or layout
does not resize the shared PTY. The bridge retains one no-takeover Herdr controller per session
socket and Pane, reuses it for later taps, reports ownership conflicts, and releases only its own
controllers when the Pane, session, or bridge ends. Browser requests carry columns only; socket paths
and rows stay server-owned. tmux, zellij, older bridges, unavailable Panes, and read-only clients do
not receive a usable action.

## Keyboard commands

Fleet has one command catalog and one recognizer. Every command carries a stable English id, an
English name, exactly one action, and zero or more bindings; a key, the command bar and a control all
reach that action through the same dispatcher, and nothing else installs an application-level key
listener.

### The two binding shapes

A **direct chord** is modifiers and a key pressed together (`Ctrl+Shift+P`). A **prefix binding** is
the configured prefix — `Ctrl+B` by default — pressed and released, then a second chord (`Prefix+S`,
written that way in the document and shown as `Ctrl+B S` in the interface).

Matching is on the physical key code and the exact modifier set, so a binding does not change meaning
when the keyboard layout does, and a chord with a modifier it did not name is a different chord.
Auto-repeat is ignored. The browser default is prevented only for an accepted prefix or a complete
binding.

A pending prefix waits two seconds and is cancelled by `Escape`, by the window losing focus, by the
document being hidden, or by a second chord nothing is bound to — the last of which is passed on
rather than swallowed.

**While a prefix is pending it takes the next key first**, ahead of the composer and ahead of
direct-typing mode, so `Escape`, `Tab` and the arrows resolve as second chords. The moment the
sequence ends, those keys go back to whatever owns them. A direct chord applies in every focus
context, including while you are typing.

### What ships bound

`Ctrl+Shift+P` opens the command bar, and it is the only direct-chord default. Everything else that
ships bound is a prefix binding, because a direct chord is best-effort — a browser or an extension
may take it first — while a prefix sequence's second chord is a plain key nothing else listens for.

Commands that ship unbound stay listed, searchable and bindable: the whole-hierarchy and Agent walks,
the Agent ordinals, `last-pane`, `copy-fleet-pane-link`, `toggle-type-mode` and the eight fixed key
sends. No `Alt` chord is a default.

A Space has no rename or close command. The multiplexer exposes creating a Space and nothing else for
one, and a command that can never land is worse than an absent command.

### While the prefix waits

Press the prefix and pause, and a compact panel appears at the bottom of the screen listing every
second chord that currently leads somewhere, grouped by what it acts on. It is generated from YOUR
effective bindings, so a command you rebound shows its new key and one you unbound is not there.

It waits about four-tenths of a second before appearing, so completing a sequence at speed never
shows it — the panel is for the moment you have forgotten, not for every press. It disappears as soon
as the sequence completes, expires or is cancelled.

It is a hint and nothing more: it takes no focus, holds no space, cannot be clicked or scrolled, and
never intercepts the key it is describing. A command whose target does not currently exist is still
listed, dimmed. The full catalog, including direct chords and unbound commands, is in the command
bar.

### The command bar

`Ctrl+Shift+P` opens it with a leading `/`, which searches the catalog by name, id and binding label.
Remove the `/` and the same panel finds a Pane instead, across every member of the pack. Both modes
fuzzy-match, mark what they matched, move with the arrows, run on `Enter` and close on `Escape`.

The Pane list is snapshotted when the panel opens. Incoming state updates what a row SHOWS and never
reorders, adds or removes one, so the list cannot move under a half-typed query.

### The settings document

Bindings live in `settings.json`, beside `fleet.toml` in the plugin configuration directory. It is
read at request time behind a modification-time check, so editing it on disk is live — no restart —
and a file that does not parse holds the last good one rather than failing the surface.

```json
{
  "schemaVersion": 1,
  "shortcuts": {
    "prefix": "Ctrl+B",
    "bindings": {
      "next-tab": ["Prefix+N", "Prefix+Right"],
      "open-fleet-settings": []
    }
  }
}
```

A command the document names takes exactly the bindings given, **including none at all**; a command
it does not name keeps its shipped default. An empty list is a real answer and no default comes back
behind it.

The document is accepted or rejected **whole**. An unknown setting, an unknown command id, a binding
the grammar refuses, a binding listed twice, one binding on two commands, or a direct binding on the
prefix itself refuses the entire document and names the entry at fault; the bindings in force do not
change. A chord no browser hands to a page — `Ctrl+N`, `Ctrl+T`, `Ctrl+W`, their `Shift` variants,
`Ctrl+Tab`, `Ctrl` with a digit — is refused, because binding it would produce a key that can never
fire. A chord only SOME browsers keep is accepted and marked browser-dependent instead.

Settings edits the same document in a text area and validates it identically. It sends back the
version it read, so a save cannot silently overwrite a change made on disk: the mismatch is refused
and the current document is handed back.

## Retained Collie deployment alternatives

Collie's Tailscale serve and `Tailscale-User-Login` implementation remains in the repository to keep
the upstream fork reviewable. The Fleet lead profile does not use it: the launcher forces loopback,
sets `COLLIE_SKIP_SERVE=1`, supplies the public Host/Origin, and removes conflicting inherited
Tailscale or device-trust values. In this profile the Fleet password/session Gateway is the public
authorization boundary; a retained upstream header check must not be treated as one.
