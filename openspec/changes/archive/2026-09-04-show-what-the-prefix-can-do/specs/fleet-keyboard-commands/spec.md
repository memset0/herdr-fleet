## ADDED Requirements

### Requirement: A pending prefix shows what it leads to
While a prefix is pending, Fleet SHALL present a panel listing every second chord that currently
completes a binding, each beside the English name of the command it runs.

The list SHALL be derived from the **effective** bindings, so an operator who rebound a command sees
their own second chord and one who unbound it sees nothing for it. A command reached by more than one
prefix chord SHALL appear once per chord. Direct chords SHALL NOT be listed: they are not what the
pending state is waiting for.

Entries SHALL be grouped by what the command acts on, and each group SHALL carry its own heading. A
command whose target does not currently exist SHALL still be listed, visibly distinguished from one
that would act, so the panel describes the keyboard rather than only the moment.

The panel SHALL appear only after a bounded pause, so completing a sequence promptly never shows it,
and SHALL disappear the instant the sequence completes, expires or is cancelled — leaving no trace
when the operator was never waiting.

It SHALL take no focus and MUST NOT receive the second chord itself. It SHALL float above the page
and hold no space: pressing the prefix MUST NOT reflow, resize or scroll what is underneath. It MUST
NOT be scrollable or offer any pointer target; a list too long for the space available SHALL be
elided with a count of what it could not show.

When reduced motion is requested, the panel SHALL appear and leave without animation.

#### Scenario: The operator hesitates after the prefix
- **WHEN** a prefix is pending and the pause elapses without a second chord
- **THEN** the panel lists every second chord that completes a binding, with each command's English name

#### Scenario: The operator does not hesitate
- **WHEN** the operator presses the prefix and completes a registered binding before the pause elapses
- **THEN** the command runs and the panel is never shown

#### Scenario: The sequence ends
- **WHEN** a shown panel's sequence completes, expires, is cancelled by `Escape`, or is dropped by the window losing focus
- **THEN** the panel disappears immediately

#### Scenario: The operator has their own bindings
- **WHEN** a settings document rebinds one command and unbinds another
- **THEN** the panel shows the rebound command under its new second chord and does not list the unbound one

#### Scenario: A listed command has nowhere to act
- **WHEN** the panel lists a command whose scope has no current target
- **THEN** that entry is visibly distinguished from the ones that would act, and it is still listed

#### Scenario: The panel is on screen
- **WHEN** the panel is shown
- **THEN** the page beneath it has not moved, nothing in it can be focused or clicked, and the next key still reaches the recognizer

#### Scenario: More entries than fit
- **WHEN** the effective bindings hold more prefix entries than the panel can show
- **THEN** it shows as many as fit and says how many it did not, rather than scrolling
