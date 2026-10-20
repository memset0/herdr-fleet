# fleet-enter-steers Specification

## Purpose
TBD - created by archiving change codex-enter-steers. Update Purpose after archive.

## Requirements

### Requirement: Codex texts go in with Enter
Fleet SHALL load the Codex profile with Enter as its submit key on every platform, keeping its queue key. A text sent to an idle Codex box SHALL be committed with Enter.

#### Scenario: An idle Codex box
- **WHEN** a text is sent to a Codex pane whose box is free and no turn runs
- **THEN** the commit presses Enter and never the queue key

### Requirement: A text into a running turn steers it with Enter
On the Send Protocol's in-turn path, a text on a profile whose submit key is Enter and whose Enter steers SHALL be committed with Enter; every other check of that path SHALL apply unchanged. A command SHALL keep the queue key. The receipt SHALL say `queued` only when the harness's queued row shows the text.

#### Scenario: A running Codex turn
- **WHEN** a text is sent while a Codex turn runs
- **THEN** the commit presses Enter, the text joins the turn, and the receipt says sent

#### Scenario: A command in a running Codex turn
- **WHEN** a command is sent while a Codex turn runs
- **THEN** the commit presses the queue key and never Enter
