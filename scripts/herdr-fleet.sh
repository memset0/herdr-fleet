#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

find_bun() {
  local candidate
  if candidate="$(command -v bun 2>/dev/null)" && [[ "$candidate" = /* ]]; then
    printf '%s' "$candidate"
    return
  fi
  for candidate in "${BUN_INSTALL:-${HOME}/.bun}/bin/bun" "${HOME}/.bun/bin/bun" "${HOME}/.local/bin/bun" /usr/local/bin/bun /opt/homebrew/bin/bun /usr/bin/bun; do
    if [[ -x "$candidate" ]]; then
      printf '%s' "$candidate"
      return
    fi
  done
}

bun_bin="$(find_bun)"
[[ -n "$bun_bin" ]] || { printf 'herdr-fleet: Bun is required\n' >&2; exit 1; }

export HERDR_PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$root}"
if [[ -z "${HERDR_FLEET_CONFIG:-}" && -n "${HERDR_PLUGIN_CONFIG_DIR:-}" ]]; then
  export HERDR_FLEET_CONFIG="${HERDR_PLUGIN_CONFIG_DIR}/fleet.toml"
fi

operation="${1:-status}"
if [[ "$operation" == "build" ]]; then
  exec bash "$root/scripts/collie-ctl.sh" build
fi
if [[ "$operation" != "url" && "$operation" != "status" && "$operation" != "stop" && ! -x "$root/bin/collie" ]]; then
  bash "$root/scripts/collie-ctl.sh" build
fi
exec "$bun_bin" run "$root/fleet/control.ts" "$operation"
