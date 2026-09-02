#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/herdr-web-remote-ttyd-installer-test.XXXXXX")"
cleanup() { find "$test_root" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT

case "$(uname -m)" in
  x86_64|amd64) current_arch=x86_64; wrong_arch=aarch64 ;;
  aarch64|arm64) current_arch=aarch64; wrong_arch=x86_64 ;;
  *) printf 'installer test: unsupported test architecture\n' >&2; exit 1 ;;
esac
case "$(uname -s)" in
  Linux) current_platform=linux ;;
  Darwin) current_platform=darwin ;;
  *) printf 'installer test: unsupported test platform\n' >&2; exit 1 ;;
esac

"${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}" -c '
import hashlib, json, os, pathlib, pwd, socket, sys
root, platform, current, wrong = sys.argv[1:]
base = {
    "platform": platform,
    "owner": pwd.getpwuid(os.geteuid()).pw_name,
    "herdr_owner": pwd.getpwuid(os.geteuid()).pw_name,
    "python": sys.executable,
    "host_exact": socket.gethostname().split(".")[0],
    "herdr": "/usr/bin/false",
    "session": None,
    "server_socket": str(pathlib.Path(root) / "herdr.sock"),
    "runtime_dir": str(pathlib.Path(root) / "runtime"),
    "transport": {"kind": "local"},
}
if platform == "linux":
    binary = {"source": "release_asset"}
else:
    source = pathlib.Path("/usr/bin/true")
    binary = {"source": "local_path", "path": str(source),
              "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "version_output": "ttyd version synthetic"}
base["binary"] = binary
good = dict(base, architecture=current, install_root=str(pathlib.Path(root) / "install"))
bad = dict(base, architecture=wrong, install_root=str(pathlib.Path(root) / "wrong"))
pathlib.Path(root, "inventory.json").write_text(json.dumps({"schema": 3, "nodes": {"local-a": good, "wrong-arch": bad}}))
' "$test_root" "$current_platform" "$current_arch" "$wrong_arch"
inventory="$test_root/inventory.json"

if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/ttyd-fallback" install --inventory "$inventory" --node unknown >"$test_root/unknown.out" 2>&1; then
  printf 'installer test: unknown node unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Eq 'unknown node|invalid shape' "$test_root/unknown.out"

if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/ttyd-fallback" install --inventory "$inventory" --node wrong-arch >"$test_root/arch.out" 2>&1; then
  printf 'installer test: wrong architecture unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'architecture mismatch' "$test_root/arch.out"

"${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}" - "$inventory" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
inventory = json.loads(path.read_text())
inventory["nodes"]["local-a"]["unexpected"] = "must-fail-closed"
path.write_text(json.dumps(inventory))
PY
if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/ttyd-fallback" install --inventory "$inventory" --node local-a >"$test_root/schema.out" 2>&1; then
  printf 'installer test: unknown inventory field unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'contains unknown fields' "$test_root/schema.out"
"${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}" - "$inventory" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
inventory = json.loads(path.read_text())
inventory["nodes"]["local-a"].pop("unexpected")
path.write_text(json.dumps(inventory))
PY

if [[ "$current_platform" == darwin ]]; then
  "${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}" - "$inventory" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
inventory = json.loads(path.read_text())
inventory["nodes"]["local-a"]["binary"]["sha256"] = "0" * 64
path.write_text(json.dumps(inventory))
PY
fi
if HERDR_WEB_TTYD_SOURCE_BINARY=/usr/bin/true \
  "$service_dir/ttyd-fallback" install --inventory "$inventory" --node local-a >"$test_root/checksum.out" 2>&1; then
  printf 'installer test: wrong checksum unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'checksum mismatch' "$test_root/checksum.out"

if [[ "$current_platform" == linux ]]; then
  HERDR_WEB_TTYD_DRY_RUN=1 \
    "$service_dir/ttyd-fallback" install --inventory "$inventory" --node local-a \
    >"$test_root/dry-run.out"
  grep -Fq 'dry-run source=release_asset' "$test_root/dry-run.out"
fi

env -u PYTHONDONTWRITEBYTECODE \
  "$service_dir/ttyd-fallback" install --help >"$test_root/no-pycache.out"
test ! -d "$service_dir/__pycache__"

printf 'installer rejection tests: ok\n'
