## Context

See `proposal.md` and the two delta specs. Collie separates the two halves of a membership change
cleanly: `bridge/pack/enrollment.ts` holds pure transitions over trust-store data (`mintInvite`,
`consumeInvite`, `enrollPeer`, `acceptEnrollment`, the exchange's parsers), and `TrustStore.update()`
is their single persistence seam. Everything that assumes a service manager or an upstream plugin
identity lives above them in `cli/**`: `cli/context.ts` fixes the plugin id in a constant and
`cli/lifecycle.ts` picks a supervision tier by probing the host.

Fleet already consumes the read half of that lower seam — `fleet/pack-authority.ts` imports
`TrustStore.load()` and `deriveMode()` from a fork-owned module with no invasive path. The write half
is available on exactly the same terms.

## Goals / Non-Goals

**Goals:** enrol one peer with no service manager anywhere in the path; reuse every transition rather
than reproducing one; keep enrolment an explicit operator act; leave process control entirely to the
plugin's own supervisor.

**Non-Goals:** rotation, removal, leaving, promotion, deputy; performing a real enrolment; any change
to `bridge/**`, the Pack wire, the router, loaders or Pack UI; any change to how children are
supervised.

## Decisions

### 1. Drive the transitions directly instead of teaching the CLI about this fork

The alternatives were sized before choosing:

- Wrap every CLI call in an environment that suppresses its service path: no fork change, but the
  suppression has to be remembered at every call site forever, and forgetting once reproduces the
  incident this change exists to prevent.
- Make the upstream CLI fork-aware — its plugin-id constant, or a new supervision tier that shells
  out to the plugin action: two upstream files and an invasive entry in `FORK.toml`, and it leaves
  Fleet maintaining upstream's service-manager assumptions indefinitely.
- Apply the transitions from a fork-owned module: no upstream file changes, no invasive path, and the
  service-manager question never arises because nothing in the path asks it.

The third is chosen. It is also the shape the authority module already established, so the fork gains
a pattern rather than a second one.

### 2. Two operator commands on the entrypoint Fleet already has

`fleet/main.ts` grows `pack-invite` and `pack-join` beside `config-check`. A separate binary would be
a second thing to deploy and to keep in step, and a plugin action would put a membership change one
tap away in a UI, which is precisely the accident this change is guarding against — an operator types
these deliberately.

### 3. Neither command controls a process; each names the restart

A membership change lands in the trust store, and the running runtime read that store at boot. Rather
than restart anything, each command prints the exact plugin action that applies it. Fleet therefore
contains no process control at all, on any host, which is what makes the absence of a service manager
a non-question rather than a supported configuration.

### 4. The token is never an argument

`pack-invite` prints the token once, to standard output, and never to a log or a diagnostic.
`pack-join` reads it from standard input or an owner-only file and refuses a literal argument with a
message naming both accepted forms. This is Collie's own rule (`PACK_PROTOCOL.md` §8.3, world-readable
`/proc/<pid>/cmdline`), applied at Fleet's own surface rather than inherited by accident.

### 5. Identity is minted on the operator's first act, exactly where Collie mints it

A trust store is created only when an operator mints an invite or joins — the same single path
upstream uses, so a runtime that never enrols still writes nothing and the zero-tax contract holds
unchanged. The owned module reuses `identityMinter`, `selfIdentity` and `createTrustStore` rather than
producing key material of its own.

### 6. The exchange is Collie's own request and response over the peer's own projection

`pack-join` builds an `EnrollRequest`, posts it to the lead's exported enrolment path, and parses the
reply with Collie's own `parseEnrollResponse`. The address it posts to is a loopback endpoint on the
peer — its own projection of the lead — so the plaintext hop is inside the SSH link, which is the
assumption the protocol documents rather than a weakening of it. No new wire shape is defined.

## Risks / Trade-offs

- **[An operator reaches for the upstream verbs anyway]** → the public documentation names Fleet's
  commands and says plainly why the upstream ones must not be used here.
- **[A half-finished exchange]** → the invite is spent on the lead whether or not the peer completes,
  which is Collie's own rule; the peer writes nothing until it has a parsed response, so neither side
  is left partially enrolled.
- **[The lead is not restarted between mint and join]** → the enrolment path does not exist until the
  running lead has read the store, so the join fails visibly rather than silently half-succeeding.

## Migration Plan

1. Add the owned module and its focused tests behind injectable seams, so the exchange is testable
   without a network or a key.
2. Add the two subcommands and pin their refusals.
3. Update `FORK.toml`, `CHANGELOG.md` and the public documentation.
4. Roll back by redeploying the previous commit: the change adds no state and no runtime behaviour.
