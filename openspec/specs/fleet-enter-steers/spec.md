# fleet-enter-steers Specification

## Purpose
Let a text sent to a Codex pane go in with Enter, so it steers a running turn instead of queueing behind it, while commands and upstream's other profiles keep their own submit keys.

## Requirements

### Requirement: Codex texts go in with Enter
Fleet SHALL load the Codex profile with Enter as its submit key on every platform, keeping its queue key. A text sent to an idle Codex box SHALL be committed with Enter.

#### Scenario: An idle Codex box
- **WHEN** a text is sent to a Codex pane whose box is free and no turn runs
- **THEN** the commit presses Enter and never the queue key

### Requirement: A text into a running turn steers it with Enter
On the Send Protocol's in-turn path, a text on a profile whose submit key is Enter and whose Enter steers SHALL be committed with Enter; every other check of that path SHALL apply unchanged. A command SHALL keep the queue key. The receipt SHALL say `queued` only when the harness's queued row shows the text.

The in-turn path includes a turn that the adopted Collie first reads on the read Enter is minted on, after an idle S0: such a text, once upstream's turn rule lets it go ahead, SHALL be committed with Enter as well, where upstream would press the queue key; a command keeps upstream's rule (the queue key, or `typed_not_submitted` with its text in the box).

#### Scenario: A running Codex turn
- **WHEN** a text is sent while a Codex turn runs
- **THEN** the commit presses Enter, the text joins the turn, and the receipt says sent

#### Scenario: A command in a running Codex turn
- **WHEN** a command is sent while a Codex turn runs
- **THEN** the commit presses the queue key and never Enter

#### Scenario: A Codex turn starts while the text is typed
- **WHEN** S0 read the Codex box idle and the read after typing shows a turn running
- **THEN** a text the turn rule lets go ahead is committed with Enter, never the queue key, and a command meets upstream's rule unchanged
