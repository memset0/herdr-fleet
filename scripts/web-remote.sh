#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=lib-bun.sh
source "$root/scripts/lib-bun.sh"
bun_bin="$(find_bun)"
export HERDR_PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$root}"
exec "$bun_bin" run "$root/supervisor/control.ts" "${1:-status}"
