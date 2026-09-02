# Herdr Fleet (Web Remote)

A self-hosted multi-host fleet console for [Herdr](https://github.com/herdrdev/herdr), built on
[Collie](https://github.com/AltanS/collie).

Herdr Fleet extends Collie with a desktop-first workspace designed to make multi-host agent
operations faster. Monitor every agent, move between hosts and panes, and reach the right session
without leaving a single console.

## Features

Herdr Fleet builds on Collie with:

- **Fleet-wide agent overview** — See agents across every host in one place, grouped by status so
  you immediately know what is working and what needs your attention.
- **Keyboard-first control** — Bring Herdr's fast native keyboard workflow to the browser with
  shortcuts for navigating and operating panes across hosts.
- **Unified agent explorer** — Browse, search, and jump to any host, space, tab, pane, or agent from
  a list or hierarchical tree.
- **On-demand emergency terminal** — Open an authenticated, ttyd-based Herdr terminal when direct
  terminal access is needed. The terminal remains dormant until explicitly activated.

## Architecture

```text
                              +--------------------+
                              |  Operator browser  |
                              +----------+---------+
                                         |
                                       HTTPS
                                         |
                              +----------v---------+
                              |     Fleet host     |
                              | Console + Gateway  |
                              +----------+---------+
                                         |
                    +--------------------+--------------------+
                    |                    |                    |
             local / SSH tunnel   local / SSH tunnel   local / SSH tunnel
                    |                    |                    |
          +---------v--------+ +---------v--------+ +---------v--------+
          | Herdr host A     | | Herdr host B     | | Herdr host N     |
          |                  | |                  | |                  |
          | Collie           | | Collie           | | Collie           |
          |    |             | |    |             | |    |             |
          |    v             | |    v             | |    v             |
          | Herdr            | | Herdr            | | Herdr            |
          |    |             | |    |             | |    |             |
          |    v             | |    v             | |    v             |
          | Agent panes      | | Agent panes      | | Agent panes      |
          | Codex / Claude   | | Codex / Claude   | | Codex / Claude   |
          +------------------+ +------------------+ +------------------+
```

To preserve Collie's native node experience and minimize changes to its data path, Herdr Fleet runs
one Collie instance on every Herdr host. A central Fleet Gateway aggregates fleet-wide status and
routes browser interactions, while each Collie instance continues to communicate directly with its
local Herdr runtime and agent panes.

Local nodes are reached over loopback, while remote nodes connect through SSH tunnels. Collie
listeners remain loopback-only on every host.

For complete feature, configuration, lifecycle, and security details, see the maintained
[full reference](./README.full.md).
