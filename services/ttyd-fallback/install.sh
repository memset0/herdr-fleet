#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
python_bin="${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}"
command -v "$python_bin" >/dev/null 2>&1 || {
  printf 'herdr-web-remote ttyd: error: configuration Python is unavailable: %s\n' "$python_bin" >&2
  exit 1
}
export PYTHONDONTWRITEBYTECODE=1
exec "$python_bin" -B "$service_dir/installer.py" "$@"
