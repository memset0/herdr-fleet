## MODIFIED Requirements

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
