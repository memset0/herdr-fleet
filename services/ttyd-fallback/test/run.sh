#!/usr/bin/env bash
set -euo pipefail

feature_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
python_bin="${HERDR_WEB_TTYD_PYTHON:-python3}"
compile_root="$(mktemp -d "${TMPDIR:-/tmp}/herdr-web-remote-ttyd-compile.XXXXXX")"
cleanup() { find "$compile_root" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT
command -v "$python_bin" >/dev/null 2>&1 || {
  printf 'fallback tests: configured Python is unavailable: %s\n' "$python_bin" >&2
  exit 1
}
PYTHONPYCACHEPREFIX="$compile_root" "$python_bin" -m py_compile "$feature_dir"/*.py
export PYTHONDONTWRITEBYTECODE=1
bash -n "$feature_dir/install.sh"
bash -n "$feature_dir/ttyd-fallback"
HERDR_WEB_TTYD_CONFIG_PYTHON="$python_bin" "$feature_dir/test/test_installer.sh"
"$python_bin" "$feature_dir/test/test_fallback.py"
