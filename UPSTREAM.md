# Upstream provenance

The node bridge and React PWA are derived from
[AltanS/collie](https://github.com/AltanS/collie), version **v0.23.1**, commit
`f5b2eff52aa6e51a5f4d4e0ac9777ac10f0b906f`.

The upstream Git history and MIT `LICENSE` are retained. Web Remote adds the Fleet Gateway,
single-account authentication, multi-instance routing, SSH transports, and a Herdr-coupled
plugin-owned supervisor. Upstream's Tailscale/system-service control path is intentionally not part
of this derivative's supported workflow.

When importing a later Collie release, merge or cherry-pick from the `upstream` remote, rerun both
projects' complete test suites, and update the exact commit above in the same release.
