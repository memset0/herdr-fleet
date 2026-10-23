## Context

Collie v1.23.3's Send Protocol (`bridge/surface/protocol.ts`) decides every refusal by comparing screen reads (`Snap`s: S0, the probe reads, S1, S2). Its receipts (`<stateDir>/sends/<id>.json`) deliberately hold hashes and words, never rows, and its lab examples (`<stateDir>/surface/examples/`) are masked bottom clusters kept only for a probed `sent` or a refusal over an unreadable modal. The rows themselves live only in an in-memory ring. The operator wants the real screens of each failure kept locally.

## Decisions

- **A fork-owned module carries the policy and the writer.** `fleet/send-failure-screens.ts` decides which receipts are worth keeping (`wantsFailureScreens`), and its `SendFailureScreens` class writes, prunes and logs. The protocol knows only an optional dependency `failureScreens?: { wants(receipt); keep(capture) }` and the plain data it hands over: the receipt, the time, and a list of `{ label, step, revision, raw }`.
- **What counts as a failure.** The reasons a screen decided (`draft_present`, `not_free`, `probe_failed`, `unconfirmed`, `mismatch`, `changed`, `modal_cue`, `no_evidence`, `dialog_after_enter`), plus any refused / `typed_not_submitted` / `unknown` whose `saw.modal` is `unreadable` or `unknown`. A blind send (`saw.reason` `no-profile`) and every non-failure outcome keep nothing. `turn_running`, `busy`, `bound` and `stale_*` are timing or concurrency, not screen misreads, and are left out to keep the folder useful.
- **Which screens.** S0, S1, S2 and the last two reads (`previousRead`, `lastRead`), deduplicated by identity, so the probe read that failed is the `last` one. Each read now keeps the multiplexer's raw text (`raw`, ANSI included, which is what `parseAnsi` decided on) and the step name it was read under; both are added to the private `Snap` in `readNow`. Nothing else in the protocol reads them.
- **Port placement.** `settle()` calls a private `keepFailure` right after `count`, inside a try, so the receipt is already on disk and the answer is built from values the call cannot touch. The sink's `keep` only enqueues; the write runs on a promise chain after an I/O await, so `settle` returns without waiting. This rides the existing `patient-send-protocol-port` entry, which already declares the file. `bridge/index.ts` gains one import and one dependency line (`failureScreens: new SendFailureScreens(join(cfg.stateDir, "send-failures"))`) under a new invasive entry; reading the state directory from the environment inside the protocol was rejected because it would make every upstream test rig that sets `COLLIE_STATE_DIR` write files.
- **File names never come from a client.** The request id is minted by the phone, so it is stored inside the record (and only when it matches `REQUEST_ID`), while the file is named `<UTC timestamp>-<8 random hex>.json` by the bridge. This departs from the suggested `<requestId>.json` on purpose: AGENTS.md keeps the journal as the only place a client value becomes a path.
- **Filesystem posture.** The folder is `lstat`ed before every write: a symbolic link or a non-folder refuses the write; absent, it is created 0700; present, its mode is tightened to 0700. Each record is opened `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW` at 0600 as a `.tmp` sibling, written, then renamed into place. Writes are serialised on one chain per sink, and at most 8 may queue; beyond that a capture is dropped.
- **Retention.** After each write: keep the newest 50 records (names sort by time) and at most 8 MiB in total, deleting the oldest regular files first; stray `.tmp` files are removed. Each kept screen is cut to 256 KiB (`truncated: true` when cut), and at most six screens are kept per record.
- **Errors.** Every failure in `wants`, `keep` or the write is caught; the first is logged with `console.warn` and the rest are silent for the bridge's life.
- **Privacy.** Records hold real screen rows and may hold the person's text; that is the owner's explicit request. They sit in the owner-only state directory, are never served, and are never committed. Tests use synthetic screens only.

## Risks

- Records can hold secrets typed into a pane; the bounds keep exposure local and finite, and the operator deletes the folder at will.
- The extra `raw` string per read roughly doubles a `Snap`'s memory while a request runs; reads are released when the request settles.

## Archive

The change is finished when the lead's suites pass and the lead has run it; its archive waits for the lead-deploy observation task.
