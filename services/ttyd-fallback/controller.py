#!/usr/bin/env python3
"""Transactional controller for Web Remote's normally closed ttyd companion."""

from __future__ import annotations

import argparse
import base64
import fcntl
import grp
import hashlib
import json
import os
import pathlib
import pwd
import re
import secrets
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import time
from typing import Any

FEATURE_DIR = pathlib.Path(__file__).resolve().parent
DEFAULT_LIVE_ROOT = pathlib.Path(os.environ.get(
    "XDG_CONFIG_HOME", pathlib.Path.home() / ".config"
)) / "herdr-web-remote" / "ttyd-fallback"
DEFAULT_RUNTIME_ROOT = pathlib.Path(os.environ.get(
    "XDG_RUNTIME_DIR", f"/tmp/herdr-web-remote-{os.geteuid()}"
)) / "ttyd-fallback"
DEFAULT_STATE_ROOT = pathlib.Path(os.environ.get(
    "XDG_STATE_HOME", pathlib.Path.home() / ".local" / "state"
)) / "herdr-web-remote" / "ttyd-fallback"
DEFAULT_CADDY_CONFIG = pathlib.Path("/etc/caddy/Caddyfile")
DEFAULT_CADDY_FRAGMENT = pathlib.Path("/etc/caddy/herdr-web-remote.d/ttyd-fallback.caddy")
DEFAULT_CADDY_IMPORT = "import /etc/caddy/herdr-web-remote.d/*.caddy"
DEFAULT_LANDING_ROOT = pathlib.Path("/var/lib/herdr-web-remote/ttyd-fallback")
TTYD_VERSION = (FEATURE_DIR / "VERSION").read_text().strip()
TTYD_VERSION_OUTPUT = f"ttyd version {TTYD_VERSION}-40e79c7"
MIN_LEASE = 30
MAX_LEASE = 7200
NODE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
HOSTNAME = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
USER = re.compile(r"^[A-Za-z_][A-Za-z0-9_.-]{0,63}$")


class ControllerError(RuntimeError):
    pass


def nonempty(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or any(ord(char) < 32 for char in value):
        raise ControllerError(f"{label} must be a non-empty string")
    return value.strip()


def absolute_path(value: Any, label: str) -> str:
    result = pathlib.Path(nonempty(value, label))
    if not result.is_absolute():
        raise ControllerError(f"{label} must be absolute")
    return str(result)


def relative_live_path(value: Any, label: str) -> str:
    result = pathlib.PurePosixPath(nonempty(value, label))
    if result.is_absolute() or ".." in result.parts or result == pathlib.PurePosixPath("."):
        raise ControllerError(f"{label} must be a contained relative path")
    return str(result)


def port(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > 65535:
        raise ControllerError(f"{label} must be a TCP port")
    return value


def load_inventory(path: pathlib.Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if set(data) != {"schema", "nodes"} or data.get("schema") != 1 or not isinstance(data.get("nodes"), dict):
        raise ControllerError("unsupported inventory schema")
    if not data["nodes"]:
        raise ControllerError("inventory must contain at least one node")
    for node_id, raw_node in data["nodes"].items():
        label = f"nodes.{node_id}"
        if not isinstance(node_id, str) or not NODE_ID.fullmatch(node_id):
            raise ControllerError(f"{label} has an invalid node id")
        if not isinstance(raw_node, dict):
            raise ControllerError(f"{label} must be an object")
        required = {"enabled", "architecture", "owner", "python", "herdr", "session", "server_socket",
                    "runtime_dir", "install_root", "public_host", "transport"}
        allowed = required | {"host_exact", "host_prefix", "reject_slurm", "environment"}
        missing = sorted(required - raw_node.keys())
        if missing:
            raise ControllerError(f"{label} is missing: {', '.join(missing)}")
        extra = sorted(raw_node.keys() - allowed)
        if extra:
            raise ControllerError(f"{label} contains unknown fields: {', '.join(extra)}")
        if raw_node["enabled"] is not True and raw_node["enabled"] is not False:
            raise ControllerError(f"{label}.enabled must be boolean")
        if raw_node["architecture"] not in {"x86_64", "aarch64"}:
            raise ControllerError(f"{label}.architecture is unsupported")
        owner = nonempty(raw_node["owner"], f"{label}.owner")
        if not USER.fullmatch(owner):
            raise ControllerError(f"{label}.owner is invalid")
        for key in ("python", "herdr", "server_socket", "runtime_dir", "install_root"):
            absolute_path(raw_node[key], f"{label}.{key}")
        public_host = nonempty(raw_node["public_host"], f"{label}.public_host").lower().rstrip(".")
        if not HOSTNAME.fullmatch(public_host):
            raise ControllerError(f"{label}.public_host is invalid")
        if raw_node["session"] is not None:
            nonempty(raw_node["session"], f"{label}.session")
        if "host_exact" in raw_node:
            nonempty(raw_node["host_exact"], f"{label}.host_exact")
        if "host_prefix" in raw_node:
            nonempty(raw_node["host_prefix"], f"{label}.host_prefix")
        if "environment" in raw_node and not isinstance(raw_node["environment"], dict):
            raise ControllerError(f"{label}.environment must be an object")
        if "environment" in raw_node:
            for key, value in raw_node["environment"].items():
                if not isinstance(key, str) or not key or not isinstance(value, str) or "\0" in key + value:
                    raise ControllerError(f"{label}.environment contains an invalid entry")
        if "reject_slurm" in raw_node and not isinstance(raw_node["reject_slurm"], bool):
            raise ControllerError(f"{label}.reject_slurm must be boolean")
        transport = raw_node["transport"]
        if not isinstance(transport, dict) or transport.get("kind") not in {"local", "ssh"}:
            raise ControllerError(f"{label}.transport.kind must be local or ssh")
        if transport["kind"] == "local" and set(transport) != {"kind"}:
            extra = sorted(transport.keys() - {"kind"})
            raise ControllerError(f"{label}.transport contains unknown fields: {', '.join(extra)}")
        if transport["kind"] == "ssh":
            transport_allowed = {"kind", "host", "user", "port", "identity", "known_hosts",
                                 "control_identity", "control_known_hosts", "jump"}
            extra = sorted(transport.keys() - transport_allowed)
            if extra:
                raise ControllerError(f"{label}.transport contains unknown fields: {', '.join(extra)}")
            for key in ("host", "user"):
                value = nonempty(transport.get(key), f"{label}.transport.{key}")
                if key == "user" and not USER.fullmatch(value):
                    raise ControllerError(f"{label}.transport.user is invalid")
            port(transport.get("port"), f"{label}.transport.port")
            relative_live_path(transport.get("identity"), f"{label}.transport.identity")
            relative_live_path(transport.get("known_hosts"), f"{label}.transport.known_hosts")
            absolute_path(transport.get("control_identity"), f"{label}.transport.control_identity")
            relative_live_path(
                transport.get("control_known_hosts", transport.get("known_hosts")),
                f"{label}.transport.control_known_hosts",
            )
            jump = transport.get("jump")
            if jump is not None:
                if not isinstance(jump, dict):
                    raise ControllerError(f"{label}.transport.jump must be an object")
                extra = sorted(jump.keys() - {"host", "user", "port", "identity", "known_hosts"})
                if extra:
                    raise ControllerError(f"{label}.transport.jump contains unknown fields: {', '.join(extra)}")
                for key in ("host", "user"):
                    value = nonempty(jump.get(key), f"{label}.transport.jump.{key}")
                    if key == "user" and not USER.fullmatch(value):
                        raise ControllerError(f"{label}.transport.jump.user is invalid")
                port(jump.get("port"), f"{label}.transport.jump.port")
                absolute_path(jump.get("identity"), f"{label}.transport.jump.identity")
                relative_live_path(jump.get("known_hosts"), f"{label}.transport.jump.known_hosts")
    return data


def select_node(inventory: dict[str, Any], node_id: str) -> dict[str, Any]:
    node = inventory["nodes"].get(node_id)
    if not node or node.get("enabled") is not True:
        raise ControllerError(f"unknown or disabled node: {node_id}")
    result = dict(node)
    result["id"] = node_id
    return result


def atomic_json(path: pathlib.Path, value: dict[str, Any], mode: int = 0o600) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".new")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)
    os.chmod(path, mode)


def process_start(pid: int) -> str | None:
    try:
        return pathlib.Path(f"/proc/{pid}/stat").read_text().split()[21]
    except (OSError, IndexError):
        return None


def process_matches(component: dict[str, Any], marker: str) -> bool:
    pid = int(component.get("pid", -1))
    if process_start(pid) != str(component.get("start", "")):
        return False
    try:
        cmdline = pathlib.Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ")
    except OSError:
        return False
    return marker.encode() in cmdline


def stop_component(component: dict[str, Any] | None, marker: str) -> None:
    if not component or not process_matches(component, marker):
        return
    pid = int(component["pid"])
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    for _ in range(30):
        if not process_matches(component, marker):
            return
        time.sleep(0.1)
    if process_matches(component, marker):
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def component(process: subprocess.Popen[bytes], marker: str) -> dict[str, Any]:
    for _ in range(20):
        start = process_start(process.pid)
        if start:
            return {"pid": process.pid, "start": start, "marker": marker}
        time.sleep(0.01)
    raise ControllerError(f"{marker} did not start")


def ssh_base(node: dict[str, Any], live_root: pathlib.Path, *, forced: bool) -> list[str]:
    transport = node["transport"]
    if transport["kind"] != "ssh":
        raise ControllerError("SSH requested for a local node")
    identity = live_root / transport["identity"] if forced else pathlib.Path(transport["control_identity"])
    known_key = transport["known_hosts"] if forced else transport.get("control_known_hosts", transport["known_hosts"])
    known_hosts = live_root / known_key
    command = ["ssh", "-T", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
               "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known_hosts}",
               "-o", "RequestTTY=no", "-o", "ForwardAgent=no", "-o", "ForwardX11=no",
               "-o", "PermitLocalCommand=no", "-o", "ControlMaster=no", "-o", "ConnectTimeout=10",
               "-i", str(identity), "-p", str(transport["port"])]
    if transport.get("jump"):
        jump = transport["jump"]
        proxy_known = live_root / jump["known_hosts"]
        proxy_args = ["ssh", "-F", "/dev/null", "-W", "%h:%p", "-o", "BatchMode=yes",
                      "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                      "-o", f"UserKnownHostsFile={proxy_known}", "-o", "RequestTTY=no",
                      "-o", "ForwardAgent=no", "-o", "ForwardX11=no", "-o", "ControlMaster=no",
                      "-i", jump["identity"], "-p", str(jump["port"]),
                      f"{jump['user']}@{jump['host']}"]
        command.extend(["-o", f"ProxyCommand={shlex.join(proxy_args)}"])
    command.append(f"{transport['user']}@{transport['host']}")
    return command


def node_config(node: dict[str, Any]) -> dict[str, Any]:
    return {key: node[key] for key in ("id", "owner", "herdr", "session", "server_socket",
                                        "runtime_dir", "public_host", "host_exact", "host_prefix",
                                        "reject_slurm", "environment") if key in node} | {
        "ttyd": f"{node['install_root']}/bin/ttyd",
        "ttyd_version_output": TTYD_VERSION_OUTPUT,
    }


def node_command(node: dict[str, Any], live_root: pathlib.Path, arguments: list[str],
                 timeout: int = 20) -> subprocess.CompletedProcess[str]:
    config = f"{node['install_root']}/node.json"
    command = [node["python"], f"{node['install_root']}/node.py", "--config", config, *arguments]
    if node["transport"]["kind"] == "local":
        final = command
    else:
        final = [*ssh_base(node, live_root, forced=False), shlex.join(command)]
    return subprocess.run(final, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True, timeout=timeout, check=False)


def require_node_success(result: subprocess.CompletedProcess[str], layer: str) -> dict[str, Any]:
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else f"status {result.returncode}"
        raise ControllerError(f"{layer}: {detail}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ControllerError(f"{layer}: invalid status response") from exc


def unix_http_status(path: pathlib.Path, request: bytes) -> int:
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(15)
    try:
        client.connect(str(path))
        client.sendall(request)
        response = b""
        while b"\r\n" not in response and len(response) < 4096:
            chunk = client.recv(4096)
            if not chunk:
                break
            response += chunk
    finally:
        client.close()
    try:
        return int(response.split(b"\r\n", 1)[0].split()[1])
    except (IndexError, ValueError) as exc:
        raise ControllerError("private upstream returned an invalid HTTP response") from exc


def write_node_configs(inventory: dict[str, Any], live_root: pathlib.Path) -> None:
    for node_id in sorted(inventory["nodes"]):
        if inventory["nodes"][node_id]["enabled"] is not True:
            continue
        node = select_node(inventory, node_id)
        atomic_json(live_root / "nodes" / f"{node_id}.json", node_config(node))


def prepare(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    if os.geteuid() != 0:
        raise ControllerError("central preparation must run as root")
    live_root = pathlib.Path(args.live_root)
    live_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(live_root, 0o700)
    write_node_configs(inventory, live_root)
    username_path = live_root / "username"
    credential_path = live_root / "credential"
    verifier_path = live_root / "verifier.json"
    if credential_path.exists() != verifier_path.exists():
        raise ControllerError("credential and verifier must either both exist or both be absent")
    if not credential_path.exists():
        password = secrets.token_urlsafe(30)
        salt = secrets.token_bytes(16)
        iterations = 600_000
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        credential_path.write_text(password + "\n")
        os.chmod(credential_path, 0o600)
        atomic_json(verifier_path, {"algorithm": "pbkdf2-sha256", "iterations": iterations,
                                    "salt": salt.hex(), "digest": digest.hex()})
    if username_path.exists():
        existing_username = username_path.read_text().strip()
        if args.username and existing_username != args.username:
            raise ControllerError("existing fallback username does not match --username")
    elif args.username:
        if not USER.fullmatch(args.username):
            raise ControllerError("fallback username is invalid")
        username_path.write_text(args.username + "\n")
    else:
        raise ControllerError("--username is required for first preparation")
    os.chmod(username_path, 0o600)
    public_keys: list[str] = []
    for node_id in sorted(inventory["nodes"]):
        if inventory["nodes"][node_id]["enabled"] is not True:
            continue
        node = select_node(inventory, node_id)
        if node["transport"]["kind"] != "ssh":
            continue
        key = live_root / node["transport"]["identity"]
        key.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(key.parent, 0o700)
        if not key.exists():
            result = subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C",
                                     f"herdr-web-remote-ttyd-{node_id}", "-f", str(key)], check=False)
            if result.returncode != 0:
                raise ControllerError(f"could not create dedicated key for {node_id}")
        os.chmod(key, 0o600)
        public_key = pathlib.Path(str(key) + ".pub")
        os.chmod(public_key, 0o644)
        public_keys.append(str(public_key))
    landing_root = pathlib.Path(args.landing_root)
    landing_root.mkdir(mode=0o755, parents=True, exist_ok=True)
    shutil.copyfile(FEATURE_DIR / "web" / "index.html", landing_root / "index.html")
    os.chmod(landing_root / "index.html", 0o644)
    caddy_dir = pathlib.Path(args.caddy_fragment).parent
    caddy_dir.mkdir(mode=0o755, parents=True, exist_ok=True)
    print(json.dumps({"prepared": True, "credential_file": str(credential_path),
                      "public_keys": public_keys,
                      "active": False}, sort_keys=True))


def caddy_fragment(node: dict[str, Any], runtime_dir: pathlib.Path, landing_root: pathlib.Path,
                   deadline: int) -> str:
    host = node["public_host"]
    auth_socket = runtime_dir / "auth.sock"
    upstream_socket = runtime_dir / "upstream.sock"
    return f"""# generated by Herdr Web Remote ttyd companion; removed on shutdown
{host} {{
    @bad_host not host {host}
    @bad_origin {{
        header Origin *
        not header Origin https://{host}
    }}

    route {{
        @expired expression `int({{time.now.unix}}) >= {deadline}`
        respond @expired 404
        respond @bad_host 404
        respond @bad_origin 403
        request_header -X-Herdr-Fallback-User
        request_header X-Forwarded-For {{http.request.remote.host}}
        forward_auth unix//{auth_socket} {{
            uri /verify
            copy_headers X-Herdr-Fallback-User
        }}

        @landing path /
        handle @landing {{
            root * {landing_root}
            file_server
        }}
        handle /terminal* {{
            reverse_proxy unix//{upstream_socket}
        }}
        respond 404
    }}
}}
"""


def caddy_apply(config_path: pathlib.Path, fragment_path: pathlib.Path, content: str | None) -> None:
    previous = fragment_path.read_text() if fragment_path.exists() else None
    if content is None:
        try:
            fragment_path.unlink()
        except FileNotFoundError:
            pass
    else:
        fragment_path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        tmp = fragment_path.with_suffix(".new")
        tmp.write_text(content)
        os.chmod(tmp, 0o644)
        os.replace(tmp, fragment_path)
    validate = subprocess.run(["caddy", "validate", "--config", str(config_path)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=False)
    if validate.returncode != 0:
        if previous is None:
            try:
                fragment_path.unlink()
            except FileNotFoundError:
                pass
        else:
            fragment_path.write_text(previous)
        raise ControllerError("Caddy validation rejected the fallback route")
    reload_result = subprocess.run(["caddy", "reload", "--config", str(config_path)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=False)
    if reload_result.returncode != 0:
        if previous is None:
            try:
                fragment_path.unlink()
            except FileNotFoundError:
                pass
        else:
            fragment_path.write_text(previous)
        subprocess.run(["caddy", "reload", "--config", str(config_path)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        raise ControllerError("Caddy reload failed; prior route was restored")


def read_state(path: pathlib.Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return {"invalid": True}


def remove_state(path: pathlib.Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def cleanup(args: argparse.Namespace, inventory: dict[str, Any], state: dict[str, Any] | None,
            *, stop_guard: bool = True, sweep_nodes: bool = False) -> list[str]:
    errors: list[str] = []
    fragment = pathlib.Path(args.caddy_fragment)
    try:
        caddy_apply(pathlib.Path(args.caddy_config), fragment, None)
    except ControllerError as exc:
        errors.append(str(exc))
    node_ids: list[str] = []
    if state:
        if stop_guard:
            stop_component(state.get("guard"), "_expire")
        stop_component(state.get("auth"), "auth_helper.py")
        stop_component(state.get("broker"), "stdio_broker.py")
        node_id = state.get("node")
        if isinstance(node_id, str) and node_id in inventory["nodes"]:
            node_ids.append(node_id)
    if sweep_nodes:
        node_ids.extend(
            node_id for node_id, node in inventory["nodes"].items() if node["enabled"] is True
        )
    for node_id in dict.fromkeys(node_ids):
        try:
            node = select_node(inventory, node_id)
            result = node_command(node, pathlib.Path(args.live_root), ["stop"], timeout=20)
            if result.returncode != 0:
                errors.append(f"node endpoint cleanup failed: {node_id}")
        except (ControllerError, OSError, subprocess.TimeoutExpired):
            errors.append(f"node endpoint cleanup unavailable: {node_id}")
    runtime_root = pathlib.Path(args.runtime_root)
    if runtime_root.exists():
        for child in runtime_root.iterdir():
            if child.is_socket() or child.is_file():
                try:
                    child.unlink()
                except OSError:
                    pass
    if not errors:
        remove_state(pathlib.Path(args.state_root) / "active.json")
    return errors


def enable(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    lease = int(args.lease)
    if lease < MIN_LEASE or lease > MAX_LEASE:
        raise ControllerError(f"lease must be between {MIN_LEASE} and {MAX_LEASE} seconds")
    node = select_node(inventory, args.node)
    live_root = pathlib.Path(args.live_root)
    caddyfile = pathlib.Path(args.caddy_config)
    try:
        caddy_lines = {line.strip() for line in caddyfile.read_text().splitlines()}
    except OSError as exc:
        raise ControllerError("Caddyfile is unavailable") from exc
    if args.caddy_import not in caddy_lines:
        raise ControllerError("Caddyfile does not contain the configured normally empty fragment import")
    modules = subprocess.run(["caddy", "list-modules", "--packages"], stdout=subprocess.PIPE,
                             stderr=subprocess.DEVNULL, text=True, check=False)
    installed_modules = {line.split()[0] for line in modules.stdout.splitlines() if line.split()}
    for required_module in ("http.handlers.headers", "http.handlers.reverse_proxy"):
        if modules.returncode != 0 or required_module not in installed_modules:
            raise ControllerError(f"installed Caddy lacks required module: {required_module}")
    state_path = pathlib.Path(args.state_root) / "active.json"
    stale = read_state(state_path)
    if stale:
        errors = cleanup(args, inventory, stale)
        if errors:
            raise ControllerError("stale activation could not be closed: " + "; ".join(errors))
    preflight_args = ["preflight"] + (["--pane", args.pane] if args.pane else [])
    preflight = require_node_success(node_command(node, live_root, preflight_args), "node preflight")
    activation = secrets.token_hex(12)
    start_args = ["start", "--activation-id", activation, "--lease", str(lease)]
    if args.pane:
        start_args.extend(["--pane", args.pane])
    try:
        started = require_node_success(node_command(node, live_root, start_args), "node start")
    except (ControllerError, OSError, subprocess.TimeoutExpired):
        try:
            node_command(node, live_root, ["stop"], timeout=20)
        except (OSError, subprocess.TimeoutExpired):
            pass
        raise
    deadline = int(started["deadline"])
    runtime_dir = pathlib.Path(args.runtime_root)
    provisional: dict[str, Any] = {"node": node["id"]}
    try:
        caddy_gid = grp.getgrnam(args.proxy_group).gr_gid
        runtime_dir.mkdir(mode=0o710, parents=True, exist_ok=True)
        os.chown(runtime_dir, 0, caddy_gid)
        os.chmod(runtime_dir, 0o710)
        transport_spec = dict(node["transport"])
        if transport_spec["kind"] == "local":
            transport_spec["node_config"] = str(live_root / "nodes" / f"{node['id']}.json")
        spec_path = runtime_dir / "transport.json"
        atomic_json(spec_path, transport_spec)
        broker_proc = subprocess.Popen([sys.executable, str(FEATURE_DIR / "stdio_broker.py"),
                                        "--spec", str(spec_path), "--socket", str(runtime_dir / "upstream.sock"),
                                        "--live-root", str(live_root), "--socket-gid", str(caddy_gid),
                                        "--deadline", str(deadline)],
                                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                       stderr=subprocess.DEVNULL, start_new_session=True)
        provisional["broker"] = component(broker_proc, "stdio_broker.py")
        auth_proc = subprocess.Popen([sys.executable, str(FEATURE_DIR / "auth_helper.py"),
                                      "--socket", str(runtime_dir / "auth.sock"), "--socket-gid", str(caddy_gid),
                                      "--verifier", str(live_root / "verifier.json"), "--username",
                                      (live_root / "username").read_text().strip(), "--deadline", str(deadline)],
                                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL, start_new_session=True)
        provisional["auth"] = component(auth_proc, "auth_helper.py")
        for required in (runtime_dir / "upstream.sock", runtime_dir / "auth.sock"):
            for _ in range(100):
                if required.exists():
                    break
                if broker_proc.poll() is not None or auth_proc.poll() is not None:
                    break
                time.sleep(0.05)
            if not required.exists():
                raise ControllerError(f"central component did not create {required.name}")
        username = (live_root / "username").read_text().strip()
        upstream_request = (f"GET /terminal/ HTTP/1.1\r\nHost: {node['public_host']}\r\n"
                            f"Origin: https://{node['public_host']}\r\n"
                            f"X-Herdr-Fallback-User: {username}\r\nConnection: close\r\n\r\n").encode()
        if unix_http_status(runtime_dir / "upstream.sock", upstream_request) != 200:
            raise ControllerError("private ttyd transport probe was rejected")
        invalid_request = b"GET /verify HTTP/1.1\r\nHost: localhost\r\nX-Forwarded-For: controller-invalid\r\n\r\n"
        if unix_http_status(runtime_dir / "auth.sock", invalid_request) != 401:
            raise ControllerError("authentication helper did not reject an invalid request")
        password = (live_root / "credential").read_text().strip()
        encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
        valid_request = ("GET /verify HTTP/1.1\r\nHost: localhost\r\n"
                         "X-Forwarded-For: controller-valid\r\n"
                         f"Authorization: Basic {encoded}\r\n\r\n").encode()
        if unix_http_status(runtime_dir / "auth.sock", valid_request) != 200:
            raise ControllerError("authentication helper rejected its live verifier")
    except (ControllerError, OSError, KeyError, ValueError, subprocess.TimeoutExpired):
        cleanup(args, inventory, provisional)
        raise
    state: dict[str, Any] = {"schema": 1, "node": node["id"], "activation_id": activation,
                             "pane_id": preflight["pane_id"], "deadline": deadline,
                             "broker": provisional["broker"], "auth": provisional["auth"],
                             "route": node["public_host"]}
    atomic_json(state_path, state)
    try:
        caddy_apply(pathlib.Path(args.caddy_config), pathlib.Path(args.caddy_fragment),
                    caddy_fragment(node, runtime_dir, pathlib.Path(args.landing_root), deadline))
        guard_proc = subprocess.Popen([sys.executable, str(FEATURE_DIR / "controller.py"),
                                       "--inventory", args.inventory, "--live-root", args.live_root,
                                       "--runtime-root", args.runtime_root, "--state-root", args.state_root,
                                       "--caddy-config", args.caddy_config, "--caddy-import", args.caddy_import,
                                       "--caddy-fragment", args.caddy_fragment, "--landing-root", args.landing_root,
                                       "--proxy-group", args.proxy_group,
                                       "_expire", "--activation-id", activation, "--deadline", str(deadline)],
                                      stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                      stderr=subprocess.DEVNULL, start_new_session=True)
        state["guard"] = component(guard_proc, "_expire")
        atomic_json(state_path, state)
    except (ControllerError, OSError):
        cleanup(args, inventory, state)
        raise
    print(json.dumps({"active": True, "node": node["id"], "pane_id": state["pane_id"],
                      "deadline": deadline, "url": f"https://{node['public_host']}/"}, sort_keys=True))


def disable(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    state_path = pathlib.Path(args.state_root) / "active.json"
    state = read_state(state_path)
    errors = cleanup(args, inventory, state, sweep_nodes=True)
    if errors:
        raise ControllerError("; ".join(errors))
    print(json.dumps({"active": False, "closed": True}, sort_keys=True))


def status(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    state = read_state(pathlib.Path(args.state_root) / "active.json")
    if not state or state.get("invalid"):
        print(json.dumps({"active": False, "route": pathlib.Path(args.caddy_fragment).exists()}, sort_keys=True))
        return
    node = select_node(inventory, state["node"])
    node_result = node_command(node, pathlib.Path(args.live_root), ["status"])
    listener = node_result.returncode == 0
    transport = process_matches(state.get("broker", {}), "stdio_broker.py")
    auth = process_matches(state.get("auth", {}), "auth_helper.py")
    ingress = pathlib.Path(args.caddy_fragment).exists()
    active = int(state.get("deadline", 0)) > int(time.time()) and listener and transport and auth and ingress
    result = {"active": active, "node": state["node"], "pane_id": state.get("pane_id"),
              "deadline": state.get("deadline"), "listener": listener, "transport": transport,
              "auth": auth, "ingress": ingress}
    print(json.dumps(result, sort_keys=True))


def expire(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    state = read_state(pathlib.Path(args.state_root) / "active.json")
    if state and state.get("activation_id") == args.activation_id:
        cleanup(args, inventory, state, stop_guard=False)


def wait_for_expiry_or_failure(args: argparse.Namespace, inventory: dict[str, Any]) -> None:
    state_path = pathlib.Path(args.state_root) / "active.json"
    while True:
        state = read_state(state_path)
        if not state or state.get("activation_id") != args.activation_id:
            return
        now = int(time.time())
        if now >= args.deadline:
            return
        healthy = (process_matches(state.get("broker", {}), "stdio_broker.py")
                   and process_matches(state.get("auth", {}), "auth_helper.py")
                   and pathlib.Path(args.caddy_fragment).exists())
        if healthy:
            try:
                node = select_node(inventory, state["node"])
                healthy = node_command(node, pathlib.Path(args.live_root), ["status"], timeout=20).returncode == 0
            except (ControllerError, OSError, subprocess.TimeoutExpired, KeyError):
                healthy = False
        if not healthy:
            return
        time.sleep(min(5, max(1, args.deadline - now)))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("--inventory", required=True)
    result.add_argument("--live-root", default=str(DEFAULT_LIVE_ROOT))
    result.add_argument("--runtime-root", default=str(DEFAULT_RUNTIME_ROOT))
    result.add_argument("--state-root", default=str(DEFAULT_STATE_ROOT))
    result.add_argument("--caddy-config", default=str(DEFAULT_CADDY_CONFIG))
    result.add_argument("--caddy-import", default=DEFAULT_CADDY_IMPORT)
    result.add_argument("--caddy-fragment", default=str(DEFAULT_CADDY_FRAGMENT))
    result.add_argument("--landing-root", default=str(DEFAULT_LANDING_ROOT))
    result.add_argument("--proxy-group", default="caddy")
    sub = result.add_subparsers(dest="command", required=True)
    prepare_parser = sub.add_parser("prepare")
    prepare_parser.add_argument("--username")
    enable_parser = sub.add_parser("enable")
    enable_parser.add_argument("node")
    enable_parser.add_argument("--lease", type=int, default=1800)
    enable_parser.add_argument("--pane")
    sub.add_parser("status")
    sub.add_parser("disable")
    expiry = sub.add_parser("_expire")
    expiry.add_argument("--activation-id", required=True)
    expiry.add_argument("--deadline", type=int, required=True)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        inventory = load_inventory(pathlib.Path(args.inventory))
        lock_root = pathlib.Path(args.state_root)
        lock_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        lock_path = lock_root / "controller.lock"
        if args.command == "_expire":
            wait_for_expiry_or_failure(args, inventory)
        with lock_path.open("a+", encoding="utf-8") as lock:
            os.chmod(lock_path, 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            if args.command == "prepare":
                prepare(args, inventory)
            elif args.command == "enable":
                enable(args, inventory)
            elif args.command == "status":
                status(args, inventory)
            elif args.command == "disable":
                disable(args, inventory)
            elif args.command == "_expire":
                expire(args, inventory)
        return 0
    except (ControllerError, OSError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"herdr-ttyd-controller: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
