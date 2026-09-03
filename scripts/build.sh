#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=lib-bun.sh
source "$root/scripts/lib-bun.sh"
bun_bin="$(find_bun)"

"$root/scripts/check-version.sh"
(cd "$root" && "$bun_bin" install --frozen-lockfile && "$bun_bin" run typecheck)
(cd "$root/web" && "$bun_bin" install --frozen-lockfile && "$bun_bin" run typecheck)
case "${HERDR_WEB_TTYD_TEST_MODE:-run}" in
  run)
    "$root/services/ttyd-fallback/test/run.sh"
    ;;
  defer-to-activation)
    printf 'web-remote: ttyd companion tests deferred to the managed activation gate\n'
    ;;
  *)
    printf 'web-remote: invalid HERDR_WEB_TTYD_TEST_MODE\n' >&2
    exit 1
    ;;
esac

staging="$root/web/dist-staging"
old="$root/web/dist-old"
rm -rf "$staging" "$old"
(cd "$root/web" && "$bun_bin" run build -- --outDir dist-staging --emptyOutDir)
[[ -d "$staging" && -f "$staging/index.html" ]] || {
  printf 'web-remote: staged web build is incomplete\n' >&2
  exit 1
}
[[ ! -d "$root/web/dist" ]] || mv "$root/web/dist" "$old"
mv "$staging" "$root/web/dist"
rm -rf "$old"
