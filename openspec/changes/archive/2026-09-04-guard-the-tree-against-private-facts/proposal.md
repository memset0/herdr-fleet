## Why

This product is developed against the operator's own production environment, so every bug report,
every reproduction and every fixture starts life carrying a real host, a real domain, a real port or
a real path. The rule that none of it may reach this repository is written down and has been enforced
by remembering to look — which has already failed twice in one working session: once in a guard whose
deny-list spelled out the very values it existed to exclude, and once in a test fixture whose host
label was a real machine's name. Both were caught by a scan that happened to be run.

A rule enforced by remembering is not enforced. The other three things this repository refuses to get
wrong — a drifting version, a lint regression, an undeclared pack-wire change — each have a guard that
runs whether or not anyone remembered.

## What Changes

- Add a check that refuses a tree carrying a private fact, and run it as a fourth pre-commit guard
  beside the three that already exist, with its own independent escape hatch.
- Detect by SHAPE rather than by a list of forbidden values: an address outside loopback and the
  documentation ranges, a path under someone's home, and material shaped like a credential. A guard
  that names the values it excludes is itself the leak.
- Scan what this fork owns, read from the fork manifest. Upstream's own fixtures name upstream's own
  author and are already public in its repository; reporting them is how a guard gets switched off.
- Read the operator's own names from the ignored local context file when it is present, so the values
  that have no usable shape — a machine called by an ordinary word, and every hostname — are caught
  too without any of them entering the repository.
- Exempt the publisher's own identity explicitly: the repository owner, the license attribution and
  the stable plugin identifier are intentional public metadata.

Non-goals:

- Scanning history, a remote, or anything outside this repository's tracked tree.
- Replacing review, or claiming completeness: a bare word with no shape and no entry in the local
  list still passes, and the check says so rather than implying otherwise.
- Any change to what the product does.

## Capabilities

### Modified Capabilities

- `fleet-plugin-runtime`: Make the public-safety rule something a check enforces rather than a habit,
  and state how it detects.

## Impact

- Adds one check script, its tests, and a fourth guard in the pre-commit hook with its own hatch.
- Changes no product behaviour and no existing guard.
