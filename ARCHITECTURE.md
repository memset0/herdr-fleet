# Architecture

Herdr Web Remote is two cooperating applications managed by one plugin-owned supervisor.

## Node plane

Each Herdr host runs the Collie-derived Bun bridge as the Herdr owner. It binds a configured
loopback address and talks to the primary and named Herdr Unix sockets. Its React PWA, API,
session selector, pane deep links, terminal reads, and terminal writes remain Collie's native data
path. The bridge knows only its own host; it never contacts the Fleet or publishes itself.

Remote input is deliberately read-before-write. A structured free-text reply takes a fresh Pane
snapshot, fails closed when a supported harness positively lacks a visible composer, writes the
draft, and emits its submit keys only after a second read verifies that text. A deliberate
type-anyway override skips only the composer refusal, not submit verification. Direct terminal
typing uses an ordered queue with no implicit Enter and invalidates pending input on Pane changes,
page lock/backgrounding, or failure, so old keys cannot spill into a later context.

Harness transcript settings accept several ordered roots. Discovery selects the first root that
contains the reported session and binds subsequent reads to its realpath; the existing containment
check is applied relative to that selected root rather than to a caller-derived path. The Web bundle
keeps every HTML navigation network-first so an expired Gateway session cannot be bypassed by the
PWA. Lazy Nerd Font responses use a separate cache and are stored only when the same-origin fetch is
an unredirected 200 with a font content type; obsolete named font entries are swept on activation.

An optional Pane-context action turns the focused Space, Tab, and Pane ids plus public Fleet
origin/instance metadata into the canonical outer deep link. Because plugin-action stdout is logged rather than connected to
the terminal, the action opens a transient plugin popup whose single OSC 52 write is consumed by
Herdr. A headless server forwards that clipboard event only to its foreground client. The popup
contains no Gateway credential, never reads terminal contents, and leaves the tiled layout intact.

## Fleet plane

One optional Gateway loads a static, owner-only JSON inventory. A local node maps directly to a
loopback URL. A remote node maps to a persistent OpenSSH local forward, either directly or through
one explicitly configured jump endpoint. Both SSH endpoints ignore ambient configuration and pin
their own host key and private identity. The target owns the single loopback forward; the jump is a
stdio proxy only. A transport becomes ready only after that forward accepts a loopback connection.
Transport processes, bridge HTTP health, and Herdr/session health are separate states, so one failed
node never blocks another.

The Gateway has exactly one operator credential. Argon2id verifies the password; HMAC-SHA256 signs
an expiring cross-subdomain cookie. Browser navigations without a session enter `/auth/`; APIs get
401. Authenticated requests to a configured node hostname are proxied byte-for-byte at the HTTP
layer after the Gateway cookie and ambient authorization headers are removed. Exact Host and public
Origin semantics are preserved for Collie's DNS-rebinding and CSRF checks. Unknown hosts are never
mapped to a default node. Upstream response cookies are preserved except for any cookie whose name
matches the Gateway session cookie, so a node cannot shadow, clear, or replace the central browser
credential.

An authenticated `/api/fleet` read drives one coalesced collector refresh. There is no unconditional
Gateway polling while no Fleet page is open unless the optional central Discord notifier is enabled;
in that mode one background wakeup advances the very same collector and canonical adaptive
schedule. The collector reads each node's primary snapshot and fans out across its reachable named
sessions. It validates and projects only stable instance, session, health, and Agent-card fields.
Pane contents, histories, device authorization, update metadata, credentials, and unknown response
fields never enter the aggregate.

The Fleet page uses that projection to render a single horizontal instance switcher, a bounded
cross-host Agent menu in Fleet's own header, and exactly one selected node origin at a time. The
menu follows Collie's triage/card vocabulary, adds the owning Host, and turns a card selection into
the existing canonical instance/session/Pane route. The iframe still owns the complete native
Collie route stack and every terminal operation; Fleet does not reproduce Pane views or actions.
The shared native Header omits its complete Collie home/logo affordance when framed, releasing that
space to the breadcrumb, while the same top-level page retains the mark, connection animation, and
home action. This presentation decision lives in each node Web bundle, so an older compatible node
may retain the old embedded mark until its normal upgrade.

Each browser requests Fleet immediately on load and sends a manual reset when the menu is opened.
The Gateway owns one request-driven adaptive delay and canonical next-refresh time for every tab.
Unchanged completed cycles double that shared delay from the effective base (at least five seconds)
up to one hour; visible changes and manual menu opens reset it. A fixed per-node gate also prevents
successive primary collection attempts from starting less than five seconds apart, including after
failure. Early requests receive cached state and the canonical next time. One eligible node
transaction includes primary discovery plus named-session fan-out; neither nodes, sessions, nor
browsers maintain another exponential sequence.

The Gateway keeps only an in-memory, per-node/session last-known Agent cache. A failed source leaves
its cards visibly offline/stale but interleaved in the normal triage sections according to the last
successfully observed status and timestamps; the next successful snapshot replaces that source
authoritatively, including confirmed removals.

When central Discord alerts are configured, a second memory-only ledger consumes completed live
collector cycles. It silently baselines first-seen Pane identities and creates a candidate when a
later authoritative observation enters `Ready · unseen` or `Needs You`. The candidate retains its
original deadline across Recent, idle, unknown, and attention-group changes; the latest actionable
group selects delivery status. A second authoritative observation at least ten seconds later
confirms the same reachable Pane unless it entered `Working`/`Running`. An unreachable cached card
is missing evidence: it changes neither the candidate nor the last authoritative comparison, and
recovery of the same identity resumes the episode. Explicit work resumption, authoritative removal,
or identity replacement still cancels. A confirmed episode sends once and an offline interval does
not rearm it. The ledger returns the earliest deadline only for currently reachable candidate
cards, so an expired suspended candidate cannot clamp repeated outage polling to the five-second
Host floor or add another timer/backoff.

The adapter constructs the canonical Fleet instance/Space/Tab/Pane link plus an optional named-session
selector and invokes an absolute
local `pingme` executable without a shell. Channel/template selectors and safe Agent-card variables
cross that process boundary, but Discord credentials remain in `pingme`'s own private local config
and never enter Gateway or any remote node. The adapter passes the normalized readable name of the
Agent's exact inventory Host through `pingme send --host`; an unavailable readable name falls back
to that node's stable id, never the central process's automatically derived user and hostname. This
reserved runtime value remains independent of the stable custom-template Host variables and the
webhook username. The default-template runtime footer also receives the observed harness's
human-readable name, readable Space name as project, and readable Tab name as session title. It
never receives a Pane label or coding-session id. Ready and Needs You explicitly select the configured
`success` and `needs-input` avatars respectively. The webhook username is independently overridden
with the bounded readable `Space · Tab · Pane` hierarchy, omitting absent levels instead of exposing
their internal ids and using the existing Agent display name for an otherwise unnamed Pane.

For a confirmed alert only, the serialized delivery queue makes one bounded request to the Pane's
native History route through the same configured transport and exact Host mapping. The request does
not carry seen attribution and does not re-enter collection. Runtime validation selects only the
newest Assistant entry with text, excludes every other role and part kind, normalizes controls,
removes blank lines, and caps the ephemeral reply. The default message places that compact reply
immediately before the canonical Markdown Pane
link; the bounded reply is also an optional custom-template variable. Unavailable or incompatible
History falls back to the byte-compatible link-only body without a retry, and neither transcript
content nor unsafe failure details enter state or diagnostics. The delivery child has a 120-second
outer deadline so `pingme` can complete its own bounded Discord operation without being killed at
the ten-second Agent confirmation interval. Known failures log only a closed
timeout/unavailable/exit class and are not automatically retried, because a process timeout can be
ambiguous after Discord has accepted a message.

Embedding is deliberately asymmetric. Fleet's document CSP permits `frame-src` only for exact,
enabled node origins and Fleet itself stays non-embeddable. The Gateway rewrites only proxied node
HTML documents to permit the exact Fleet origin as `frame-ancestors`; node APIs/assets retain
`X-Frame-Options: DENY`. The shared authenticated cookie is available to the node iframe because all
public hosts are same-site subdomains, but the Gateway credential is stripped before proxying.

## Process ownership

Herdr startup and selected low-volume lifecycle events run the same one-shot control client. A
node-local Unix socket and atomic launch directory converge races on one supervisor. A source
generation digest lets a new checkout ask the old supervisor to relinquish ownership.

The supervisor owns Collie and optional Gateway children, restarts crashes with capped exponential
backoff, rotates bounded process logs, and periodically checks both `herdr status server` and the
plugin's enabled registration. Sustained failed ownership health triggers graceful child shutdown
and control-socket removal. A hostname prefix and scheduler-environment gate prevent shared-home
jobs or non-designated login nodes from claiming listeners.

This layer deliberately does not create an OS service. Complete supervisor death is recovered by
the next Herdr hook or manual `ensure`; child death is recovered immediately by the supervisor.

## Trust boundaries

1. The TLS reverse proxy is the only public listener.
2. Gateway is the only authentication boundary.
3. Loopback is a host boundary, not per-Unix-user isolation.
4. The Herdr socket is the terminal-control authority.
5. The Fleet password verifier, cookie-signing secret, inventory, pinned target/jump host keys, and
   every SSH private key exist only on the central Gateway host. A remote node runs Collie without a
   Gateway config or application credential.
6. Every SSH target node has a different private identity. Only its public half is installed
   remotely, restricted to the required loopback Collie destination. A jump identity is distinct
   from every target identity and may be shared only by transports that intentionally use the same
   bastion; Gateway never forwards an SSH agent or reuses a multiplexed connection.
7. Gateway consumes its session credential before proxying and filters the same privileged cookie
   name from upstream responses. Exact per-node Origin checks prevent one node origin from issuing
   terminal writes to another.
8. Fleet Agent aggregation is an allowlist projection from already authenticated snapshot routes;
   it cannot request Pane output or turn an unvalidated Host, session, or Pane value into a route.

Because authenticated writes can type into a real terminal, a Gateway compromise has the same
impact as the Herdr account on configured nodes. A compromised node still controls content on its
own node origin, but receives no credential that authenticates to Fleet or another node. No
multi-user isolation or node-content attestation is claimed.
