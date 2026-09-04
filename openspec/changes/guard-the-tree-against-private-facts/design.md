## Context

Three guards already run at commit time — version consistency, lint over staged files, and the
pack-wire decision — each with its own `SKIP_*` hatch and each independent of the others. Public
safety is the fourth thing this repository refuses to get wrong and the only one with no guard. The
ignored local context file already exists and already holds the operator's private deployment facts.

## Goals / Non-Goals

**Goals:** the rule runs whether or not anyone remembered; it never itself carries a private value;
it is honest about its blind spot.

**Non-Goals:** history, remotes, completeness, and any product behaviour.

## Decisions

### 1. Shapes, not a deny-list

A deny-list has to name what it forbids, which puts those names in the tree — the exact failure this
guard exists to prevent, and one that already happened here. So the check asserts what a PUBLIC value
looks like: loopback and RFC 5737 documentation addresses, placeholder accounts, a verifier whose salt
and hash are too short to be either. Anything outside those shapes is reported.

Rejected: scanning for the operator's known values only. It is the leak, and it also misses the next
machine, which is the case that matters.

There is deliberately **no hostname shape rule**. A hostname's shape cannot separate the operator's
own domain from a public one — a documentation link's host and a real deployment host are the same
shape, and so is every dotted identifier in the codebase, from an i18n key to `vite.config.ts`. A rule
loose enough to catch the second reports thousands of the third and is switched off within a day.
Hostnames are therefore decision 2's job, where one entry covers every host under a domain.

### 1b. It scans what this fork owns

The scan set is the owned-path list already declared in `FORK.toml`, so it maintains itself as the
boundary moves. Upstream's files are upstream's business: its fixtures name its own author's home
directory and its own example addresses, all of them already public in its repository. An early run
that included them produced 130 findings, none of them ours — the shape of a guard nobody keeps.

### 2. The shapeless names come from the ignored file, or not at all

A machine named by an ordinary word has no shape to match, and by decision 1 neither does a hostname.
Those names live in the local context file
the repository already ignores, and the check reads them when it is there. They are therefore usable
by the guard and absent from the tree, which is the whole point. When the file is missing the check
still runs its shape rules and says which case it could not cover, so a green run on a fresh clone is
not mistaken for a proof.

### 3. The publisher is exempt, and that exemption is narrow

The plugin identifier legitimately carries the owner's name, and so do the license and the repository
URL. Those three are named as public metadata. Nothing else about the owner is.

### 4. Reporting never echoes what it read

A finding names the file, the line and the shape. It never prints a value that came from the local
context file, because a guard's own output is the next place a private value gets pasted from.

## Risks / Trade-offs

- **[A false positive on a legitimate value]** → the hatch is per-commit and named, exactly like the
  other three, and a genuinely public host that is not an example domain is rare enough to be worth
  the one-line justification.
- **[A green run read as a guarantee]** → the check states its blind spot in its own output rather
  than leaving the reader to infer completeness.

## Migration Plan

1. Add the check with its shape rules, its optional local-name source and its exemption, plus tests
   that plant a violation of each shape and a negative control for each exemption.
2. Add it to the pre-commit hook as a fourth independent guard with its own hatch, and list that
   hatch where the other three are listed.
3. Run it over the existing tree and fix or justify whatever it finds.
4. Roll back by removing the guard; it changes nothing the product does.
