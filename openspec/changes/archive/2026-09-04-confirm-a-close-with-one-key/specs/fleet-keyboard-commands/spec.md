## ADDED Requirements

### Requirement: A close asks on the keyboard, and the safe answer is the default
Every close command SHALL confirm on the same panel the command bar and the rename input use, rather
than opening the surface the pointer uses. The confirmation SHALL name what is about to be closed and
what closing it costs.

It SHALL offer an input already holding `y`, with the prompt spelling the choice as `y/N` so the
capital letter says which answer is the safe one. Submitting `y`, in either case, SHALL close.
**Every other submission SHALL NOT** — `n`, a typo, an empty field, anything at all — and neither
shall `Escape`, dismissal, or the target changing underneath.

The confirmation SHALL send at most one close, and only on a submission that said `y`. Closing the
Pane that is currently displayed SHALL select the same Host's safe Home route; every other close
SHALL reconcile without a route change. A device that may not write SHALL be refused before the
confirmation opens.

Adding a close command later SHALL use this confirmation. A close that fires on the chord alone is
not permitted, whatever it closes.

#### Scenario: The operator confirms
- **WHEN** a close command opens its confirmation and the operator presses Enter on the `y` it is holding
- **THEN** exactly one close is sent for that target

#### Scenario: The operator declines
- **WHEN** the operator replaces the `y` with `n`, with anything else, or with nothing, and submits
- **THEN** no close is sent and the confirmation closes

#### Scenario: The operator leaves
- **WHEN** the confirmation receives `Escape`, is dismissed, or its target changes
- **THEN** no close is sent

#### Scenario: The displayed Pane is the one closed
- **WHEN** the confirmed close is for the Pane currently on screen
- **THEN** the same Host's safe Home route is selected

#### Scenario: Every close command is covered
- **WHEN** the catalog is read for commands that close something
- **THEN** each one confirms this way, and none fires on its chord alone
