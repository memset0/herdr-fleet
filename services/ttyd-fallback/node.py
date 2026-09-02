#!/usr/bin/env python3
"""Closed-by-default node endpoint for Web Remote's ttyd companion."""

from __future__ import annotations

import argparse
import fcntl
import grp
import json
import os
import pathlib
import pwd
import shutil
import signal
import socket
import socketserver
import stat
import subprocess
import sys
import threading
import time
from typing import Any

import platform_support
import protocol

STATE_NAME = "lease.json"
SOCKET_NAME = "ttyd.sock"


class FallbackError(RuntimeError):
    pass


def load_config(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        cfg = json.load(handle)
    required = {"id", "owner", "herdr_owner", "platform", "architecture", "herdr",
                "server_socket", "runtime_dir", "ttyd", "ttyd_sha256",
                "ttyd_version_output"}
    missing = sorted(required - cfg.keys())
    if missing:
        raise FallbackError("missing config fields: " + ", ".join(missing))
    if cfg.get("session", "__missing__") == "__missing__":
        raise FallbackError("session must be explicit, including null for default")
    for key in ("herdr", "server_socket", "runtime_dir", "ttyd"):
        if not isinstance(cfg.get(key), str) or not pathlib.Path(cfg[key]).is_absolute():
            raise FallbackError(f"{key} must be an absolute path")
    if not isinstance(cfg.get("ttyd_version_output"), str) or not cfg["ttyd_version_output"].startswith("ttyd version "):
        raise FallbackError("ttyd_version_output is invalid")
    if (not isinstance(cfg.get("ttyd_sha256"), str) or len(cfg["ttyd_sha256"]) != 64
            or any(char not in "0123456789abcdef" for char in cfg["ttyd_sha256"])):
        raise FallbackError("ttyd_sha256 is invalid")
    if cfg.get("platform") not in {"linux", "darwin"}:
        raise FallbackError("platform is invalid")
    if cfg.get("architecture") not in {"x86_64", "aarch64"}:
        raise FallbackError("architecture is invalid")
    if not isinstance(cfg.get("environment", {}), dict):
        raise FallbackError("environment must be an object")
    return cfg


def drop_to_owner(cfg: dict[str, Any]) -> None:
    """Let a root-owned supervisor start the declared unprivileged client role."""
    desired = pwd.getpwnam(cfg["owner"])
    current_uid = os.geteuid()
    if current_uid == desired.pw_uid:
        return
    if current_uid != 0:
        raise FallbackError("node endpoint cannot change to the declared owner")
    try:
        os.initgroups(cfg["owner"], desired.pw_gid)
        os.setgid(desired.pw_gid)
        os.setuid(desired.pw_uid)
    except OSError as exc:
        raise FallbackError("node endpoint could not drop to the declared owner") from exc


def runtime_paths(cfg: dict[str, Any]) -> tuple[pathlib.Path, pathlib.Path, pathlib.Path]:
    root = pathlib.Path(cfg["runtime_dir"])
    return root, root / STATE_NAME, root / SOCKET_NAME


def process_start(pid: int) -> str | None:
    identity = platform_support.process_identity(pid)
    return identity[0] if identity else None


def process_matches(pid: int, start: str, activation: str) -> bool:
    return platform_support.process_matches(pid, start, ("node.py", "_run_lease", activation))


def gate(cfg: dict[str, Any]) -> None:
    if pwd.getpwuid(os.geteuid()).pw_name != cfg["owner"]:
        raise FallbackError(f"owner gate rejected; expected {cfg['owner']}")
    host = socket.gethostname().split(".")[0]
    if cfg.get("host_exact") and host != cfg["host_exact"]:
        raise FallbackError(f"host gate rejected: {host}")
    if cfg.get("host_prefix") and not host.startswith(cfg["host_prefix"]):
        raise FallbackError(f"host gate rejected: {host}")
    if cfg.get("reject_slurm") and os.environ.get("SLURM_JOB_ID"):
        raise FallbackError("scheduler-job gate rejected")


def herdr_env(cfg: dict[str, Any]) -> dict[str, str]:
    env = os.environ.copy()
    for key, value in cfg.get("environment", {}).items():
        env[str(key)] = str(value)
    return env


def herdr_json(cfg: dict[str, Any], args: list[str]) -> dict[str, Any]:
    command = [cfg["herdr"], *args]
    try:
        result = subprocess.run(command, env=herdr_env(cfg), stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise FallbackError(f"Herdr probe unavailable: {type(exc).__name__}") from exc
    if result.returncode != 0:
        raise FallbackError(f"Herdr probe failed with status {result.returncode}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise FallbackError("Herdr probe returned invalid JSON") from exc


def inspect_server(cfg: dict[str, Any], pane_id: str | None) -> tuple[str, str]:
    gate(cfg)
    socket_path = pathlib.Path(cfg["server_socket"])
    try:
        socket_metadata = socket_path.stat()
        expected_uid = pwd.getpwnam(cfg["herdr_owner"]).pw_uid
    except (OSError, KeyError) as exc:
        raise FallbackError("documented Herdr socket identity is unavailable") from exc
    if not stat.S_ISSOCK(socket_metadata.st_mode) or socket_metadata.st_uid != expected_uid:
        raise FallbackError("documented Herdr socket owner or type mismatch")
    status_data = herdr_json(cfg, ["status", "server", "--json"])
    if status_data.get("running") is not True or status_data.get("compatible") is not True:
        raise FallbackError("documented Herdr server is not running and compatible")
    if status_data.get("socket") != cfg["server_socket"]:
        raise FallbackError("Herdr socket namespace mismatch")
    if status_data.get("session") != cfg["session"]:
        raise FallbackError("Herdr named-session namespace mismatch")
    snapshot_result = herdr_json(cfg, ["api", "snapshot"])
    snapshot = snapshot_result.get("result", {}).get("snapshot", {})
    selected = pane_id or snapshot.get("focused_pane_id")
    if not isinstance(selected, str) or not selected:
        raise FallbackError("no selected or focused Pane is available")
    matches = [item for item in snapshot.get("panes", []) if item.get("pane_id") == selected]
    if len(matches) != 1 or not isinstance(matches[0].get("terminal_id"), str):
        raise FallbackError("selected Pane does not resolve to one terminal")
    terminal_id = matches[0]["terminal_id"]
    if not terminal_id.startswith("term_") or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_" for ch in terminal_id):
        raise FallbackError("resolved terminal id is malformed")
    return selected, terminal_id


def ensure_runtime(cfg: dict[str, Any]) -> tuple[pathlib.Path, pathlib.Path, pathlib.Path]:
    root, state_path, socket_path = runtime_paths(cfg)
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    if root.stat().st_uid != os.geteuid():
        raise FallbackError("runtime directory is not owner-owned")
    return root, state_path, socket_path


def read_state(path: pathlib.Path) -> dict[str, Any] | None:
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError):
        return {"invalid": True}


def write_state(path: pathlib.Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(".new")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)


def unlink_if_present(path: pathlib.Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def state_live(state: dict[str, Any] | None) -> bool:
    if not state or state.get("invalid"):
        return False
    return process_matches(int(state.get("runner_pid", -1)), str(state.get("runner_start", "")),
                           str(state.get("activation_id", "")))


def stop_locked(cfg: dict[str, Any], state_path: pathlib.Path, socket_path: pathlib.Path) -> bool:
    state = read_state(state_path)
    was_live = state_live(state)
    if was_live and state:
        pid = int(state["runner_pid"])
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        for _ in range(30):
            if not process_matches(pid, str(state["runner_start"]), str(state["activation_id"])):
                break
            time.sleep(0.1)
        if process_matches(pid, str(state["runner_start"]), str(state["activation_id"])):
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    unlink_if_present(socket_path)
    unlink_if_present(state_path)
    return was_live


def reconcile_node(cfg: dict[str, Any]) -> bool:
    """Converge one node to dormant without trusting a recycled PID."""
    root, state_path, socket_path = ensure_runtime(cfg)
    lock_path = root / "control.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        return stop_locked(cfg, state_path, socket_path)


def preflight(cfg: dict[str, Any], pane_id: str | None) -> dict[str, Any]:
    pane, _terminal = inspect_server(cfg, pane_id)
    ttyd = pathlib.Path(cfg["ttyd"])
    if not ttyd.is_file() or not os.access(ttyd, os.X_OK):
        raise FallbackError("verified ttyd binary is unavailable")
    if platform_support.sha256_file(ttyd) != cfg["ttyd_sha256"]:
        raise FallbackError("ttyd digest does not match the audited pin")
    output = subprocess.run([str(ttyd), "--version"], stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, check=False).stdout
    if cfg["ttyd_version_output"] != output.strip():
        raise FallbackError("ttyd version does not match the audited pin")
    return {"node": cfg["id"], "healthy": True, "pane_id": pane}


def start_activation(cfg: dict[str, Any], config_path: str, activation_id: str,
                     lease: int, pane_id: str | None) -> dict[str, Any]:
    lease = int(lease)
    if lease != protocol.LEASE_SECONDS:
        raise FallbackError(f"lease must be exactly {protocol.LEASE_SECONDS} seconds")
    if not activation_id or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for ch in activation_id):
        raise FallbackError("invalid activation id")
    pane, terminal = inspect_server(cfg, pane_id)
    preflight(cfg, pane)
    root, state_path, socket_path = ensure_runtime(cfg)
    lock_path = root / "control.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = read_state(state_path)
        if state_live(state):
            raise FallbackError("a node fallback lease is already active")
        stop_locked(cfg, state_path, socket_path)
        deadline = int(time.time()) + lease
        state_data = {"schema": 1, "node": cfg["id"], "activation_id": activation_id,
                      "pane_id": pane, "deadline": deadline, "status": "launching"}
        write_state(state_path, state_data)
        command = [sys.executable, str(pathlib.Path(__file__).resolve()), "--config", config_path,
                   "_run_lease", "--activation-id", activation_id,
                   "--deadline", str(deadline), "--terminal-id", terminal, "--pane-id", pane]
        log_path = root / "lease.log"
        log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        runner: subprocess.Popen[bytes] | None = None
        ready = False
        try:
            runner = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log_fd,
                                      stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
            start = None
            for _ in range(20):
                start = process_start(runner.pid)
                if start:
                    break
                time.sleep(0.01)
            if not start:
                raise FallbackError("lease runner did not start")
            state_data.update({"runner_pid": runner.pid, "runner_start": start, "status": "starting"})
            write_state(state_path, state_data)
            for _ in range(100):
                state_data = read_state(state_path) or {}
                if state_data.get("status") == "listening" and socket_path.exists():
                    ready = True
                    threading.Thread(target=runner.wait, name="terminal-lease-reaper",
                                     daemon=True).start()
                    return {"node": cfg["id"], "active": True, "pane_id": pane,
                            "activation_id": activation_id, "deadline": deadline,
                            "data_socket": str(socket_path)}
                if not process_matches(runner.pid, start, activation_id):
                    break
                time.sleep(0.05)
            raise FallbackError("ttyd endpoint failed to become ready")
        finally:
            os.close(log_fd)
            if not ready:
                if runner is not None and runner.poll() is None:
                    runner.terminate()
                    try:
                        runner.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        runner.kill()
                        runner.wait()
                unlink_if_present(socket_path)
                unlink_if_present(state_path)


def run_lease(args: argparse.Namespace, cfg: dict[str, Any]) -> None:
    gate(cfg)
    root, state_path, socket_path = ensure_runtime(cfg)
    remaining = int(args.deadline) - int(time.time())
    if remaining <= 0 or remaining > protocol.LEASE_SECONDS:
        raise FallbackError("lease deadline is invalid")
    state = None
    for _ in range(100):
        state = read_state(state_path)
        if state and state.get("activation_id") == args.activation_id and state.get("runner_pid") == os.getpid():
            break
        time.sleep(0.01)
    else:
        raise FallbackError("lease state does not match runner")
    unlink_if_present(socket_path)
    owner_entry = pwd.getpwnam(cfg["owner"])
    socket_owner = f"{cfg['owner']}:{grp.getgrgid(owner_entry.pw_gid).gr_name}"
    ttyd_cmd = [cfg["ttyd"], "--interface", str(socket_path), "--socket-owner", socket_owner,
                "--auth-header", "X-Herdr-Fallback-User", "--writable", "--check-origin",
                "--max-clients", "1", "--base-path", "/terminal", "--debug", "2",
                cfg["herdr"], "terminal", "attach", args.terminal_id]
    child = subprocess.Popen(ttyd_cmd, env=herdr_env(cfg), stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if child.poll() is not None:
                raise FallbackError("ttyd exited before listening")
            if socket_path.exists() and stat.S_ISSOCK(socket_path.stat().st_mode):
                os.chmod(socket_path, 0o600)
                break
            time.sleep(0.05)
        else:
            raise FallbackError("ttyd socket did not appear")
        state.update({"status": "listening", "ttyd_pid": child.pid})
        write_state(state_path, state)
        while child.poll() is None:
            current = read_state(state_path)
            if (not current or current.get("activation_id") != args.activation_id
                    or int(current.get("deadline", 0)) <= int(time.time())):
                break
            try:
                child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                continue
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=3)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
    finally:
        if child.poll() is None:
            child.terminate()
        unlink_if_present(socket_path)
        current = read_state(state_path)
        if current and current.get("activation_id") == args.activation_id:
            unlink_if_present(state_path)


def control_status(cfg: dict[str, Any]) -> dict[str, Any]:
    gate(cfg)
    _root, state_path, socket_path = runtime_paths(cfg)
    state = read_state(state_path)
    active = bool(
        state_live(state)
        and socket_path.exists()
        and stat.S_ISSOCK(socket_path.stat().st_mode)
        and isinstance(state, dict)
        and int(state.get("deadline", 0)) > int(time.time())
    )
    result: dict[str, Any] = {"node": cfg["id"], "control": True, "active": active}
    if state and not state.get("invalid"):
        result.update({key: state[key] for key in (
            "activation_id", "pane_id", "deadline", "status",
        ) if key in state})
    return result


def heartbeat_activation(cfg: dict[str, Any], activation_id: str) -> dict[str, Any]:
    gate(cfg)
    root, state_path, socket_path = ensure_runtime(cfg)
    with (root / "control.lock").open("a+", encoding="utf-8") as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = read_state(state_path)
        if (not state_live(state) or not state or state.get("activation_id") != activation_id
                or not socket_path.exists() or not stat.S_ISSOCK(socket_path.stat().st_mode)):
            raise FallbackError("activation is not active")
        deadline = int(time.time()) + protocol.LEASE_SECONDS
        state["deadline"] = deadline
        state["status"] = "listening"
        write_state(state_path, state)
    return {"node": cfg["id"], "active": True, "activation_id": activation_id,
            "deadline": deadline}


class NodeControlServer(socketserver.UnixStreamServer):
    allow_reuse_address = False

    def __init__(self, path: str, cfg: dict[str, Any], config_path: str):
        self.cfg = cfg
        self.config_path = config_path
        self.replay = protocol.ReplayWindow()
        super().__init__(path, NodeControlHandler)


class NodeControlHandler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        request_id = "0" * 32
        try:
            raw = self.rfile.readline(protocol.MAX_LINE_BYTES + 1)
            if len(raw) > protocol.MAX_LINE_BYTES:
                raise protocol.ProtocolError("request must be one bounded line")
            server = self.server
            if not isinstance(server, NodeControlServer):
                raise protocol.ProtocolError("invalid node control server")
            request = protocol.decode_request(
                raw,
                expected_channel="node-control",
                expected_node=server.cfg["id"],
            )
            request_id = request["request_id"]
            server.replay.accept(request_id)
            action = request["action"]
            if action == "ready":
                result = {**control_status(server.cfg), **preflight(server.cfg, None)}
            elif action == "status":
                result = control_status(server.cfg)
            elif action == "activate":
                payload = request["payload"]
                if payload["session"] != server.cfg["session"]:
                    raise FallbackError("requested Herdr session does not match node configuration")
                result = start_activation(
                    server.cfg,
                    server.config_path,
                    payload["activation_id"],
                    payload["lease_seconds"],
                    payload["pane_id"],
                )
            elif action == "disable":
                root, state_path, socket_path = ensure_runtime(server.cfg)
                with (root / "control.lock").open("a+", encoding="utf-8") as lock:
                    os.chmod(lock.name, 0o600)
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    stopped = stop_locked(server.cfg, state_path, socket_path)
                result = {"node": server.cfg["id"], "control": True,
                          "active": False, "stopped": stopped}
            elif action == "heartbeat":
                result = heartbeat_activation(
                    server.cfg, request["payload"]["activation_id"],
                )
            else:
                raise protocol.ProtocolError("unsupported node control action")
            self.wfile.write(protocol.encode_response(request_id, result=result))
        except (FallbackError, OSError, protocol.ProtocolError, ValueError) as exc:
            message = str(exc)[:240] or "node control rejected the request"
            try:
                self.wfile.write(protocol.encode_response(request_id, error=message))
            except protocol.ProtocolError:
                return


def serve_control(args: argparse.Namespace, cfg: dict[str, Any]) -> None:
    gate(cfg)
    reconcile_node(cfg)
    runtime_root = pathlib.Path(cfg["runtime_dir"])
    runtime_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(runtime_root, 0o700)
    control_socket = protocol.socket_path(runtime_root, "node-control", cfg["id"])
    unlink_if_present(control_socket)
    stop_requested = False

    def request_stop(_signum: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True

    previous_term = signal.signal(signal.SIGTERM, request_stop)
    previous_int = signal.signal(signal.SIGINT, request_stop)
    server = NodeControlServer(str(control_socket), cfg, args.config)
    server.timeout = 0.25
    os.chmod(control_socket, 0o600)
    try:
        while not stop_requested:
            server.handle_request()
    finally:
        server.server_close()
        unlink_if_present(control_socket)
        signal.signal(signal.SIGTERM, previous_term)
        signal.signal(signal.SIGINT, previous_int)
        reconcile_node(cfg)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("serve")
    runner = sub.add_parser("_run_lease")
    runner.add_argument("--activation-id", required=True)
    runner.add_argument("--deadline", required=True, type=int)
    runner.add_argument("--terminal-id", required=True)
    runner.add_argument("--pane-id", required=True)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        cfg = load_config(args.config)
        drop_to_owner(cfg)
        if args.command == "serve":
            serve_control(args, cfg)
        elif args.command == "_run_lease":
            run_lease(args, cfg)
        return 0
    except FallbackError as exc:
        print(f"herdr-ttyd-node: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
