## Why

The tree corresponds to Collie `v1.5.1`, adopted hours ago. `v1.5.2` is out, it is small, and one of
its twenty-one commits lands directly on a port this fork added between the two releases — adopting
it now is the cheapest this decision will ever be.

## What Changes

- Adopt Collie `v1.5.2` — tag object `38798351a64cae43c03f156c0b80f22f14d50565`, commit
  `cea2035e1f02d560d1bac66c85314828a7e01c20` — as a merge whose second parent is that commit.
- Record the provenance in `FORK.toml` and add the correspondence row to `UPSTREAM.md`.
- Review all nineteen invasive entries against the release: eight the release disturbs, eleven it
  does not.
- Cut this product's release for the adoption, at least a MINOR, and deploy it to every Fleet v3
  member — the lead first, then each peer — as `fleet-upstream-sync` and mem.conf's
  `herdr-device-deployments` now require.

What the release brings is upstream's: a Traditional Chinese dictionary and its locale registration,
bounded speech-to-text provider lifecycles, a changelog-guard test suite, clipped and muted terminal
rules, and the pane column change described below.

**The one that needs judgement.** `3870c1c` replaces upstream's fixed 768px pane column with a
ladder — 768 at `md`, then 1024, 1280 and 1400 — and gives the reason this fork gave when it declined
the 768px cap a day earlier: a terminal mirror has a column count of its own, and every pixel the cap
withholds is a line the browser has to wrap. `declined-centred-history-column` and the Pane's half of
that refusal therefore meet a release that has largely conceded their argument. This change keeps
them, adapted to the ladder rather than to the single number they were written against, because
dropping them would silently change a width the owner chose deliberately and because the fork's rails
take width the ladder does not know about. Whether to drop them and take upstream's ladder whole is a
question for the owner, and a change of its own.

Non-goals: no specification is written for behavior upstream owns. This change does not alter the
Fleet lifecycle posture, does not enrol or remove a member, and does not touch any member's
configuration.

## Capabilities

### New Capabilities

None. An adoption imports upstream behavior, and upstream behavior is not specified here.

### Modified Capabilities

None expected. If the entry-by-entry review shows a capability this repository specifies now behaves
differently, its delta is added to this change before implementation continues.

## Impact

- Everything Collie changed between `v1.5.1` and `v1.5.2`: 21 commits over 40 files.
- `FORK.toml` — `[upstream]`, and `reviewed` on all nineteen entries.
- `UPSTREAM.md`, `COLLIE_CHANGELOG.md`, `CHANGELOG.md`, and this product's three version files
  through the release this adoption cuts.
- The three live Fleet v3 members, through their own controllers.
