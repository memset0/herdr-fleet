#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=lib-bun.sh
source "$root/scripts/lib-bun.sh"
bun_bin="$(find_bun)"

case "${1:-}" in
  action|copy) ;;
  *)
    printf 'web-remote: pane-url.sh expects action or copy\n' >&2
    exit 2
    ;;
esac

export HERDR_PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$root}"
exec "$bun_bin" run "$root/supervisor/pane-url.ts" "$1"
