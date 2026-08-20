#!/usr/bin/env bash
set -euo pipefail

feature_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
compile_root="$(mktemp -d "${TMPDIR:-/tmp}/herdr-web-remote-ttyd-compile.XXXXXX")"
cleanup() { find "$compile_root" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT
PYTHONPYCACHEPREFIX="$compile_root" python3 -m py_compile "$feature_dir"/*.py
export PYTHONDONTWRITEBYTECODE=1
bash -n "$feature_dir/install.sh"
bash -n "$feature_dir/ttyd-fallback"
"$feature_dir/test/test_installer.sh"
python3 "$feature_dir/test/test_fallback.py"
