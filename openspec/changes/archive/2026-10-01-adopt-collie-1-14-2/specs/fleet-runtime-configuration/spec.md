## MODIFIED Requirements

### Requirement: The lead's pack timing is part of its private configuration
The private configuration SHALL carry an optional section stating the lead's poll interval and its
per-peer probe budget, validated like every other field, and Fleet SHALL pass both to Collie as the
environment variables the adopted Collie reads under their current names. Both SHALL be reset before
they are set, so the configuration decides them and an inherited environment cannot.

Fleet SHALL reset and set only the names the adopted Collie reads. A spelling Collie no longer reads
decides nothing, and Fleet SHALL NOT carry a reset for it.

The section's own name and keys belong to this product's configuration and SHALL NOT change because
Collie renamed its variables; an existing configuration SHALL keep working without being edited.

Omitting the section SHALL leave both untouched, so an existing deployment keeps upstream's defaults
without being edited. The section SHALL be meaningful on a lead only; a peer's configuration neither
requires nor is changed by it.

Fleet SHALL NOT reproduce, widen or bypass upstream's own ceiling on the budget. A budget above the
poll interval is what that ceiling exists to prevent, so a fleet that wants a longer budget states a
longer poll interval beside it.

#### Scenario: A fleet with distant members is configured
- **WHEN** the configuration states a poll interval and a per-peer budget
- **THEN** Collie is started with exactly those two values under the variable names it currently reads, and the budget it grants follows its own arithmetic

#### Scenario: The inherited environment carries a value for either variable
- **WHEN** Fleet starts Collie from an environment that already holds the poll interval or the budget
- **THEN** that value is removed, and Collie sees only what the configuration states or nothing at all

#### Scenario: The inherited environment carries the previous variable name
- **WHEN** Fleet starts Collie from an environment that holds the budget under a spelling the adopted Collie no longer reads
- **THEN** that value decides nothing, Fleet neither sets nor projects it, and the budget is what the configuration states or Collie's default

#### Scenario: An existing configuration is carried across the adoption
- **WHEN** a configuration written for the previous release is loaded unchanged
- **THEN** it validates and projects the same two values, with no key renamed

#### Scenario: The section is omitted
- **WHEN** a configuration carries no such section
- **THEN** neither variable is set and the deployment keeps the defaults it had

#### Scenario: A budget above the ceiling is asked for
- **WHEN** the stated budget exceeds what the stated poll interval allows
- **THEN** the configuration is still valid, upstream's clamp decides what is granted, and the record shows both what was asked and what was granted

## ADDED Requirements

### Requirement: Fleet states where its Collie child keeps its state
Fleet SHALL start its Collie child with that child's state directory stated explicitly under the
variable the adopted Collie reads for it, reset before it is set, and it SHALL be the same directory
Fleet validates the crew trust state in and the one an explicit enrolment writes. Neither an
inherited environment, a variable the adopted Collie no longer reads, nor Collie's own default
location SHALL decide it.

An adoption that changes how Collie resolves its state directory SHALL NOT move the directory: the
state an existing deployment holds stays where it is and is read in place.

#### Scenario: The plugin starts after the adoption
- **WHEN** Fleet starts Collie on a machine whose Collie state already exists under Fleet's state directory
- **THEN** Collie opens that same directory, finds the crew trust state Fleet validated, and starts in the mode Fleet expected

#### Scenario: The inherited environment names another state directory
- **WHEN** Fleet is started from an environment that carries a Collie state-directory value of its own
- **THEN** the Collie child receives Fleet's directory instead, and validation and Collie read the same trust store

### Requirement: Collie's own configuration files cannot decide a Fleet-owned setting
The adopted Collie reads a machine-wide and an instance configuration file beneath its environment.
For every Collie setting Fleet owns — the Collie child's state directory, its bind host and port and
the loopback guards around them, its ingress, origin, public-host and trusted-identity settings, its
serve publication, the base path it is served under, and the lead's crew timing — Fleet SHALL
reset the variable in the child's environment and, where Fleet decides the value, set it, so the
environment Fleet hands Collie is what decides it.

Where Fleet leaves such a setting unset on purpose, so Collie keeps its default, a configuration file
could otherwise supply it. Fleet SHALL therefore read both files Collie will read, through Collie's
own reader and from the paths Collie will resolve for that child, and SHALL refuse to start the
generation when either file sets a Fleet-owned setting. The refusal SHALL name the file and the
setting and MUST NOT print the value. A file that sets only settings Fleet does not own SHALL be left
to Collie, and Fleet SHALL NOT write, create or rewrite either file.

#### Scenario: No Collie configuration file exists
- **WHEN** neither Collie configuration file is present
- **THEN** Fleet starts Collie exactly as it did before the adoption

#### Scenario: A Collie configuration file sets a setting Fleet does not own
- **WHEN** a Collie configuration file sets, for example, a speech-to-text or reader setting
- **THEN** Fleet starts normally and Collie applies that setting under its own precedence

#### Scenario: A Collie configuration file sets a Fleet-owned setting
- **WHEN** either Collie configuration file sets the bind, the base path, a trusted identity, the state directory or another Fleet-owned setting
- **THEN** the generation does not start, and the diagnostic names the file and the setting without its value

#### Scenario: The base path is asked for through the environment
- **WHEN** Fleet is started from an environment that carries a Collie base path
- **THEN** the Collie child receives none, and Collie keeps serving at the root the Gateway proxies
