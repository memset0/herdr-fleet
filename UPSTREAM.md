# Upstream and fork boundary

Herdr Fleet v3 began as a downstream reapplication of
[Collie](https://github.com/AltanS/collie) v1.2.0:

- tag object: `0f98f28c9aaadd641c4bc5ac484190ee3ef7008c`
- commit: `4618c90534d6f818ed6788b8db00e1582c5abfdc`

Collie remains MIT-licensed and attributed through its existing license, history, documentation,
and source. Unchanged Collie behavior is upstream behavior, not a Herdr Fleet capability.

[`FORK.toml`](./FORK.toml) is the machine-readable boundary. New downstream behavior belongs in a
declared owned root. A change to an upstream-owned file must expose a narrow port, carry a stable
anchor and reason, and be reviewed again at every upstream synchronization.
