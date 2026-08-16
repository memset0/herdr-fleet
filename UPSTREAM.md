# Upstream provenance

The node bridge and React PWA are derived from
[AltanS/collie](https://github.com/AltanS/collie), version **v0.28.0**, commit
`2910f40278f3ca1646fc472dd3589da4a47776e4`.

The upstream Git history and MIT `LICENSE` are retained. Web Remote adds the Fleet Gateway,
single-account authentication, multi-instance routing, SSH transports, and a Herdr-coupled
plugin-owned supervisor. Upstream's Tailscale/system-service control path is intentionally not part
of this derivative's supported workflow. Windows Task Scheduler, QR lifecycle tooling, and
upstream's moving self-update path are likewise excluded.

When importing a later Collie release, start from clean synchronized checkouts with one writer,
preflight a named stable tag, and merge that tag's dereferenced commit from the `upstream` remote so
the release remains Git ancestry. Do not silently follow upstream's default branch. Record the
overlap and boundary decisions, rerun both projects' complete test suites, verify an untagged node
candidate, and update the exact tag and commit above in the accepted release.
