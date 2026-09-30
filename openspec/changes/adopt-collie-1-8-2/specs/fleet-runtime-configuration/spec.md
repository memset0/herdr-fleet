## MODIFIED Requirements

### Requirement: The lead's pack timing is part of its private configuration
The private configuration SHALL carry an optional section stating the lead's poll interval and its
per-peer probe budget, validated like every other field, and Fleet SHALL pass both to Collie as the
environment variables the adopted Collie reads under their current names. Both SHALL be reset before
they are set, so the configuration decides them and an inherited environment cannot.

Where Collie still honours a previous spelling of one of those variables as a fallback, Fleet SHALL
reset the previous spelling as well as the current one, and SHALL set only the current one. A stray
inherited value under the old name would otherwise reach Collie through its own fallback and decide
the budget the configuration left unstated.

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

#### Scenario: The inherited environment carries the previous variable name
- **WHEN** Fleet starts Collie from an environment that holds the budget under Collie's previous variable name
- **THEN** that value is removed, and Collie sees only what the configuration states or nothing at all

#### Scenario: An existing configuration is carried across the adoption
- **WHEN** a configuration written for the previous release is loaded unchanged
- **THEN** it validates and projects the same two values, with no key renamed

#### Scenario: The section is omitted
- **WHEN** a configuration carries no such section
- **THEN** neither variable is set under either spelling and the deployment keeps the defaults it had

#### Scenario: A budget above the ceiling is asked for
- **WHEN** the stated budget exceeds what the stated poll interval allows
- **THEN** the configuration is still valid, upstream's clamp decides what is granted, and the record shows both what was asked and what was granted
