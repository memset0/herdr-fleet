#!/usr/bin/env python3
"""Validate terminal inventory and expose bounded status/disable recovery commands."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import socket
import subprocess
from typing import Any

import protocol
import stdio_broker

NODE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
HOSTNAME = re.compile(
    r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
)
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


def validate_endpoint(raw: Any, label: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ControllerError(f"{label} must be an object")
    required = {"host", "user", "port", "identity", "known_hosts"}
    missing = sorted(required - raw.keys())
    extra = sorted(raw.keys() - required)
    if missing:
        raise ControllerError(f"{label} is missing: {', '.join(missing)}")
    if extra:
        raise ControllerError(f"{label} contains unknown fields: {', '.join(extra)}")
    host = nonempty(raw["host"], f"{label}.host").lower().rstrip(".")
    if not HOSTNAME.fullmatch(host):
        raise ControllerError(f"{label}.host is invalid")
    user = nonempty(raw["user"], f"{label}.user")
    if not USER.fullmatch(user):
        raise ControllerError(f"{label}.user is invalid")
    return {
        "host": host,
        "user": user,
        "port": port(raw["port"], f"{label}.port"),
        "identity": relative_live_path(raw["identity"], f"{label}.identity"),
        "known_hosts": relative_live_path(raw["known_hosts"], f"{label}.known_hosts"),
    }


def validate_binary(raw: Any, label: str, platform: str) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("source") not in {"release_asset", "local_path"}:
        raise ControllerError(f"{label}.source must be release_asset or local_path")
    if raw["source"] == "release_asset":
        if set(raw) != {"source"}:
            raise ControllerError(f"{label} release_asset contains unknown fields")
        if platform != "linux":
            raise ControllerError(f"{label} release_asset is supported only on Linux")
        return raw
    if set(raw) != {"source", "path", "sha256", "version_output"}:
        raise ControllerError(f"{label} local_path has an invalid shape")
    absolute_path(raw["path"], f"{label}.path")
    digest = nonempty(raw["sha256"], f"{label}.sha256")
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ControllerError(f"{label}.sha256 is invalid")
    output = nonempty(raw["version_output"], f"{label}.version_output")
    if not output.startswith("ttyd version ") or "\n" in output:
        raise ControllerError(f"{label}.version_output is invalid")
    return raw


def validate_node(node_id: str, raw: Any) -> dict[str, Any]:
    label = f"nodes.{node_id}"
    if not NODE_ID.fullmatch(node_id):
        raise ControllerError(f"{label} has an invalid node id")
    if not isinstance(raw, dict):
        raise ControllerError(f"{label} must be an object")
    required = {
        "platform", "architecture", "owner", "herdr_owner", "python", "herdr", "session",
        "server_socket", "runtime_dir", "install_root", "binary", "transport",
    }
    allowed = required | {"host_exact", "host_prefix", "reject_slurm", "environment"}
    missing = sorted(required - raw.keys())
    extra = sorted(raw.keys() - allowed)
    if missing:
        raise ControllerError(f"{label} is missing: {', '.join(missing)}")
    if extra:
        raise ControllerError(f"{label} contains unknown fields: {', '.join(extra)}")
    if raw["platform"] not in {"linux", "darwin"}:
        raise ControllerError(f"{label}.platform is unsupported")
    if raw["architecture"] not in {"x86_64", "aarch64"}:
        raise ControllerError(f"{label}.architecture is unsupported")
    for key in ("owner", "herdr_owner"):
        if not USER.fullmatch(nonempty(raw[key], f"{label}.{key}")):
            raise ControllerError(f"{label}.{key} is invalid")
    for key in ("python", "herdr", "server_socket", "runtime_dir", "install_root"):
        absolute_path(raw[key], f"{label}.{key}")
    if raw["session"] is not None:
        session = nonempty(raw["session"], f"{label}.session")
        if not protocol.SESSION.fullmatch(session):
            raise ControllerError(f"{label}.session is invalid")
    for key in ("host_exact", "host_prefix"):
        if key in raw:
            nonempty(raw[key], f"{label}.{key}")
    if "reject_slurm" in raw and not isinstance(raw["reject_slurm"], bool):
        raise ControllerError(f"{label}.reject_slurm must be boolean")
    if "environment" in raw:
        if not isinstance(raw["environment"], dict):
            raise ControllerError(f"{label}.environment must be an object")
        for key, value in raw["environment"].items():
            if not isinstance(key, str) or not key or not isinstance(value, str) or "\0" in key + value:
                raise ControllerError(f"{label}.environment contains an invalid entry")
    validate_binary(raw["binary"], f"{label}.binary", raw["platform"])
    transport = raw["transport"]
    if not isinstance(transport, dict) or transport.get("kind") not in {"local", "ssh"}:
        raise ControllerError(f"{label}.transport.kind must be local or ssh")
    if transport["kind"] == "local":
        if set(transport) != {"kind"}:
            raise ControllerError(f"{label}.transport contains unknown fields")
    else:
        allowed_transport = {"kind", "host", "user", "port", "identity", "known_hosts", "jump"}
        extra_transport = sorted(transport.keys() - allowed_transport)
        missing_transport = sorted({"host", "user", "port", "identity", "known_hosts"} - transport.keys())
        if missing_transport:
            raise ControllerError(f"{label}.transport is missing: {', '.join(missing_transport)}")
        if extra_transport:
            raise ControllerError(
                f"{label}.transport contains unknown fields: {', '.join(extra_transport)}"
            )
        validate_endpoint({key: transport[key] for key in (
            "host", "user", "port", "identity", "known_hosts",
        )}, f"{label}.transport")
        if transport.get("jump") is not None:
            validate_endpoint(transport["jump"], f"{label}.transport.jump")
    result = dict(raw)
    result["id"] = node_id
    return result


def load_inventory(path: pathlib.Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if set(data) != {"schema", "nodes"} or data.get("schema") != 3 or not isinstance(data.get("nodes"), dict):
        raise ControllerError("unsupported inventory schema")
    if not data["nodes"]:
        raise ControllerError("inventory must contain at least one node")
    normalized = {
        node_id: validate_node(node_id, raw)
        for node_id, raw in data["nodes"].items()
    }
    return {"schema": 3, "nodes": normalized}


def select_node(inventory: dict[str, Any], node_id: str) -> dict[str, Any]:
    node = inventory["nodes"].get(node_id)
    if not node:
        raise ControllerError(f"unknown node: {node_id}")
    return dict(node)


def unix_exchange(path: pathlib.Path, request: bytes) -> bytes:
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(20)
    try:
        client.connect(str(path))
        client.sendall(request)
        response = b""
        while not response.endswith(b"\n") and len(response) <= protocol.MAX_LINE_BYTES:
            block = client.recv(4096)
            if not block:
                break
            response += block
        return response
    finally:
        client.close()


def control_node(node: dict[str, Any], live_root: pathlib.Path, action: str) -> dict[str, Any]:
    request_id = os.urandom(16).hex()
    request = protocol.encode_request("node-control", request_id, node["id"], action, {})
    if node["transport"]["kind"] == "local":
        response = unix_exchange(
            protocol.socket_path(pathlib.Path(node["runtime_dir"]), "node-control", node["id"]),
            request,
        )
    else:
        result = subprocess.run(
            stdio_broker.ssh_command(node["transport"], live_root), input=request,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20, check=False,
        )
        if result.returncode != 0:
            raise ControllerError(f"node transport unavailable: {node['id']}")
        response = result.stdout
    try:
        return protocol.decode_response(response, request_id)
    except protocol.ProtocolError as exc:
        raise ControllerError(f"node control rejected {action}: {node['id']}: {exc}") from exc


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("--inventory", required=True)
    result.add_argument("--live-root", required=True)
    sub = result.add_subparsers(dest="command", required=True)
    sub.add_parser("validate")
    for command in ("status", "disable"):
        child = sub.add_parser(command)
        child.add_argument("node", nargs="?")
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        inventory = load_inventory(pathlib.Path(args.inventory))
        live_root = pathlib.Path(args.live_root)
        if not live_root.is_absolute():
            raise ControllerError("live root must be absolute")
        if args.command == "validate":
            print(json.dumps({"valid": True, "schema": 3,
                              "nodes": sorted(inventory["nodes"])}, sort_keys=True))
            return 0
        node_ids = [args.node] if args.node else sorted(inventory["nodes"])
        results = {
            node_id: control_node(select_node(inventory, node_id), live_root, args.command)
            for node_id in node_ids
        }
        print(json.dumps({"operation": args.command, "nodes": results}, sort_keys=True))
        return 0
    except (ControllerError, OSError, subprocess.TimeoutExpired, json.JSONDecodeError,
            ValueError, KeyError) as exc:
        print(f"herdr-terminal-control: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
