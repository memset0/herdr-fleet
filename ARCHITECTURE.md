# Architecture

Herdr Web Remote is two cooperating applications managed by one plugin-owned supervisor.

## Node plane

Each Herdr host runs the Collie-derived Bun bridge as the Herdr owner. It binds a configured
loopback address and talks to the primary and named Herdr Unix sockets. Its React PWA, API,
session selector, pane deep links, terminal reads, and terminal writes remain Collie's native data
path. The bridge knows only its own host; it never contacts the Fleet or publishes itself.

## Fleet plane

One optional Gateway loads a static, owner-only JSON inventory. A local node maps directly to a
loopback URL. A remote node maps to a persistent OpenSSH local forward. Transport processes,
bridge HTTP health, and Herdr/session health are separate states, so one failed node never blocks
another.

The Gateway has exactly one operator credential. Argon2id verifies the password; HMAC-SHA256 signs
an expiring cross-subdomain cookie. Browser navigations without a session enter `/auth/`; APIs get
401. Authenticated requests to a configured node hostname are proxied byte-for-byte at the HTTP
layer after the Gateway cookie and ambient authorization headers are removed. Exact Host and public
Origin semantics are preserved for Collie's DNS-rebinding and CSRF checks. Unknown hosts are never
mapped to a default node.

The Fleet collector consumes only stable Collie snapshot summary fields for instance identity and
health. The Fleet page uses those fields to render a single horizontal instance switcher and embeds
exactly one selected node origin at a time. The iframe owns the complete native Collie route stack,
so opening a session or pane stays inside Collie's UI and does not require a parallel Fleet data
model. Switching instances navigates that one iframe to the selected node's root.

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
5. SSH keys on the Gateway should be per node, pinned, and restricted to the required loopback
   forward.

Because authenticated writes can type into a real terminal, a Gateway compromise has the same
impact as the Herdr account on configured nodes. No multi-user isolation is claimed.
