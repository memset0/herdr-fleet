#!/usr/bin/env bash
# Version consistency gate for Collie.
#
# The plugin's version lives in three files that MUST agree, plus a matching CHANGELOG entry:
#   - herdr-plugin.toml   (canonical — this is what Herdr reads)
#   - package.json        (bridge / Bun server)
#   - web/package.json    (PWA frontend)
#   - CHANGELOG.md        (newest "## [x.y.z]" heading)
#
# Exits non-zero with a clear message on any mismatch. Run by `scripts/build.sh` and the
# pre-commit hook. See CLAUDE.md → "Versioning" for the policy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_mode=0

case "${1:-}" in
  "") ;;
  --release) release_mode=1 ;;
  *) echo "usage: $0 [--release]" >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then
  echo "usage: $0 [--release]" >&2
  exit 2
fi

toml_v="$(sed -n 's/^[[:space:]]*version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/herdr-plugin.toml" | head -1)"
pkg_v="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/package.json" | head -1)"
web_v="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/web/package.json" | head -1)"
log_v="$(sed -n 's/^##[[:space:]]*\[\([0-9][^]]*\)\].*/\1/p' "$ROOT/CHANGELOG.md" 2>/dev/null | head -1)"

fail=0
note() { printf '  %-18s %s\n' "$1" "$2"; }

if [ -z "$toml_v" ]; then echo "✗ could not read version from herdr-plugin.toml" >&2; exit 1; fi

if [ "$pkg_v" != "$toml_v" ] || [ "$web_v" != "$toml_v" ] || [ "$log_v" != "$toml_v" ]; then
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "✗ version mismatch — all four must equal the canonical herdr-plugin.toml version:" >&2
  note "herdr-plugin.toml" "$toml_v  (canonical)"
  note "package.json" "${pkg_v:-<missing>}"
  note "web/package.json" "${web_v:-<missing>}"
  note "CHANGELOG.md" "${log_v:-<missing>}"
  echo "  → bump all three files to the same version and add a matching CHANGELOG entry." >&2
  exit 1
fi

echo "✓ version $toml_v consistent across manifest, package.json, web/package.json, CHANGELOG"

if [[ "$release_mode" -eq 1 ]]; then
  # shellcheck source=version-policy.sh
  source "$ROOT/scripts/version-policy.sh"
  latest_tag=""
  while IFS= read -r tag; do
    if [[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
      latest_tag="$tag"
      break
    fi
  done < <(git -C "$ROOT" tag --list --sort=-version:refname)

  if [[ -z "$latest_tag" ]]; then
    echo "✗ no prior strict vX.Y.Z release tag found" >&2
    exit 1
  fi

  bump="$(classify_version_bump "${latest_tag#v}" "$toml_v")"
  require_release_approval "$bump" "$toml_v"
  echo "✓ $bump release $latest_tag -> v$toml_v satisfies the release policy"
fi
