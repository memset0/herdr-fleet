#!/usr/bin/env bash
# SemVer release policy shared by the release gate and its tests.

set -euo pipefail

semver_parts() {
  local version="$1"
  if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "invalid release version: $version" >&2
    return 1
  fi
  printf '%s %s %s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
}

classify_version_bump() {
  local previous="$1" current="$2"
  local previous_major previous_minor previous_patch
  local current_major current_minor current_patch

  read -r previous_major previous_minor previous_patch < <(semver_parts "$previous")
  read -r current_major current_minor current_patch < <(semver_parts "$current")

  if (( current_major == previous_major &&
        current_minor == previous_minor &&
        current_patch == previous_patch + 1 )); then
    printf 'patch\n'
    return 0
  fi

  if (( current_major == previous_major &&
        current_minor == previous_minor + 1 &&
        current_patch == 0 )); then
    printf 'minor\n'
    return 0
  fi

  if (( current_major == previous_major + 1 &&
        current_minor == 0 && current_patch == 0 )); then
    printf 'major\n'
    return 0
  fi

  echo "invalid release bump: $previous -> $current (use exactly the next patch, minor, or major version)" >&2
  return 1
}

require_release_approval() {
  local bump="$1" version="$2"

  case "$bump" in
    patch)
      return 0
      ;;
    minor)
      if [[ "${WEB_REMOTE_MINOR_RELEASE_APPROVAL:-}" != "$version" ]]; then
        echo "minor release $version requires WEB_REMOTE_MINOR_RELEASE_APPROVAL=$version" >&2
        return 1
      fi
      ;;
    major)
      if [[ "${WEB_REMOTE_MAJOR_RELEASE_APPROVAL:-}" != "$version" ]]; then
        echo "major release $version requires WEB_REMOTE_MAJOR_RELEASE_APPROVAL=$version" >&2
        return 1
      fi
      ;;
    *)
      echo "unknown release bump: $bump" >&2
      return 1
      ;;
  esac
}

version_policy_main() {
  if [[ $# -ne 3 ]]; then
    echo "usage: $0 classify|check PREVIOUS CURRENT" >&2
    return 2
  fi

  local command="$1" previous="$2" current="$3" bump
  bump="$(classify_version_bump "$previous" "$current")"

  case "$command" in
    classify)
      printf '%s\n' "$bump"
      ;;
    check)
      require_release_approval "$bump" "$current"
      printf '%s\n' "$bump"
      ;;
    *)
      echo "usage: $0 classify|check PREVIOUS CURRENT" >&2
      return 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  version_policy_main "$@"
fi
