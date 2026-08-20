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

python3 -c '
import json, os, pathlib, pwd, socket, sys
root, current, wrong = sys.argv[1:]
base = {
    "enabled": True,
    "owner": pwd.getpwuid(os.geteuid()).pw_name,
    "python": sys.executable,
    "host_exact": socket.gethostname().split(".")[0],
    "herdr": "/usr/bin/false",
    "session": None,
    "server_socket": str(pathlib.Path(root) / "herdr.sock"),
    "runtime_dir": str(pathlib.Path(root) / "runtime"),
    "public_host": "terminal-a.example.com",
    "transport": {"kind": "local"},
}
good = dict(base, architecture=current, install_root=str(pathlib.Path(root) / "install"))
bad = dict(base, architecture=wrong, install_root=str(pathlib.Path(root) / "wrong"))
pathlib.Path(root, "inventory.json").write_text(json.dumps({"schema": 1, "nodes": {"local-a": good, "wrong-arch": bad}}))
' "$test_root" "$current_arch" "$wrong_arch"
inventory="$test_root/inventory.json"

if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/install.sh" --inventory "$inventory" --node unknown >"$test_root/unknown.out" 2>&1; then
  printf 'installer test: unknown node unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Eq 'unknown, disabled, or incomplete node|invalid shape' "$test_root/unknown.out"

if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/install.sh" --inventory "$inventory" --node wrong-arch >"$test_root/arch.out" 2>&1; then
  printf 'installer test: wrong architecture unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'architecture mismatch' "$test_root/arch.out"

python3 - "$inventory" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
inventory = json.loads(path.read_text())
inventory["nodes"]["local-a"]["unexpected"] = "must-fail-closed"
path.write_text(json.dumps(inventory))
PY
if HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/install.sh" --inventory "$inventory" --node local-a >"$test_root/schema.out" 2>&1; then
  printf 'installer test: unknown inventory field unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'unknown, disabled, or incomplete node' "$test_root/schema.out"
python3 - "$inventory" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
inventory = json.loads(path.read_text())
inventory["nodes"]["local-a"].pop("unexpected")
path.write_text(json.dumps(inventory))
PY

if HERDR_WEB_TTYD_SOURCE_BINARY=/bin/true \
  "$service_dir/install.sh" --inventory "$inventory" --node local-a >"$test_root/checksum.out" 2>&1; then
  printf 'installer test: wrong checksum unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Fq 'checksum mismatch' "$test_root/checksum.out"

HERDR_WEB_TTYD_DRY_RUN=1 \
  "$service_dir/ttyd-fallback" install --inventory "$inventory" --node local-a \
  >"$test_root/dry-run.out"
grep -Fq 'dry-run version=' "$test_root/dry-run.out"

printf 'installer rejection tests: ok\n'
