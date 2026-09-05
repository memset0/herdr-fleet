## ADDED Requirements

### Requirement: The lead's pack timing is part of its private configuration
The private configuration SHALL carry an optional section stating the lead's poll interval and its
per-peer probe budget, validated like every other field, and Fleet SHALL pass both to Collie as the
environment variables Collie already reads. Both SHALL be reset before they are set, so the
configuration decides them and an inherited environment cannot.

Omitting the section SHALL leave both untouched, so an existing deployment keeps upstream's defaults
without being edited. The section SHALL be meaningful on a lead only; a peer's configuration neither
requires nor is changed by it.

Fleet SHALL NOT reproduce, widen or bypass upstream's own ceiling on the budget. A budget above the
poll interval is what that ceiling exists to prevent, so a fleet that wants a longer budget states a
longer poll interval beside it.

#### Scenario: A fleet with distant members is configured
- **WHEN** the configuration states a poll interval and a per-peer budget
- **THEN** Collie is started with exactly those two values and the budget it grants follows its own arithmetic

#### Scenario: The section is omitted
- **WHEN** a configuration carries no such section
- **THEN** neither variable is set and the deployment keeps the defaults it had

#### Scenario: A budget above the ceiling is asked for
- **WHEN** the stated budget exceeds what the stated poll interval allows
- **THEN** the configuration is still valid, upstream's clamp decides what is granted, and the record shows both what was asked and what was granted

### Requirement: A member never heard from is not a refusal
The navigation rail SHALL treat a member the lead has never heard from as a distinct state from one
whose receipt has aged past a missed sweep. A receipt of zero means the lead has not yet heard from
that member at all, and subtracting it yields an age no threshold can survive — which turned a member
enrolled a moment ago, or one whose lead had just restarted, into a refusal on its first sweep.

Where the lead reports that a member answers but misses its budget, the rail SHALL say that rather
than presenting it as a refusal. The lead already distinguishes the two and states which it means.

#### Scenario: A member has just been enrolled
- **WHEN** the lead has not yet recorded a receipt from a member
- **THEN** the rail does not present it as refusing, and waits for a real receipt to age

#### Scenario: A member answers slowly
- **WHEN** the lead reports a member as answering while missing its probe budget
- **THEN** the rail says the link is slow rather than that the member refused

#### Scenario: A member stops answering
- **WHEN** the lead refuses a member and its last receipt is older than a missed sweep
- **THEN** the rail presents it as refusing, exactly as it does today
