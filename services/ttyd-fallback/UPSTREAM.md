# Upstream audit

- Project: `tsl0922/ttyd`, MIT license.
- Pin: release `1.7.7`, commit `40e79c7`, published 2024-03-30.
- Linux assets: publisher-provided static `ttyd.x86_64` and `ttyd.aarch64`; exact digests are in `SHA256SUMS`.
- Darwin source policy: the deployment inventory may name an absolute, explicitly reviewed local
  package-manager binary together with its exact SHA-256 and version output. The installer copies
  that candidate after the same native-format, architecture, interface, and integrity gates; it
  does not invoke a package manager, resolve `PATH`, or modify the source binary.
- Required interface: Unix socket binding/ownership, proxy-auth header, writable mode, Origin check, one-client limit, and base path. Browser URL arguments remain disabled.
- Security review on 2026-08-20: GitHub's repository advisory feed had no published advisory. Open issue #1551 concerns static-build mTLS enforcement and is not applicable because this component does not enable ttyd TLS/mTLS. Open issue #1546 describes a zero-length WebSocket crash; the deployment limits exposure with authentication before upstream, one client, a short explicit lease, and a normally absent listener. A fixed upstream release should replace this pin through a later Herdr OpenSpec change.

Sources:

- <https://github.com/tsl0922/ttyd/releases/tag/1.7.7>
- <https://github.com/tsl0922/ttyd/blob/1.7.7/LICENSE>
- <https://github.com/tsl0922/ttyd/issues/1546>
- <https://github.com/tsl0922/ttyd/issues/1551>
