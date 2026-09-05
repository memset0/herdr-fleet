## MODIFIED Requirements

### Requirement: The catalog ships these commands and public defaults
The catalog SHALL contain exactly the following stable ids, English names and public default
bindings, where `Prefix` resolves to the configured prefix. A command shown with `[]` SHALL ship
unbound while remaining listed, searchable and bindable.

A command's English name SHALL name the OUTCOME an operator is after rather than the mechanism that
produces it. The name is the string command search matches on, so a name that describes the mechanism
makes the command unfindable by the word the operator would use for it.

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
| `fit-pane-width` | Resize Pane | `Prefix+R` |
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

#### Scenario: A command is searched for by its outcome
- **WHEN** the operator searches command mode for `resize`
- **THEN** `fit-pane-width` is listed, under the English name `Resize Pane`
