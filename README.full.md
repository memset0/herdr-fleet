# Herdr Fleet (Web Remote): Full Reference

> This is the maintained, comprehensive feature reference. For the concise project overview, see
> [README.md](./README.md). User-visible Fleet, Collie, shortcut, topology, security, fallback, and
> lifecycle changes must keep this document current.

Herdr Web Remote adds a password-protected public Fleet dashboard and one native
[Collie](https://github.com/AltanS/collie) UI per Herdr host. It is a Herdr 0.8.2+ plugin and does
not install a system service, configure Tailscale, or expose a raw bridge port.

The same plugin release ships a Linux/Darwin, normally dormant ttyd emergency terminal. The normal
Web Remote supervisor owns its lightweight node control on every Fleet node and its ingress on the
Fleet host. Idle state contains no ttyd or writable attachment; an authenticated desktop navigation
opens one bounded existing-Pane attachment. It is not a second plugin, service, or Collie path.

For maintainers, [`FORK.toml`](./FORK.toml) records the exact Collie baseline and separates owned
modules from invasive Collie ports. Gateway UI code lives under `gateway/fleet-ui/`, shared
protocols under `shared/fleet/`, and node-side additions behind the
`web/src/downstream/fleet/` and `bridge/downstream/fleet/` barrels. Read
[`UPSTREAM.md`](./UPSTREAM.md) before synchronizing Collie and run the checker/reviewer named in
[`CLAUDE.md`](./CLAUDE.md); the manifest intentionally does not duplicate historical patches.

The Collie-derived node UI can inspect and control panes, switch among every locally discovered
named Herdr session, and keep its native deep links:

```text
https://node.herdr.example.com/?session=<session-name>
https://node.herdr.example.com/pane/<pane-id>?session=<session-name>
```

The Fleet page is a responsive Collie shell. Phone widths keep an independent Host-only AppBar
switcher and expandable Agent menu. The AppBar `H` opens the hierarchical Host tree in a separate
bounded left drawer; both views share inventory and selection state, but opening or disclosing the
tree does not move, rebuild, or reset the AppBar switcher. The drawer is mutually exclusive with the
Agent menu and closes after tree navigation without disturbing the selected iframe. Wider
intermediate windows remove the old 640 px shell limit; at 1200 px, Fleet reflows
into a Collie-styled `Host → Space → Tab → Pane` Explorer, one full-height native iframe, and the
existing Agent sections as a persistent right rail. The left rail omits a redundant `Hosts` title
and keeps the new-tab action at its top right; the right rail omits the redundant `FLEET / All
Agents` title and keeps the canonical refresh status at its bottom. Hosts start expanded to show
every Space. A Host body opens that Host's native Collie home while its chevron changes only local
disclosure; Space and multi-Pane Tab rows remain disclosure-only. A one-Pane Tab is flattened into a
single direct row labelled by the Tab and decorated with the Pane's Agent status or `shell`, while
multi-Pane Tabs retain explicit Pane children. There is no desktop AppBar above the iframe.

The compact drawer/footer slide together, and Host/Space/multi-Pane Tab groups animate bounded
height/opacity disclosure. Branches use Collie's Lucide `ChevronRight` in the same centred `.5rem`
leading slot as direct Pane status dots, keeping sibling labels aligned; reduced-motion preference
removes the transitions without changing state or accessibility.

Both desktop rail boundaries are pointer- and keyboard-resizable. Fleet remembers bounded left and
right preferences in that browser, clamps them to preserve the 40rem centre after viewport changes,
and uses the shipped widths when storage is missing or invalid. The separators and preferences do
not affect compact layouts.

The desktop Host rail and the open compact `H` drawer end in a small version/settings footer. Its
only mutable setting controls how many Host pages this browser keeps resident (1–10), while the same
popup also discovers the effective command catalog and bindings. The browser-local cache override
applies immediately, can be reset to the Gateway-provided default, and shrinking it evicts only the
oldest non-selected frames. Reachable Host and Space rows expose
separate `+` actions in both presentations: Host creates a Space in its primary Herdr session, while
Space creates a Tab; both open the fresh shell Pane. Compact controls stay visible for touch instead
of requiring hover.
Right-clicking a reachable Tab or explicit Pane opens one compact action menu; the Context Menu key
and `Shift+F10` expose the same keyboard-navigable surface. Rename hands off to the existing bounded
editor. Close uses Collie's three-second, two-activation confirmation and includes the known Tab
Pane count. A flattened one-Pane row always targets its visible Tab, while an explicit Pane child
targets only that Pane. Successful closure of the displayed Pane/Tab returns the selected Host to
Home; background closure preserves the current iframe and route. Host rename/close remains absent;
Space rename and confirmed close are available through the command catalog.

Fleet derives an **Emergency terminal** link from every enabled node id and the currently selected
Pane/session. It creates that link only in the wide fine-pointer desktop-computer presentation;
phone, tablet, compact, and coarse-pointer presentations omit it from the DOM. Following the link is
the only browser activation action. The permanent ingress rejects rendering, hover, preview,
prefetch, subresource and cross-site requests, validates the existing Fleet cookie locally, and
strips selectors after activation.

Fleet derives this tree from the `workspaces`, `tabs`, Agent panes, and shell panes already present in
the same Collie snapshot fetched for Agent state. Expanding rows makes no request, and the projection
never includes Pane contents or histories. Inside the unchanged iframe, Collie's
redundant home/logo affordance is omitted so the native breadcrumb can use the released header
space. The Pane page also hides its child-owned `Switch pane` trigger row and decorative `Controls`
label/gap because Fleet already owns Pane navigation and surrounding chrome; Keys, Type, Quick,
Agent, Display, the underlying switch sheet, and all behavior remain intact. These cosmetic rules
come from the child's static stylesheet and exact framed root marker—Fleet never reads the
cross-origin DOM. A direct or new-tab Collie page receives no marker and retains the logo, home
action, switch trigger/sheet, Controls label, and original spacing.
Rail resizing never recreates or renavigates a resident iframe. If Collie navigates after initial
load, its exact-window/origin route report remains attached to that cached document while hidden and
when later revealed.

The compact header identifies the Agent menu with an Agent symbol and an inline count covering
`Needs you`, `Ready · unseen`, and `Working`; `Recent` cards do not contribute to that number. An
upper-right Lucide star on every Agent card stores a versioned browser-local favorite keyed by exact
Host, Herdr session, Pane, and Agent implementation. Within each existing status section favorites
sort first, then both favorite/non-favorite partitions retain the same activity ordering. Toggling
does not navigate or refresh, and favorites are intentionally not synchronized through Gateway or
Collie.
The exact Agent navigation control matching the selected Host, normalized Herdr session, and Pane
has `aria-current="page"` and a rounded accent-filled selected surface. Fleet moves this state in
the same route commit as card/tree/shortcut/history/child navigation, without waiting for an iframe
load or aggregate refresh; keyboard focus and Needs-you/Ready-unseen attention remain independent.
Each Agent avatar retains a compact colored dot for its blocked, working, done, idle, or unknown
state in both light and dark presentation. An offline card keeps that dot visibly dimmed together
with the section and count treatment implied by its last successfully observed state while
remaining visibly stale. The adjacent arrow-leaving-a-square control opens the selected Collie in
a new tab. Fleet intentionally exposes no logout button in this header.

Desktop Fleet owns one discoverable command catalog and its effective keyboard bindings. Bindings
are either simultaneous direct chords such as `Alt+J` or sequential prefix chords such as
`Ctrl+B`, release, then `J`; the default prefix is `Ctrl+B`. Prefix capture lasts two seconds and is
cancelled by Escape, an unsupported key, blur, or a hidden document. Fleet matches physical key
codes, exact modifiers, and no repeats. Direct chords remain subject to browser, operating-system,
and extension interception, while prefix chords avoid most multi-modifier conflicts.

`Ctrl+Shift+P` and `Ctrl+B`, then `?`, open the command palette. A blank input lists every available
command. A leading `/` searches command ids, English names, and effective binding labels using
space-separated terms; other non-empty input modes are visibly reserved. Arrow keys move the
selection, Enter invokes it, and Escape dismisses the dialog. The same dialog shell supplies the
Fleet-owned Space, Tab, and Pane rename inputs. The settings popup lists every command, all of its
effective aliases, and commands that are explicitly unbound.

The packaged defaults include prefix actions for settings, the palette, animated dual-sidebar
collapse, Space/Tab/Pane creation, rename and close, current-Space Tab navigation, current-Tab Pane
navigation, and Pane fit. The retained direct defaults are `Alt+K` / `Alt+J` for previous/next Pane
in complete left-tree order, `Alt+H` / `Alt+L` for previous/next Agent in complete right-list order,
`Alt+1`…`Alt+9` for the first nine Agents, and `Alt+S` for Pane fit. The catalog also exposes
unbound commands for the last focused Pane, copying the current Fleet Pane link, toggling Collie's
Type mode, and sending Escape, Enter, arrows, Space, or `Ctrl+C` to the selected Pane. See
[`gateway/shortcuts.default.json`](./gateway/shortcuts.default.json) for the complete executable
catalog and defaults.

Every accepted shortcut shows a fading bottom-centre `<actual binding> · <English command name>`
confirmation; invocation from the palette, settings, or another UI shows only the command name.
Navigation always uses Fleet's canonical selectors and resident iframe cache. Compact/mobile Fleet
and standalone Collie install no active binding or confirmation.

When focus is inside the selected cross-origin iframe, the Web bundle recognizes the same normalized
configuration and forwards only a registered command id. A version-2 exact-window/origin handshake
advertises supported command and child-action capabilities; Fleet invokes only declared adapters for
Pane fit, Type mode, or the fixed send-key actions. Handler registration is bounded and at most once
for the current route generation. Older compatible node bundles retain a deliberately bounded
version-1 subset of the original direct Alt bindings and fail unsupported actions closed.

### Collie node controls

The node UI includes Collie v0.36.1's safer remote-input path. A free-text reply refreshes the Pane,
refuses supported harnesses whose composer is hidden by a dialog, types first, and sends Enter only
after the fresh Pane verifies the text. The explicit type-anyway path still withholds Enter when it
cannot verify the draft. Direct terminal typing is a separate ordered queue: it adds no implicit
Enter, drains long socket writes, and drops pending keys when the selected Pane or page context
changes. Claude Code, Codex, Grok Build, OMP, and AGY receive first-class structured controls;
unsupported or ambiguous terminal states stay on the generic direct-typing path. Password/no-echo
prompts remove recoverable drafts and hand control to explicit direct typing without caching their
Pane text.

Codex behavior is the native Collie v0.36.1 design. The detector recognizes the upstream 0.150.x
customized, reordered, and renderer-styled status forms only beneath the complete column-zero
prompt/draft run. It binds wrapped continuations, distinguishes the dim `Ask Codex to do anything`
placeholder from the same words typed as a draft, and accepts `[Pasted Content N chars]` only when
the count matches the submitted message. A lone prompt, malformed status, transcript echo, dialog,
slash palette, or unrecognized running-turn footer remains raw and fails closed without Enter.

The former downstream Codex adapter is intentionally absent: Web Remote no longer adds its own
slash-palette submit path, running queue-footer recovery, input chunking, or extended stable-read
window. Herdr 0.8.2 was re-probed with one `pane.send_text` request through 40,000 bytes and delivered
the complete payload, so the upstream single-write path is authoritative. A long draft that Codex
does not render verifiably remains in the Pane for inspection and is not submitted automatically.

Pane history can search several comma-separated roots per harness, which supports mixed agent
profiles on one Herdr host. A session is resolved in the first matching root and every later read is
realpath-contained within that same root. Per-root diagnostics cover Claude, Codex, Grok Build, Pi,
and OpenCode stores without relaxing containment. The PWA also carries Collie's multiline,
CJK-width, narrow-Pane, Markdown-table, Ctrl+C, OMP-suggestion, and idle-scroll fixes plus lazy
bundled Nerd Font symbols. Sanitized terminal OSC titles may identify an otherwise unnamed Pane,
but never rename its Tab, route, Fleet notification hierarchy, or explicit Pane/session label.
HTML navigation remains network-first through the Gateway; only validated same-origin font
responses enter the lazy cache.

Optional owner-only `commands.toml`, `keys.toml`, and `quick-replies.toml` files replace the shipped
rows only for their matching Agent scopes and are validated with last-good hot reload. The fixed
keys tray includes F1–F12, and a browser-local Display preference controls whether tapping the mirror
focuses the composer. `COLLIE_AUDIT_CONTENT=none` redacts free-form write content from the action
audit while retaining allowlisted structural fields. The example `.env` also documents the generic
one-shot VAPID key generator; none of these options creates a service or updater.

Successful snapshot and Pane reads write dated, per-Herdr-session mirrors to this tab's
`sessionStorage`, bounded to the four newest Panes. They are used only when transport recovery needs
the last good screen; ordinary navigation remains network-first. No-echo prompts are never stored,
and any definitive 401/403 clears every Collie mirror before the unauthenticated state is rendered.

## Architecture

```text
browser ──HTTPS── reverse proxy ──loopback── Fleet Gateway
                                            ├── local Collie ── Unix socket ── Herdr
                                            └── SSH -L ── remote Collie ───── Herdr

authenticated desktop navigation only:

browser ──HTTPS── /ttyd/<node>/ ── permanent ingress ── node control ── bounded ttyd/Herdr attachment
```

- One Argon2id-backed username/password; no registration, users, roles, or tenant isolation.
- One signed `Secure; HttpOnly; SameSite=Lax` cookie covers the Fleet base domain and node
  subdomains.
- Gateway routes by exact `Host`, strips its session credential, then transparently proxies the
  stock Collie path/query/method/body/response.
- The Fleet Agent menu groups live and visibly stale cards under `Needs you`, `Ready · unseen`,
  `Working`, and `Recent` across all named sessions. An offline card stays interleaved according to
  its last-known status. Choosing one switches the existing iframe to that exact inventory Host,
  session, and Pane.
- Fleet may frame only the exact enabled node origins. Node HTML may be framed only by the exact
  Fleet origin; APIs, assets, Fleet itself, and every unknown host remain non-embeddable.
- Every Collie and Gateway listener is loopback-only. TLS is the operator's reverse proxy's job.
- The plugin's own detached supervisor restarts children with capped backoff. Herdr startup and
  lifecycle hooks idempotently ensure it; it exits after Herdr/plugin health stays absent for a
  grace period. No systemd, launchd, cron, or pidfile is created.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the boundaries and [UPSTREAM.md](./UPSTREAM.md) for
the exact Collie base.

### Fleet Agent refresh

Opening an authenticated Fleet page requests the aggregate immediately. Opening the Agent menu sends
a manual reset with the same request. Activating a live `Ready · unseen` or `Needs you` card also
navigates first and submits that existing bounded reset so the handled state is observed promptly;
Working, Recent, offline/stale, and tree navigation do not reset the schedule. The Gateway—not each
browser tab—owns one adaptive schedule for
the whole aggregate. If a completed collection cycle does not change the visible state, that shared
delay doubles from the effective five-second base to 10 seconds, 20 seconds, and later delays, capped
at one hour. A visible Agent/session/health change or manual reset returns the shared delay to its
base. Browsers receive the canonical next-refresh time and merely schedule their next read from it.

Independently of that one shared backoff, every configured Host has a hard five-second minimum
between the starts of primary snapshot attempts, including attempts that fail. Page loads, menu
opens, retries, and multiple tabs cannot bypass the floor. A request that arrives too early receives
the in-memory aggregate and earliest legal next time without revisiting the Host. Primary discovery
and its reachable named-session fan-out form one Host transaction; named sessions do not acquire
separate backoffs. Overlapping eligible requests are coalesced, and no fixed collector loop polls
nodes while no Fleet page is open unless central Discord Agent notifications are enabled. When they
are enabled, one Gateway-owned wakeup advances this same adaptive schedule in the background; it
does not create another collector, Host visit, or exponential-backoff sequence.

If a Host or one named Herdr session becomes unreachable, its last successful cards stay interleaved
in their last-known triage sections, dimmed and labelled offline with their Host and last observation
age. This cache is memory only and is never presented as live. A later successful snapshot is
authoritative: recovered Agents move to their current status section and Agents no longer reported
disappear. Fleet projects only the card fields needed for this view; Pane output, history,
credentials, update state, device authorization, and unknown snapshot fields remain excluded. The
allowlisted Space/Tab/Pane tree follows the same cache and backoff and is visibly stale on failure;
it never adds a per-Space, per-Tab, or per-Pane network traversal.

## Requirements

- Herdr 0.8.2 or newer
- Bun
- A reverse proxy providing HTTPS
- OpenSSH on the Fleet host only when remote nodes use the SSH transport
- `pingme` with per-send `send --host <LABEL>` support on the Fleet host only when central Discord
  Agent notifications are enabled

Linux and macOS are supported. The plugin and its long-running processes run as the same account
that owns the target Herdr socket.

## Build and install

Herdr's GitHub installer runs the manifest build. A linked checkout must be built first:

```bash
bash scripts/build.sh
herdr plugin link "$(pwd)" --enabled
herdr plugin action invoke ensure --plugin memset0.web-remote
```

The build uses frozen Bun lockfiles, typechecks the bridge/Gateway/supervisor and web app, builds to
a staging directory, runs the generic ttyd companion security/integration tests, then swaps the
completed PWA into place.

## Emergency terminal

The authoritative public architecture, schema-3 inventory, installation inputs, supervisor
variables, status/disable recovery commands, security invariants, and tests live in the
[`services/ttyd-fallback` guide](./services/ttyd-fallback/README.md). Gateway carries no terminal URL
or enablement flag: Fleet derives `/ttyd/<node-id>/`, and the protected terminal inventory must
exactly match the enabled Gateway node ids. Real mappings, signing configuration, SSH identities,
reverse-proxy configuration, and runtime findings remain in the deployment environment.

## Node configuration

Herdr reports the config directory:

```bash
config_dir="$(herdr plugin config-dir memset0.web-remote)"
install -m 0600 .env.example "$config_dir/.env"
```

Set an exact node hostname in both variables:

```dotenv
COLLIE_HOST=127.0.0.1
COLLIE_PORT=8787
COLLIE_SKIP_SERVE=1
COLLIE_PUBLIC_HOSTS=local.herdr.example.com
COLLIE_ALLOWED_ORIGINS=https://local.herdr.example.com
COLLIE_MULTI_SESSION=1
HERDR_WEB_FLEET_URL=https://herdr.example.com/
HERDR_WEB_INSTANCE_ID=local
```

`COLLIE_MULTI_SESSION=1` makes the node UI discover the primary session and all running named
sessions. On a shared home, set `HERDR_WEB_HOST_PREFIX` to the stable Herdr host's hostname prefix;
scheduler jobs are denied by default. `HERDR_WEB_FLEET_URL` must be the HTTPS Fleet origin root,
and `HERDR_WEB_INSTANCE_ID` must match this node's stable Gateway inventory id. They are public
routing metadata used by the optional Pane-link shortcut; they are not credentials.

Each transcript-root override accepts one directory or several comma-separated directories searched
in order. Omit them to use the normal harness homes:

```dotenv
COLLIE_TRANSCRIPT_ROOT=/home/operator/.claude/projects,/home/operator/.claude-work/projects
COLLIE_CODEX_ROOT=/home/operator/.codex/sessions
COLLIE_PI_ROOT=/home/operator/.pi/agent/sessions
COLLIE_OPENCODE_ROOT=/home/operator/.local/share/opencode
```

A remote node is deliberately a **zero-central-secret** installation. Its `.env` stops at the
Collie/node settings above: do not set `HERDR_WEB_GATEWAY_CONFIG`, and do not copy `gateway.json`,
the Fleet password hash, session-signing secret, SSH private keys, or another node's files to it.
The remote supervisor then starts Collie only. The central Fleet host reaches that loopback listener
through SSH; the remote plugin never calls back to Fleet and needs no application token.

### Copy the focused Pane's Fleet link

After setting the two public routing variables above, add this portable binding to the Herdr config
that owns the session:

```toml
[[keys.command]]
key = "prefix+ctrl+r"
type = "plugin_action"
command = "memset0.web-remote.copy-pane-url"
description = "copy Web Remote Pane URL"
```

Focus a Pane, press the configured prefix, then `Ctrl+R`. The action copies the canonical outer
Fleet link, for example
`https://herdr.example.com/?instance=local&space=w0&tab=w0%3At2&pane=w0%3Ap3`; a named Herdr session
also gets its URL-encoded `session` selector. The four routing selectors identify the inventory Host,
Space, Tab, and Pane explicitly; the link never contains the password, cookie, Gateway config, SSH
identity, or any Pane contents. A browser without a current Web Remote cookie still passes through
the normal login and then returns to the same deep link.

For `herdr --remote`, connect with the remote server's keybindings:

```bash
herdr --remote <target> --remote-keybindings server
```

Herdr 0.8.2 defaults remote attaches to a snapshot of the viewing computer's local keybindings and
deliberately omits custom command bindings from that snapshot. Consequently, a Web Remote binding
installed on the remote server cannot fire in the default `local` mode. Keybinding mode is chosen
during the client handshake: after installing or changing this binding, detach and reconnect with
`--remote-keybindings server`; `herdr server reload-config` alone cannot switch an already attached
local-keybindings client. A direct local attach, or SSH followed by running `herdr` on the node,
already uses the server configuration and needs no extra flag.

The action deliberately opens a tiny transient plugin popup and emits one OSC 52 clipboard write.
Herdr consumes that write and, for a server-keybindings `herdr --remote` attach, forwards it only to
the foreground viewing client, so the clipboard belongs to the computer at which you are working
rather than the server.
The popup closes after a short drain interval and does not create a Pane or change the tab layout.
If the terminal blocks OSC 52, its clipboard policy remains authoritative. Missing or invalid
routing metadata fails closed and writes no clipboard payload; inspect the Web Remote plugin action
log after correcting the two public variables.

## Fleet host configuration

The Fleet host uses the same node configuration and additionally sets:

```dotenv
HERDR_WEB_GATEWAY_CONFIG=/absolute/path/to/gateway.json
```

Generate a protected single-node config and one-time credential without embedding any secrets in
the repository:

```bash
bun run scripts/generate-config.ts \
  --config-dir "$config_dir" \
  --fleet-host herdr.example.com \
  --base-domain herdr.example.com \
  --node-host local.herdr.example.com
```

The command refuses to overwrite `.env` or `gateway.json`, creates both as mode 0600, and prints the
new username/password once. Use a dedicated cookie base (for example `herdr.example.com`) rather
than a parent shared by unrelated applications. `gateway.example.json` documents local and SSH
inventory entries. Its existing `pollIntervalMs` is the Gateway-owned adaptive-refresh base (5000
by default and clamped to the five-second Host revisit floor), not an unconditional server polling
loop. Optional `fleetUi.iframeCacheSize` accepts an integer from 1 through 10 and defaults to 1.
Setting it to 5 lazily keeps up to five most-recently-foregrounded Host documents alive while showing
only the selected one. Agent/health state never affects eviction; after 30 minutes with no Host
selection or revisit, Fleet silently removes every non-selected iframe. The selected iframe survives,
and Fleet does not invoke or change Collie's own idle lock. The live Gateway config must remain an
absolute-path, owner-only file.

Optional `fleetUi.shortcutsFile` is an absolute path to a complete versioned shortcut document. If
it is omitted, Fleet loads the packaged defaults. If it is present, the external document completely
replaces those defaults: every command id must appear exactly once, an empty array deliberately
unbinds that command, and Fleet does not merge hidden fallback bindings. Invalid, relative,
oversized, incomplete, duplicate, colliding, or unknown definitions fail Gateway startup visibly.
Keep this file separate from the protected Gateway config and secrets. A synthetic complete example
is available at [`gateway/shortcuts.external.example.json`](./gateway/shortcuts.external.example.json);
the `gateway.example.json` path is illustrative and must be replaced with an absolute local path.

A resident Collie page may continue its normal polling while hidden, but it cannot mark a Pane seen.
Fleet sends a versioned browser-only activity message to every exact-origin child; only the selected
iframe in a visible Fleet document, unobscured by a compact Host/Agent overlay, is active. Framed
Collie starts inactive until its exact parent sends that state, and inactive Pane/History reads omit
`x-collie-seen`. Revealing the frame triggers one immediate Pane revalidation, which updates the same
node-owned seen timestamp already consumed by Collie, Fleet, and Discord. Opening Collie directly as
a top-level page keeps its existing seen behavior. This adds no Fleet seen database, does not pause
hidden polling, and does not change cache LRU, quiet cleanup, idle lock, or authenticated write
actions.

Desktop tree mutations reuse those native Collie pages rather than adding a cross-origin Gateway
write proxy. A Host-row `+` creates a Space in that Host's primary Herdr session, while a Space-row
`+` creates a Tab and its first Pane in that exact session. Fleet performs a versioned readiness
handshake with the exact configured child window/origin, sends only one allowlisted
`create-workspace`, `create-tab`, `rename-workspace`, `close-workspace`, `rename-tab`, `rename-pane`,
`close-tab`, or `close-pane` command, and accepts only the correlated result. An uncached Host gets
one temporary inactive child for the
explicit action; it is removed afterward and never joins cache LRU. A timeout is never retried
automatically, so a lost create result cannot duplicate a Tab and an ambiguous close cannot become
a second destructive mutation. A successful current-target close moves to Host Home before the
bounded aggregate refresh; a lost close response waits for authoritative topology disappearance.
Older compatible nodes remain fully navigable but report unknown version-2-only actions as
unsupported until their Web bundle is updated; the bounded legacy contract is never expanded with
new destructive or arbitrary-input payloads.

### Discord Agent notifications

The central Gateway can notify Discord when a successfully fetched Agent newly enters green
`Ready · unseen` (a `done` card whose activity is newer than its last-seen time) or red `blocked`
(`Needs You`). The first successful observation is a silent baseline. A later transition first
becomes an in-memory candidate; Gateway sends only after another authoritative fetch at least ten
seconds later still finds the same reachable Pane identity without an intervening `Working`
(`Running`) observation. Opening the Pane so Ready becomes Recent, moving through idle/unknown, or
switching between Ready and Needs You preserves the candidate and its original deadline; the newest
attention group selects the eventual status and avatar. An offline Host/session is treated as
missing evidence: it preserves the candidate and the last authoritative comparison without sending
from stale data. Recovery of the same Pane resumes the original deadline, while explicit work
resumption, authoritative removal, or identity replacement cancels the event. A confirmed episode
sends once; an offline interval alone never rearms it or repeats the same notification.

Confirmation uses the exact Fleet refresh state described above: the earliest candidate deadline
may bring the one canonical next refresh forward only while that Pane is reachable. A suspended
offline candidate does not pin polling to the five-second floor; recovery is discovered through the
same adaptive/manual schedule and an overdue candidate is evaluated immediately. This creates no
second timer, collector, or backoff. Browser and notification activity still share one adaptive
5-second-to-1-hour delay and the same hard five-second per-Host floor.

Install and privately configure `pingme` only on the Fleet host, under the same account that runs
the plugin-owned supervisor. Then add this object to the owner-only `gateway.json`:

```json
"discordNotifications": {
  "enabled": true,
  "executable": "/usr/local/bin/pingme",
  "channel": "test"
}
```

`executable` must be an absolute regular executable file. `channel` is passed as an explicit
`pingme` channel id or configured alias; the initial validation rollout should use a dedicated
`test` alias before a later configuration change selects a production destination. Gateway never
reads or distributes the CLI's token, webhook, or private config, and remote nodes need no Discord
settings.

With `pingme`'s standard default template, Fleet maps the observed harness, readable Space name,
and readable Tab name into the template's Agent, project, and session-title footer metadata.
It passes the same normalized readable inventory Host carried by the alert through `--host`, so
`runtime.host` identifies the machine that owns the Agent instead of the central Gateway process's
automatically detected `user@hostname`; a missing readable Host name falls back to that node's
stable inventory id without adding a system user. This runtime override is independent of the
custom-template `host` / `host_id` variables and the webhook username.
The Pane name stays out of that metadata because it is already present in the webhook username.
An id-only Tab is omitted and an id-only Space uses the generic `Fleet` project fallback. Known
harness ids use their normal product spelling, such as `codex` → `Codex`, while unknown names are
retained after bounded single-line normalization. Confirmed Ready
alerts explicitly select the configured `success` avatar, while Needs You selects `needs-input`;
the local `pingme` profiles remain the authoritative visual definitions. Each delivery also
overrides the webhook username with the readable hierarchy
`Space Name · Tab Name · Pane Name`. A level missing from an older node is omitted rather than
replaced with an internal id; an unnamed Pane uses Collie's existing Agent-name fallback, and the
complete username is bounded to Discord's 80-character limit.

Only after the ten-second confirmation succeeds, Gateway makes at most one direct, timeout- and
size-bounded request to that Pane's existing History route through its configured transport. It
omits Collie's seen-attribution header, selects only text parts from the newest qualifying
Assistant entry, normalizes terminal controls, removes blank lines, and caps the reply at 1,000
Unicode characters.
User turns, reasoning, tools, summaries, notes, and all other transcript entries remain excluded;
the reply is held only for the in-flight notification and never enters Fleet state, caches, logs,
or backoff. Disabled, unsupported, malformed, oversized, or unreachable History degrades without
retry to the original link-only notification.

The message body contains that compacted final reply followed immediately by one clickable canonical
Fleet Pane link on the last line—there is no `Agent completed` / `Agent needs you` title and no
repeated context block. A
rendered message has this shape with all default metadata on the final subtext line:

```markdown
The requested change is complete.
[Open Pane in Fleet](https://herdr.example.com/?instance=cluster-a&space=w0&tab=w0%3At2&pane=w0%3Ap7)
-# 🏠 Cluster A   📦 Example project   🧵 Main   🤖 Codex   📅 8/15 12:34:56
```

The default presentation includes no terminal contents, complete history, user prompt, reasoning,
tool traffic, cookie, credential, or SSH material. The state is intentionally implicit in the
notification event rather than repeated in the body.

Omitting `template` uses `pingme`'s existing default template. A custom selector can be supplied as
`"template": "fleet-alert"`; Fleet forwards the selector unchanged, so an absolute `.md` path also
works once the installed `pingme` version supports absolute template selectors. Custom templates
receive `agent`, `status`, `status_label`, `host`, `host_id`, `workspace`, `workspace_id`, `tab`,
`tab_id`, `pane`, `pane_id`, `session`, `observed_at`, `pane_url`, and optional `agent_reply`
variables in addition to the composed default `message`, Agent/project runtime metadata, readable
Tab session title, and state-specific avatar. History resolution and delivery are serialized outside the
collector; delivery uses one direct child process at a time, never a shell. Its 120-second outer
bound allows `pingme` to finish its own bounded Discord request instead of killing it at the
ten-second Agent confirmation interval. A failed History read falls back once, while a failed
delivery emits only a sanitized timeout/unavailable/exit class; neither is automatically retried,
avoiding an ambiguous timeout producing a duplicate Discord message.

An SSH transport may omit `jump` for a direct connection or add the structured `jump` object shown
in `gateway.example.json` when the target is reachable only through a bastion. The jump endpoint has
its own absolute private-key and pinned known-hosts paths. Gateway builds both SSH layers with
`-F /dev/null`, strict host-key checking, batch-only public-key authentication, no agent forwarding,
and no connection multiplexing; it does not inherit an operator's `~/.ssh/config`. The outer target
still owns exactly one loopback `-L`, while the jump process is limited to the stdio connection
needed by that target. A transport remains `starting` until its local forward actually accepts a
connection, and failed attempts retain capped exponential backoff.

For each SSH node, generate a new key on the Fleet host and never reuse or agent-load it. Keep its
private half and pinned host-key data on Fleet only; copy only that node's `.pub` line to the remote
account. For example, using synthetic names:

```bash
install -d -m 0700 /home/operator/.config/herdr-web/ssh
ssh-keygen -q -t ed25519 -N '' \
  -f /home/operator/.config/herdr-web/ssh/cluster-a
```

The remote `authorized_keys` entry should grant only the required forwarding destination. Modern
OpenSSH accepts this form (replace the placeholder with the contents of `cluster-a.pub`):

```text
restrict,port-forwarding,permitopen="127.0.0.1:8787" <cluster-a-public-key>
```

`restrict` keeps PTY, agent, X11, and user-rc access disabled; `port-forwarding` re-enables forwarding
only, and `permitopen` limits the `-L` destination. Validate the target OpenSSH behavior before
enrollment and fail closed on older servers rather than installing an unrestricted key.

Gateway additionally ignores user/system SSH configuration, disables connection multiplexing and
all ambient authentication mechanisms, and opens one explicit batch-mode loopback `-L`. It rejects
two enabled nodes whose target identity paths or private-key contents match. A jump identity must
also differ from every enabled target identity; one bastion identity may serve multiple jumped
nodes. Removing a node therefore means deleting only its inventory entry and central target private
key plus its one remote public-key line; rotating it does not affect other nodes.

Point every concrete Fleet/node hostname at the Gateway loopback listener in the reverse proxy. A
true wildcard certificate is optional; listing concrete hosts works with ordinary ACME HTTP
challenges.

## Lifecycle

```bash
herdr plugin action invoke ensure  --plugin memset0.web-remote
herdr plugin action invoke status  --plugin memset0.web-remote
herdr plugin action invoke restart --plugin memset0.web-remote
herdr plugin action invoke stop    --plugin memset0.web-remote
```

`ensure` is concurrency-safe and replaces an older code generation. `stop` affects only Web Remote;
it does not stop Herdr or any pane. Logs and runtime state live in the plugin state directory with
owner-only permissions. The control socket is node-local (`$XDG_RUNTIME_DIR`, or the OS temporary
directory), so a shared-home pidfile cannot make one cluster node manage another.

## Security model

Authenticated Collie access is equivalent to terminal control as the Herdr account. Keep these
invariants:

- Gateway and Collie bind loopback only; expose only the TLS reverse proxy.
- Keep the operator password hash, session-signing secret, full inventory, every SSH private key,
  and pinned known-hosts files on the Fleet host only. Protect its `.env` and `gateway.json` as mode
  0600.
- Give every remote node a different SSH identity. A remote host receives only its own restricted
  public authorization and Collie configuration—never `gateway.json`, a private key, or a Fleet
  authentication value.
- Do not use SSH agent forwarding or a shared Fleet key. Gateway also removes its cookie and request
  `Authorization` before contacting Collie and refuses an upstream `Set-Cookie` that targets the
  Gateway cookie name.
- Keep exact public Host/Origin lists; unknown node hosts fail closed.
- Keep the generated frame policy exact. Do not replace configured Fleet/node origins with a
  wildcard or disable the Gateway's CSP/X-Frame-Options handling.
- Do not place another authentication proxy in front of only some node routes. Gateway authentication
  must cover every API and navigation uniformly.
- Static PWA update assets may load before login so an installed app can refresh; pane/session APIs
  and all navigations still require a valid session.

## Development

### Version compatibility

Patch versions within one major/minor line are deployment-compatible. For example, a `2.0.4`
central Gateway may continue serving a remote node on `2.0.2`; patch-only changes do not require
remote plugin reinstallation and nodes may update later. A change that requires remote plugins to
be reinstalled increments the minor version and is not released until the operator approves the
exact target version and rollout. The major version changes only on an explicit operator directive.

Normal validation runs `scripts/check-version.sh`. A release additionally runs
`scripts/check-version.sh --release`, which compares the candidate to the latest strict `vX.Y.Z`
tag, rejects skipped or malformed transitions, and enforces exact approval for minor and major
releases.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
cd web && bun install --frozen-lockfile && bun run typecheck && bun run test
cd .. && bun run build
```

The project remains MIT licensed and retains Collie's upstream copyright/history. Keep fixtures,
docs, and examples synthetic; never commit deployment credentials or runtime/session data.
