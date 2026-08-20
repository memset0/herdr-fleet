#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
inventory=""
node_id=""
install_root_override=""
source_binary="${HERDR_WEB_TTYD_SOURCE_BINARY:-}"
dry_run="${HERDR_WEB_TTYD_DRY_RUN:-0}"
config_python="${HERDR_WEB_TTYD_CONFIG_PYTHON:-python3}"

die() { printf 'herdr-web-remote ttyd: error: %s\n' "$*" >&2; exit 1; }
log() { printf 'herdr-web-remote ttyd: %s\n' "$*"; }

while (($#)); do
  case "$1" in
    --inventory)
      (($# >= 2)) || die "--inventory requires a path"
      inventory="$2"
      shift 2
      ;;
    --node)
      (($# >= 2)) || die "--node requires an id"
      node_id="$2"
      shift 2
      ;;
    --install-root)
      (($# >= 2)) || die "--install-root requires a path"
      install_root_override="$2"
      shift 2
      ;;
    --source-binary)
      (($# >= 2)) || die "--source-binary requires a path"
      source_binary="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      printf 'usage: %s --inventory PATH --node ID [--install-root PATH] [--source-binary PATH] [--dry-run]\n' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$(uname -s)" == Linux ]] || die "the ttyd companion supports Linux only"
[[ -n "$inventory" && -f "$inventory" ]] || die "--inventory must name a readable file"
[[ "$node_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || die "--node is invalid"
command -v "$config_python" >/dev/null 2>&1 || die "configuration Python is unavailable"

case "$(uname -m)" in
  x86_64|amd64) arch="x86_64"; asset="ttyd.x86_64" ;;
  aarch64|arm64) arch="aarch64"; asset="ttyd.aarch64" ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac

if ! node_output="$("$config_python" -c '
import pathlib, sys
sys.path.insert(0, sys.argv[1])
import controller
inventory = controller.load_inventory(pathlib.Path(sys.argv[2]))
node = controller.select_node(inventory, sys.argv[3])
for value in (
    node["architecture"], node["owner"], node["python"], node["install_root"],
    node.get("host_exact", ""), node.get("host_prefix", ""),
    "true" if node.get("reject_slurm") is True else "false",
):
    print(value)
' "$service_dir" "$inventory" "$node_id")"; then
  die "unknown, disabled, or incomplete node: $node_id"
fi
mapfile -t node_fields <<<"$node_output"

((${#node_fields[@]} == 7)) || die "node inventory returned an invalid shape"
node_arch="${node_fields[0]}"
node_owner="${node_fields[1]}"
node_python="${node_fields[2]}"
inventory_install_root="${node_fields[3]}"
host_exact="${node_fields[4]}"
host_prefix="${node_fields[5]}"
reject_slurm="${node_fields[6]}"

[[ "$node_arch" == "$arch" ]] || die "architecture mismatch for $node_id: inventory=$node_arch local=$arch"
[[ "$(id -un)" == "$node_owner" ]] || die "owner gate rejected; expected $node_owner"
short_host="$(hostname -s)"
[[ -z "$host_exact" || "$short_host" == "$host_exact" ]] || die "host gate rejected: $short_host"
[[ -z "$host_prefix" || "$short_host" == "$host_prefix"* ]] || die "host gate rejected: $short_host"
[[ "$reject_slurm" != true || -z "${SLURM_JOB_ID:-}" ]] || die "scheduler-job gate rejected"
[[ -x "$node_python" ]] || die "node Python is unavailable: $node_python"

install_root="${install_root_override:-$inventory_install_root}"
[[ "$install_root" == /* ]] || die "install root must be absolute"
version="$(tr -d '[:space:]' <"$service_dir/VERSION")"
expected="$(awk -v name="$asset" '$2 == name {print $1; exit}' "$service_dir/SHA256SUMS")"
[[ "$expected" =~ ^[0-9a-f]{64}$ ]] || die "missing checksum for $asset"

case "$dry_run" in
  0) ;;
  1)
    log "dry-run version=$version asset=$asset node=$node_id target=$install_root/bin/ttyd"
    exit 0
    ;;
  *) die "HERDR_WEB_TTYD_DRY_RUN must be 0 or 1" ;;
esac

stage="$(mktemp -d "${TMPDIR:-/tmp}/herdr-web-remote-ttyd-install.XXXXXX")"
cleanup() { find "$stage" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT
candidate="$stage/$asset"
if [[ -n "$source_binary" ]]; then
  [[ -f "$source_binary" ]] || die "source binary does not exist: $source_binary"
  cp "$source_binary" "$candidate"
else
  command -v curl >/dev/null 2>&1 || die "curl is required"
  curl --fail --location --proto '=https' --tlsv1.2 \
    "https://github.com/tsl0922/ttyd/releases/download/${version}/${asset}" \
    --output "$candidate"
fi
actual="$(sha256sum "$candidate" | awk '{print $1}')"
[[ "$actual" == "$expected" ]] || die "checksum mismatch for $asset"
chmod 0755 "$candidate"
"$candidate" --version 2>&1 | grep -Fq "ttyd version ${version}-40e79c7" \
  || die "unexpected ttyd version"
help="$($candidate --help 2>&1)"
for option in --interface --socket-owner --auth-header --writable --check-origin --max-clients --base-path; do
  grep -Fq -- "$option" <<<"$help" || die "required option missing: $option"
done

bin_dir="$install_root/bin"
install -d -m 0700 "$install_root" "$bin_dir" "$install_root/web"
install -m 0755 "$candidate" "$bin_dir/ttyd.new"
mv -f "$bin_dir/ttyd.new" "$bin_dir/ttyd"
for name in node.py stdio_unix_relay.py stdio_broker.py auth_helper.py controller.py ttyd-fallback install.sh; do
  install -m 0755 "$service_dir/$name" "$install_root/$name"
done
install -m 0644 "$service_dir/VERSION" "$service_dir/SHA256SUMS" "$service_dir/UPSTREAM.md" "$install_root/"
install -m 0644 "$service_dir/web/index.html" "$install_root/web/index.html"

"$node_python" -c '
import json, pathlib, sys
inventory = json.loads(pathlib.Path(sys.argv[1]).read_text())
node_id, ttyd, version_output, target = sys.argv[2:]
node = inventory["nodes"][node_id]
keys = ("owner", "herdr", "session", "server_socket", "runtime_dir", "public_host", "host_exact", "host_prefix", "reject_slurm", "environment")
result = {"id": node_id, "ttyd": ttyd, "ttyd_version_output": version_output}
result.update({key: node[key] for key in keys if key in node})
path = pathlib.Path(target)
path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
' "$inventory" "$node_id" "$bin_dir/ttyd" "ttyd version ${version}-40e79c7" "$stage/node.json"
install -m 0600 "$stage/node.json" "$install_root/node.json"
log "installed verified ttyd $version and dormant companion controls at $install_root"
log "no process, listener, route, service, timer, hook, or supervisor was started"
