#!/usr/bin/env bash

find_bun() {
  local candidate
  candidate="$(command -v bun 2>/dev/null || true)"
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi
  for candidate in \
    "${BUN_INSTALL:-}/bin/bun" \
    "${HOME}/.bun/bin/bun" \
    "/usr/local/bin/bun" \
    "/opt/homebrew/bin/bun"; do
    [[ "$candidate" != "/bin/bun" && -x "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done
  printf 'web-remote: Bun is required but was not found\n' >&2
  return 1
}
