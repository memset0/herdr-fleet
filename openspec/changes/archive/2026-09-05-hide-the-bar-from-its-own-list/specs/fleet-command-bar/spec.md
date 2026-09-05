## MODIFIED Requirements

### Requirement: Command mode lists the catalog with its effective bindings
With a query of exactly `/`, command mode SHALL list the whole catalog except the command that opens
the surface being read. Each result SHALL show the command's English name and every one of its
effective bindings; a command with no binding SHALL be listed with an explicit "no binding"
indication rather than omitted.

A command whose whole effect is to open the surface it is being invoked FROM SHALL NOT be listed on
that surface, because choosing it cannot move anything. Omission here SHALL NOT affect the command
anywhere else: it stays bindable, invocable by its bindings, and listed in the settings reference.

Text after the `/` SHALL fuzzy-match against the command's English id, English name and binding
labels, and the matched characters SHALL be marked in the result. Activating a result SHALL close the
overlay and invoke that command through the shared dispatcher.

#### Scenario: The catalog is browsed
- **WHEN** the query is exactly `/`
- **THEN** every command in the catalog is listed with its English name and its effective bindings

#### Scenario: An unbound command is listed
- **WHEN** a listed command has an empty binding list
- **THEN** it appears with its English name and an explicit no-binding indication

#### Scenario: A command is filtered and run
- **WHEN** the operator types after the `/` and activates a result
- **THEN** the overlay closes and the shared dispatcher invokes exactly that command

#### Scenario: The bar is read from the bar
- **WHEN** command mode lists the catalog
- **THEN** the command that opens the command bar is absent, and every other command is present

#### Scenario: The omitted command is still the operator's
- **WHEN** the operator binds a chord to the command that opens the command bar
- **THEN** that chord opens it, and the settings reference lists it with its bindings

