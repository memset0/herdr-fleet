# fleet-keyboard-commands Specification

## Purpose
Give the authenticated Fleet application one bounded, configurable command system — a stable catalog,
a two-shape binding grammar, one recognizer, and one dispatch path — so every keyboard, palette and
settings invocation reaches the same allowlisted action and no surface installs a key listener of its
own.

## Requirements

### Requirement: Fleet owns one bounded command catalog
Fleet SHALL own a data-defined command catalog. Every command SHALL have exactly one stable English
id, one English display name, one allowlisted action adapter, and zero or more effective bindings.
The catalog SHALL be closed: a command that is not in it cannot be bound, listed, or invoked.

An action adapter SHALL receive only the command id and the invocation context Fleet already holds.
The catalog MUST NOT permit a command to carry an arbitrary URL, HTTP method, API path, terminal
text, key sequence, script, credential, or unvalidated object id. Adding a new action kind SHALL
require an explicit adapter and its own focused tests.

Ordinal families SHALL expand into independent command ids rather than one parameterised command.

#### Scenario: Every catalog id is unique and adapted
- **WHEN** the catalog is loaded
- **THEN** every id appears exactly once, carries an English name, and resolves to exactly one allowlisted adapter

#### Scenario: A message names an unknown command
- **WHEN** an invocation names an id the catalog does not contain
- **THEN** Fleet performs no navigation, mutation or terminal write, and shows no acknowledgement

#### Scenario: An invocation tries to carry a payload
- **WHEN** an invocation adds a URL, a key array, terminal text, a request path, or another unregistered field
- **THEN** Fleet rejects the whole invocation rather than executing the command without that field

### Requirement: Bindings are direct chords or prefix sequences
A binding SHALL be either a **direct chord** — modifiers and one key pressed together — or a
**prefix binding**, a configured prefix chord pressed and released before a second chord. The default
prefix SHALL be `Ctrl+B`.

One command MAY carry several bindings of either shape. An exact duplicate binding across two
commands SHALL be rejected. An explicit empty binding list SHALL leave that command completely
unbound, and Fleet MUST NOT restore a built-in binding behind an explicit empty list.

The grammar SHALL accept `Tab`, `Shift+Tab`, `?` (`Shift`+`Slash`), the digits, and a second chord
that carries its own modifiers.

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

### Requirement: The recognizer matches exactly and cancels safely
The recognizer SHALL match physical key codes and the exact modifier set. It SHALL ignore key
auto-repeat, ignore a keydown that is only a modifier, and reject a chord that carries a modifier the
binding does not name.

It SHALL prevent the browser default only for an accepted prefix or a complete registered binding,
and SHALL do so synchronously in the key event, never after an asynchronous step.

A pending prefix SHALL be cancelled — performing no command and showing no acknowledgement — by a
bounded timeout, `Escape`, loss of the focus context, document hiding, or a second chord that is not
registered.

#### Scenario: Prefix then a registered second chord
- **WHEN** the operator presses and releases the prefix and then presses a registered second chord
- **THEN** Fleet invokes that command once and prevents only the keys it handled

#### Scenario: Prefix distinguishes Tab from Shift+Tab
- **WHEN** a pending prefix receives `Tab` or `Shift+Tab`
- **THEN** the recognizer resolves the two as different bindings and prevents the browser's focus traversal

#### Scenario: A chord carries an extra modifier
- **WHEN** the operator presses a registered chord while also holding a modifier it does not name
- **THEN** nothing is invoked, nothing is prevented, and no acknowledgement is shown

#### Scenario: A pending prefix goes stale
- **WHEN** a pending prefix is followed by the timeout, `Escape`, focus-context loss, document hiding, or an unregistered chord
- **THEN** the pending state clears, no command runs, and the next key is read as an ordinary first key

#### Scenario: A key repeats while held
- **WHEN** a registered chord auto-repeats because the operator holds it
- **THEN** the command is invoked once for the initial press and not again for the repeats

### Requirement: An armed prefix preempts text input, and direct chords always apply
While a prefix is armed, the recognizer SHALL receive the next key before any text-entry surface,
including the composer's draft field and its direct-typing mode. `Escape`, `Tab` and the arrow keys
SHALL resolve as second chords rather than as text input or as keys sent to a Pane. The moment the
sequence completes or cancels, that preemption SHALL end and the same keys SHALL again reach the
surface that owns them.

A direct chord SHALL be recognised in every focus context, including while the composer holds focus
and while direct-typing mode is armed.

No other Fleet surface SHALL install its own application-level key listener; a surface that needs a
key SHALL add a command to the catalog.

#### Scenario: Prefix arms while the composer has focus
- **WHEN** the operator presses the prefix with the caret in the composer and then presses a registered second chord
- **THEN** Fleet invokes that command and the composer's draft is unchanged

#### Scenario: Arrow key arrives during an armed prefix in direct-typing mode
- **WHEN** direct-typing mode is armed, the operator presses the prefix, and then presses an arrow key that is a registered second chord
- **THEN** Fleet invokes that command and sends no key to the Pane

#### Scenario: The same arrow key arrives with no prefix armed
- **WHEN** direct-typing mode is armed and the operator presses that arrow key without arming the prefix
- **THEN** the key reaches the Pane exactly as it does today and Fleet invokes nothing

#### Scenario: A direct chord arrives while typing
- **WHEN** the composer holds focus, or direct-typing mode is armed, and the operator presses a registered direct chord
- **THEN** Fleet invokes that command and prevents the chord's default

### Requirement: One dispatch path and one acknowledgement
Every accepted invocation SHALL run through one dispatcher, whether it came from a key, the command
bar, a settings control, or another Fleet affordance. The dispatcher SHALL resolve availability
first: a command whose target does not exist SHALL make no route change or mutation and SHALL report
one bounded, non-sensitive unavailable result.

Acknowledgement SHALL use the application's existing floating status channel rather than a surface of
its own, because a command invoked from the keyboard has no control at which its outcome could be
shown. A key-originated invocation SHALL publish `<the binding actually pressed> · <English command
name>`. An invocation from any other source SHALL publish only the English command name, with no
invented key label. A failure or unavailable result SHALL publish through that same channel.

Rejected, repeated, extra-modifier, cancelled-prefix and unregistered input SHALL publish nothing. A
command whose outcome IS visible where the operator is already looking — a route change they asked
for — SHALL NOT publish a second confirmation of it.

#### Scenario: A command is invoked by key
- **WHEN** the operator completes a registered binding whose outcome is not visible where they are looking
- **THEN** the existing floating status names the binding actually pressed and the command's English name

#### Scenario: The same command is invoked from the command bar
- **WHEN** the operator activates that command from the command bar
- **THEN** the same adapter runs and the published text contains only the English name

#### Scenario: The outcome is the thing the operator watched
- **WHEN** a command's whole effect is the route change the operator asked for
- **THEN** Fleet publishes no second confirmation of it

#### Scenario: A command has no target
- **WHEN** a command is invoked with no current Pane, Tab or Space to act on
- **THEN** Fleet changes no route, sends no request, and reports one bounded unavailable result

### Requirement: The catalog ships these commands and public defaults
The catalog SHALL contain exactly the following stable ids, English names and public default
bindings, where `Prefix` resolves to the configured prefix. A command shown with `[]` SHALL ship
unbound while remaining listed, searchable and bindable.

| Command id | English name | Public default |
| --- | --- | --- |
| `open-command-bar` | Open Command Bar | `Ctrl+Shift+P`, `Prefix+?` |
| `open-pane-switcher` | Open Pane Switcher | `[]` |
| `open-fleet-settings` | Open Fleet Settings | `Prefix+S` |
| `toggle-fleet-sidebars` | Toggle Fleet Sidebars | `Prefix+B` |
| `create-tab` | Create Tab | `Prefix+C`, `Prefix+V`, `Prefix+-` |
| `next-tab` / `previous-tab` | Next Tab / Previous Tab | `Prefix+N` / `Prefix+P` |
| `select-tab-1` … `select-tab-9` | Select Tab 1 … Select Tab 9 | `Prefix+1` … `Prefix+9` |
| `rename-tab` | Rename Tab | `Prefix+Shift+T` |
| `close-tab` | Close Tab | `Prefix+Shift+X` |
| `next-pane-in-tab` / `previous-pane-in-tab` | Next Pane in Tab / Previous Pane in Tab | `Prefix+Tab` / `Prefix+Shift+Tab` |
| `close-pane` | Close Pane | `Prefix+X` |
| `rename-pane` | Rename Pane | `Prefix+Shift+P` |
| `fit-pane-width` | Fit Current Pane Width | `Prefix+R` |
| `previous-pane` / `next-pane` | Previous Pane in Fleet / Next Pane in Fleet | `[]` |
| `last-pane` | Last Pane | `[]` |
| `previous-agent` / `next-agent` | Previous Agent / Next Agent | `[]` |
| `select-agent-1` … `select-agent-9` | Select Agent 1 … Select Agent 9 | `[]` |
| `copy-fleet-pane-link` | Copy Fleet Pane Link | `[]` |
| `toggle-type-mode` | Toggle Type Mode | `[]` |
| `send-escape` / `send-enter` | Send Escape / Send Enter | `[]` |
| `send-up-arrow` / `send-down-arrow` | Send Up Arrow / Send Down Arrow | `[]` |
| `send-left-arrow` / `send-right-arrow` | Send Left Arrow / Send Right Arrow | `[]` |
| `send-space` | Send Space | `[]` |
| `send-ctrl-c` | Send Ctrl+C | `[]` |

`Ctrl+Shift+P` SHALL be the only direct-chord default. Pane mode SHALL be reached by removing the
leading `/` from the query that chord opens, so a second entry chord is a configuration choice rather
than a shipped one. No public default SHALL bind a chord in the `Alt` family; those commands SHALL
reach the operator through the command bar or through their own configuration.

#### Scenario: A stock install loads its defaults
- **WHEN** no configuration document is present
- **THEN** every row above carries exactly its declared default and no other command is bound

#### Scenario: Three aliases create one Tab
- **WHEN** the operator completes `Prefix+C`, `Prefix+V`, or `Prefix+-`
- **THEN** each invokes the single `create-tab` command through one mutation path

#### Scenario: A default-unbound command is reached
- **WHEN** the operator searches the command bar for a command whose default is `[]`
- **THEN** it appears with its English name and an explicit "no binding" label, and activating it runs the command

### Requirement: Navigation commands resolve against the current topology
Space, Tab, Pane and Agent commands SHALL resolve their target from the validated topology at the
moment of invocation and SHALL navigate through Fleet's existing canonical route.

`next-tab`, `previous-tab` and the nine Tab ordinals SHALL act only on Tabs in the current Space, and
the two cycling commands SHALL wrap. `next-pane-in-tab` and `previous-pane-in-tab` SHALL act only on
Panes in the current Tab and SHALL wrap. `previous-pane` and `next-pane` SHALL walk the complete
hierarchy order across every Host, Space, Tab and Pane. Agent cycling and the nine Agent ordinals
SHALL resolve against the shared roster order.

`last-pane` SHALL keep a two-entry, page-session history of exact Panes. It SHALL switch to the other
entry and swap the pair, so repeated invocation toggles between the two most recent Panes, and SHALL
drop an entry once the topology proves that Pane is gone.

`create-tab` SHALL derive the current Space and session, delegate the existing native create action,
and open the returned Pane through the canonical route.

`copy-fleet-pane-link` SHALL copy a link built from the validated current route only. It SHALL copy
no credential and SHALL leave the clipboard untouched when the current route is incomplete.

#### Scenario: Tabs wrap inside their Space
- **WHEN** the current Space holds several Tabs and the operator invokes `next-tab` on the last one
- **THEN** Fleet selects the first Tab of that same Space and does not cross into another Space

#### Scenario: Panes wrap inside their Tab
- **WHEN** the current Tab holds several Panes and the operator invokes `previous-pane-in-tab` on the first
- **THEN** Fleet selects the last Pane of that Tab and does not cross into a sibling Tab

#### Scenario: The whole hierarchy is walked
- **WHEN** the operator invokes `next-pane` repeatedly on a pack
- **THEN** Fleet visits every Pane in the hierarchy's order across all Hosts and wraps at the end

#### Scenario: An ordinal does not exist
- **WHEN** the operator invokes `select-tab-7` in a Space with three Tabs
- **THEN** Fleet changes no route and reports one bounded unavailable result

#### Scenario: The operator toggles back and forth
- **WHEN** two still-present Panes have been visited and `last-pane` is invoked twice
- **THEN** the first invocation returns to the previous Pane and the second returns to the one it came from

#### Scenario: A remembered Pane is gone
- **WHEN** `last-pane` is invoked and the remembered Pane is absent from the current topology
- **THEN** Fleet drops that entry, changes no route, and reports one bounded unavailable result

#### Scenario: The current route cannot make a link
- **WHEN** `copy-fleet-pane-link` runs with no complete current Pane route
- **THEN** the clipboard is unchanged and Fleet reports one bounded unavailable result

### Requirement: Renaming and closing open the actions Collie already has
The **close** commands SHALL open Collie's own actions surface for the current Tab or Pane rather
than introducing a second confirmation. That surface already owns the two-activation confirmation,
the read-only refusal and the one mutation each close performs; a Fleet-owned copy of any of those
would be a second place for the same rules to drift.

The **rename** commands SHALL instead open a Fleet-owned input at the command bar's own position,
drawn on the same panel shell, because a rename begun from the keyboard must put its field where the
operator is already looking. It SHALL be prefilled with the target's current readable label with that
text selected, SHALL submit on `Enter`, and SHALL cancel on `Escape`, on dismissal, and on a change
of target or route. It MUST send exactly one rename, and only on submission. No rename path SHALL use
a browser prompt or an inline tree editor.

Renaming SHALL keep the meaning each target already has: a Tab requires a non-blank label, and a
blank submission SHALL stay in the input as a validation error without sending anything; a Pane's
blank submission SHALL clear its label, which is Collie's existing behavior. A device that may not
write SHALL be refused before the input opens.

Closing the currently displayed Pane SHALL select the same Host's safe Home route, and every other
close SHALL reconcile without a route change — exactly as activating the same action from a hierarchy
row already does.

A Space SHALL NOT have rename or close commands. This is a gap below this fork rather than a decision
it makes: the multiplexer's own RPC surface does expose renaming a workspace, but every layer between
that and the browser is absent — the capability is not declared, the multiplexer port carries no such
verb, no route serves it, and no client function calls it — and supplying them would require an
answer from every multiplexer adapter, not only the default one. A command that can never land is
worse than an absent command: it is a row in the catalog that fails every time it is chosen.

#### Scenario: A Tab is renamed from the keyboard
- **WHEN** `rename-tab` is invoked with a current Tab
- **THEN** an input opens where the command bar opens, holding that Tab's current name selected, and `Enter` sends exactly one rename

#### Scenario: A Pane is renamed from the keyboard
- **WHEN** `rename-pane` is invoked with a current Pane
- **THEN** the same input opens holding that Pane's readable label selected, and `Enter` sends exactly one rename for that Pane

#### Scenario: A Pane's label is cleared
- **WHEN** `rename-pane` is invoked and the operator submits an empty value
- **THEN** Fleet sends the clear Collie's own Pane rename already means by an empty label

#### Scenario: A Tab is given a blank name
- **WHEN** the operator submits an empty value while renaming a Tab
- **THEN** the input stays open with a validation error and nothing is sent

#### Scenario: The rename is abandoned
- **WHEN** the operator presses `Escape`, dismisses the input, or the route changes under it
- **THEN** the input closes and no rename is sent

#### Scenario: A Tab is closed from the keyboard
- **WHEN** `close-tab` is invoked and the operator confirms in Collie's own surface
- **THEN** exactly one close is sent through the path a hierarchy row already uses

#### Scenario: The device may not write
- **WHEN** a rename or close command is invoked on a read-only device
- **THEN** no input opens, no surface offers the action, and no mutation is sent

#### Scenario: A Space command is looked for
- **WHEN** the operator searches the command bar for a way to rename or close a Space
- **THEN** there is none, because the chain between the multiplexer's own rename and the browser does not exist

### Requirement: Pane commands reuse Collie's own actions
`fit-pane-width` SHALL invoke the same measurement and resize path as Collie's existing manual Pane
fit control, and SHALL not compute columns or call a node resize API of its own.

`toggle-type-mode` SHALL drive the same activate and deactivate transition as the composer's visible
direct-typing control, so there is one armed state and one cleanup path.

The eight fixed key commands SHALL send exactly these constant sequences through Collie's existing
authorised Pane key path: `send-escape` → `["Escape"]`, `send-enter` → `["Enter"]`, `send-up-arrow` →
`["Up"]`, `send-down-arrow` → `["Down"]`, `send-left-arrow` → `["Left"]`, `send-right-arrow` →
`["Right"]`, `send-space` → `["Space"]`, `send-ctrl-c` → `["ctrl+c"]`. They MUST NOT infer a prompt,
append a submit key, accept a caller-supplied sequence, retry a failed write, or enter direct-typing
mode. Existing write authorisation, read-only refusal and audit attribution SHALL continue to apply.

#### Scenario: The fit command runs
- **WHEN** `fit-pane-width` is invoked on an active Pane
- **THEN** Collie's existing manual fit runs once with the same result it produces from its own control

#### Scenario: Type mode is toggled by command
- **WHEN** `toggle-type-mode` is invoked twice
- **THEN** the composer's visible control reflects the same armed and disarmed states, with the same focus and cleanup behavior

#### Scenario: A fixed key is sent
- **WHEN** any of the eight key commands is invoked on a writable Pane
- **THEN** exactly its declared sequence is sent once, and nothing else is written

#### Scenario: The Pane is read-only
- **WHEN** a key command is invoked on a Pane the device may not write
- **THEN** nothing is sent and Fleet reports one bounded unavailable result

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

### Requirement: Creating a Tab uses the native create-and-jump flow
`create-tab` SHALL delegate to the same create-and-jump flow Collie's own surfaces use rather than
calling the create API directly. That flow carries the write gate, the API error message, the
snapshot reconciliation, and the handoff of the freshly created Pane to the route it navigates to.

The last of those is what makes the command work rather than merely fire: a Pane created a moment ago
is not in the snapshot yet, so a route reached without it reports an Agent that is gone.

#### Scenario: A Tab is created from the keyboard
- **WHEN** `create-tab` is invoked on a reachable Space
- **THEN** the new Tab's Pane is created once and the operator lands in it, with no interval in which the page claims the Agent is gone

#### Scenario: The device may not write
- **WHEN** `create-tab` is invoked on a read-only device
- **THEN** nothing is created and the refusal is the one Collie's own create already gives

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

### Requirement: Every question the keyboard asks is the same surface
When a command needs one line of input — a name, an answer — it SHALL ask through one shared prompt
panel rather than through a surface of its own. That panel SHALL own: the position and ground the
command bar uses, a heading naming what is being asked with an optional line under it saying what it
costs, an input that takes focus with its initial value selected, submission on `Enter`, cancellation
on `Escape` and on dismissal, and one reserved line beneath that carries a hint or a refusal without
changing the panel's size.

A caller SHALL own only what is genuinely its own: what a submission means, and what an empty value
means for its target.

A confirmation SHALL name its default answer in the HEADING, beside the question it qualifies, rather
than beside the field — a marker in front of an input reads as part of what is being typed.

#### Scenario: Two surfaces ask the same way
- **WHEN** the rename input and the close confirmation are opened
- **THEN** both present the same panel, heading, focused-and-selected field, footer line, and the same response to `Enter` and `Escape`

#### Scenario: A confirmation says what Enter will do
- **WHEN** a confirmation opens
- **THEN** its heading carries the question and the `y/N` that names the default, and nothing sits between the field and its own text

#### Scenario: A refusal appears
- **WHEN** a caller reports a validation error or a refused mutation
- **THEN** the reserved line shows it and the panel does not change size
