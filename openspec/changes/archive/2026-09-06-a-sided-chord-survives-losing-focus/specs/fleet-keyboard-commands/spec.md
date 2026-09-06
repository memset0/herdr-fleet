## MODIFIED Requirements

### Requirement: Bindings are direct chords or prefix sequences
A binding SHALL be either a **direct chord** — modifiers and one key pressed together — or a
**prefix binding**, a configured prefix chord pressed and released before a second chord. The default
prefix SHALL be `Ctrl+B`.

One command MAY carry several bindings of either shape. An exact duplicate binding across two
commands SHALL be rejected. An explicit empty binding list SHALL leave that command completely
unbound, and Fleet MUST NOT restore a built-in binding behind an explicit empty list.

The grammar SHALL accept `Tab`, `Shift+Tab`, `?` (`Shift`+`Slash`), the digits, and a second chord
that carries its own modifiers.

A MODIFIER MAY NAME A SIDE, written as an `L` or `R` before any spelling of that modifier the grammar
already accepts. An unsided modifier SHALL mean either side, so every binding written before sides
existed keeps its meaning exactly.

A MODIFIER MAY BE A CHORD'S KEY. A binding whose tokens are all modifiers SHALL take the last of them
as its key: `RAlt` is the right Alt key, `Alt` is either Alt key, and `Ctrl+RAlt` is the right Alt
pressed with Control held. The family a chord takes as its key SHALL NOT also be required as a
modifier of that chord, because it is held by definition.

A MODIFIER CANNOT BE BOTH A KEY AND A QUALIFIER. Where any binding, the prefix included, takes a
modifier as its key, no binding may hold that same modifier while pressing something else, and the
document SHALL be rejected as a whole when one does. A claim on one side refuses that side and every
unsided use of the family; a claim on both sides, or one unsided claim, refuses the family entirely.
The remaining side stays an ordinary modifier.

A SIDED CHORD SHALL SURVIVE THE PAGE LOSING FOCUS between the modifier and the key it qualifies. A
browser reports that a modifier is down and never which one, so recognising a side requires having
seen that side's own key event; Fleet MUST NOT discard what it has seen merely because focus moved,
because on some platforms pressing a modifier is itself what moves it.

What Fleet knows about which sides are held SHALL instead be reconciled against every key event's own
modifier state: a family an event reports as not held SHALL have both of its sides forgotten. Where a
side was never observed at all — the page was focused with the modifier already down — a sided chord
SHALL NOT fire, because guessing the side would run a binding the operator did not press.

A modifier bound as a key SHALL be marked risky rather than refused: on the layouts where the right
Alt is AltGr the browser reports Control alongside it, so the chord simply never matches, and some
browsers give a bare modifier to their own menu bar.

It SHALL reject a binding whose chord no browser lets a page see — including `Ctrl+N`, `Ctrl+T`,
`Ctrl+W`, their `Shift` variants, `Ctrl+Tab`, and `Ctrl` with a digit — because such a binding can
never fire. It SHALL separately ACCEPT, while marking as risky, a chord that only some browsers or
platforms keep for themselves, so an operator whose browser leaves it alone can use it and an
operator whose browser does not is told why it is silent. Rejection is for a chord that cannot work
anywhere; the risky mark is for one that depends on where it runs.

#### Scenario: A risky but usable chord is bound
- **WHEN** a binding names a chord that only some browsers reserve
- **THEN** the document is accepted, the binding takes effect, and the editor marks that binding as browser-dependent rather than refusing it

#### Scenario: A prefix binding is declared
- **WHEN** a command declares a prefix binding and the operator presses and releases the prefix, then the second chord
- **THEN** Fleet invokes that command exactly once

#### Scenario: Two commands claim one binding
- **WHEN** a configuration gives the same exact binding to two commands
- **THEN** the document is rejected as a whole and the previously effective bindings stay in force

#### Scenario: A command is explicitly unbound
- **WHEN** a command's binding list is explicitly empty
- **THEN** no key invokes it, it stays listed and searchable, and no default binding reappears for it

#### Scenario: A binding names a chord the browser keeps
- **WHEN** a binding names `Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, or `Ctrl` with a digit
- **THEN** the document is rejected with a message naming that binding, rather than accepted into a key that never fires

#### Scenario: A modifier is bound as a key
- **WHEN** a command's binding is `RAlt` and the operator presses the right Alt key
- **THEN** that command runs once, and pressing the left Alt key runs nothing

#### Scenario: An unsided modifier still means either side
- **WHEN** a binding names `Alt+Q` and the operator presses `Q` with either Alt held
- **THEN** the command runs, exactly as it did before sides could be written

#### Scenario: A claimed modifier cannot also be held
- **WHEN** a document binds `RAlt` to one command and `Alt+Q` or `RAlt+Q` to another
- **THEN** the document is rejected as a whole, naming both bindings, and the previously effective bindings stay in force

#### Scenario: The other side is still an ordinary modifier
- **WHEN** a document binds `RAlt` to one command and `LAlt+Q` to another
- **THEN** the document is accepted and both work

#### Scenario: The prefix is a chord like any other
- **WHEN** a document claims a modifier that the configured prefix chord holds
- **THEN** the document is rejected rather than leaving every sequential binding silent

#### Scenario: The modifier press itself moves focus
- **WHEN** the operator presses a sided modifier, the window loses focus as a result, and the operator then presses the key it qualifies
- **THEN** the command runs, exactly as if focus had never moved

#### Scenario: The modifier is released between chords
- **WHEN** a later key event reports that modifier family as not held
- **THEN** both of that family's sides are forgotten, and a sided chord naming either does not fire until one is pressed again

#### Scenario: The page is focused with the modifier already down
- **WHEN** the first event Fleet sees carries a modifier whose own key press happened elsewhere
- **THEN** a sided chord naming that family does not fire, and one fresh press of the modifier restores it

