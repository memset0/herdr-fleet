# Upstream and fork boundary

Herdr Fleet v3 began as a downstream reapplication of
[Collie](https://github.com/AltanS/collie) v1.2.0:

- tag object: `0f98f28c9aaadd641c4bc5ac484190ee3ef7008c`
- commit: `4618c90534d6f818ed6788b8db00e1582c5abfdc`

Collie remains MIT-licensed and attributed through its existing license, history, documentation,
and source. Unchanged Collie behavior is upstream behavior, not a Herdr Fleet capability. Collie's own
changelog is retained in [`COLLIE_CHANGELOG.md`](./COLLIE_CHANGELOG.md); Herdr Fleet's own is
[`CHANGELOG.md`](./CHANGELOG.md).

That retention is **accumulative, not byte-identical**. Upstream rewrites and truncates its own
changelog, so the adopted release's text is kept verbatim at the top of the file — a byte-exact
prefix, which `scripts/check-fork.ts` verifies — and entries upstream has since dropped are kept
word-for-word below one seam marker that says where the truncation happened.

## Version correspondence

| Herdr Fleet | corresponds to Collie |
| --- | --- |
| `3.0.0` | `1.2.0` |

**This is provenance, not a version component.** Herdr Fleet's version line is its own and begins at
`3.0.0`; Collie's is Collie's. Adopting a newer Collie release adds a row here and does not move this
product's number, and a Herdr Fleet release moves this product's number without claiming anything
about Collie's. Encoding the correspondence in the version itself — as a build-metadata suffix, say —
would make every upstream adoption look like a release of ours.

[`FORK.toml`](./FORK.toml) is the machine-readable boundary. New downstream behavior belongs in a
declared owned root. A change to an upstream-owned file must expose a narrow port, carry a stable
anchor and reason, and be reviewed again at every upstream synchronization.

The generic downstream runtime and security contract is documented in
[`docs/herdr-fleet.md`](./docs/herdr-fleet.md). Live configuration and deployment details are not
part of this public repository.
