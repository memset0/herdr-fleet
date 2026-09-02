#!/usr/bin/env python3
"""Strict private control protocol shared by terminal nodes and central ingress."""

from __future__ import annotations

import collections
import json
import pathlib
import re
from typing import Any

SCHEMA = 1
LEASE_SECONDS = 1800
MAX_LINE_BYTES = 16 * 1024
MAX_REPLAY_IDS = 512

CHANNEL_ACTIONS = {
    "node-control": frozenset({"ready", "activate", "heartbeat", "status", "disable"}),
    "central-ingress": frozenset({"ready", "status", "disable"}),
}

NODE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
REQUEST_ID = re.compile(r"^[0-9a-f]{32}$")
ACTIVATION_ID = re.compile(r"^[0-9a-f]{24,64}$")
PANE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$")
SESSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ProtocolError(RuntimeError):
    """A bounded protocol validation failure safe to return to a private peer."""


def _exact_object(value: Any, fields: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(f"{label} must be an object")
    extra = sorted(set(value) - fields)
    missing = sorted(fields - set(value))
    if missing:
        raise ProtocolError(f"{label} is missing: {', '.join(missing)}")
    if extra:
        raise ProtocolError(f"{label} contains unknown fields: {', '.join(extra)}")
    return value


def _optional_identifier(value: Any, pattern: re.Pattern[str], label: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise ProtocolError(f"{label} is invalid")
    return value


def _validate_payload(channel: str, action: str, payload: Any) -> dict[str, Any]:
    if action in {"ready", "status", "disable"}:
        return _exact_object(payload, set(), "payload")
    if channel != "node-control":
        raise ProtocolError("action is unavailable on this channel")
    if action == "activate":
        result = _exact_object(
            payload,
            {"activation_id", "pane_id", "session", "lease_seconds"},
            "payload",
        )
        if _optional_identifier(result["activation_id"], ACTIVATION_ID,
                                "payload.activation_id") is None:
            raise ProtocolError("payload.activation_id is invalid")
        _optional_identifier(result["pane_id"], PANE_ID, "payload.pane_id")
        _optional_identifier(result["session"], SESSION, "payload.session")
        lease = result["lease_seconds"]
        if not isinstance(lease, int) or isinstance(lease, bool) or lease != LEASE_SECONDS:
            raise ProtocolError(f"payload.lease_seconds must be {LEASE_SECONDS}")
        return result
    if action == "heartbeat":
        result = _exact_object(payload, {"activation_id"}, "payload")
        if _optional_identifier(result["activation_id"], ACTIVATION_ID,
                                "payload.activation_id") is None:
            raise ProtocolError("payload.activation_id is invalid")
        return result
    raise ProtocolError("unsupported action")


def decode_request(
    raw: bytes | str,
    *,
    expected_channel: str | None = None,
    expected_node: str | None = None,
) -> dict[str, Any]:
    """Decode one newline-delimited request and reject ambiguity before dispatch."""
    encoded = raw.encode() if isinstance(raw, str) else raw
    if not encoded or len(encoded) > MAX_LINE_BYTES or b"\n" in encoded.rstrip(b"\n"):
        raise ProtocolError("request must be one bounded line")
    try:
        value = json.loads(encoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProtocolError("request is not valid JSON") from exc
    request = _exact_object(
        value,
        {"schema", "channel", "request_id", "node_id", "action", "payload"},
        "request",
    )
    if request["schema"] != SCHEMA:
        raise ProtocolError("unsupported protocol schema")
    channel = request["channel"]
    if channel not in CHANNEL_ACTIONS:
        raise ProtocolError("unsupported protocol channel")
    if expected_channel is not None and channel != expected_channel:
        raise ProtocolError("request reached the wrong protocol channel")
    if not isinstance(request["request_id"], str) or not REQUEST_ID.fullmatch(request["request_id"]):
        raise ProtocolError("request.request_id is invalid")
    node_id = request["node_id"]
    if not isinstance(node_id, str) or not NODE_ID.fullmatch(node_id):
        raise ProtocolError("request.node_id is invalid")
    if expected_node is not None and node_id != expected_node:
        raise ProtocolError("request targets a different node")
    action = request["action"]
    if not isinstance(action, str) or action not in CHANNEL_ACTIONS[channel]:
        raise ProtocolError("unsupported protocol action")
    request["payload"] = _validate_payload(channel, action, request["payload"])
    return request


def encode_request(channel: str, request_id: str, node_id: str, action: str,
                   payload: dict[str, Any]) -> bytes:
    request = decode_request(json.dumps({
        "schema": SCHEMA,
        "channel": channel,
        "request_id": request_id,
        "node_id": node_id,
        "action": action,
        "payload": payload,
    }, separators=(",", ":")))
    return (json.dumps(request, separators=(",", ":"), sort_keys=True) + "\n").encode()


def encode_response(request_id: str, *, result: dict[str, Any] | None = None,
                    error: str | None = None) -> bytes:
    if not REQUEST_ID.fullmatch(request_id):
        raise ProtocolError("response request id is invalid")
    if (result is None) == (error is None):
        raise ProtocolError("response must contain exactly one result or error")
    value: dict[str, Any] = {"schema": SCHEMA, "request_id": request_id, "ok": error is None}
    if error is None:
        if not isinstance(result, dict):
            raise ProtocolError("response result must be an object")
        value["result"] = result
    else:
        if not isinstance(error, str) or not error or len(error) > 240 or any(ord(char) < 32 for char in error):
            raise ProtocolError("response error is invalid")
        value["error"] = error
    return (json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n").encode()


def decode_response(raw: bytes | str, request_id: str) -> dict[str, Any]:
    encoded = raw.encode() if isinstance(raw, str) else raw
    if not encoded or len(encoded) > MAX_LINE_BYTES or b"\n" in encoded.rstrip(b"\n"):
        raise ProtocolError("response must be one bounded line")
    try:
        value = json.loads(encoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProtocolError("response is not valid JSON") from exc
    if not isinstance(value, dict) or not isinstance(value.get("ok"), bool):
        raise ProtocolError("response must be an object with boolean ok")
    expected = {"schema", "request_id", "ok", "result" if value["ok"] else "error"}
    response = _exact_object(value, expected, "response")
    if response["schema"] != SCHEMA or response["request_id"] != request_id:
        raise ProtocolError("response does not match the request")
    if response["ok"]:
        if not isinstance(response["result"], dict):
            raise ProtocolError("response result must be an object")
        return response["result"]
    error = response["error"]
    if not isinstance(error, str) or not error or len(error) > 240:
        raise ProtocolError("response error is invalid")
    raise ProtocolError(error)


class ReplayWindow:
    """Bounded in-memory request-id window; restart ends all active state."""

    def __init__(self, limit: int = MAX_REPLAY_IDS) -> None:
        if limit < 1 or limit > MAX_REPLAY_IDS:
            raise ValueError("replay window limit is invalid")
        self._limit = limit
        self._ids: collections.OrderedDict[str, None] = collections.OrderedDict()

    def accept(self, request_id: str) -> None:
        if not REQUEST_ID.fullmatch(request_id):
            raise ProtocolError("request.request_id is invalid")
        if request_id in self._ids:
            raise ProtocolError("request id was already used")
        self._ids[request_id] = None
        while len(self._ids) > self._limit:
            self._ids.popitem(last=False)


def socket_path(runtime_root: pathlib.Path, role: str, node_id: str | None = None) -> pathlib.Path:
    """Return one contained, portable Unix-socket address for a supervisor-owned role."""
    if not runtime_root.is_absolute():
        raise ProtocolError("runtime root must be absolute")
    if role == "node-control":
        if not isinstance(node_id, str) or not NODE_ID.fullmatch(node_id):
            raise ProtocolError("node-control socket requires a valid node id")
        name = f"terminal-node-{node_id}.sock"
    elif role == "central-ingress":
        if node_id is not None:
            raise ProtocolError("central-ingress socket does not accept a node id")
        name = "terminal-ingress.sock"
    else:
        raise ProtocolError("unsupported socket role")
    result = runtime_root / name
    if len(str(result).encode(errors="surrogateescape")) >= 104:
        raise ProtocolError("Unix socket path is too long")
    return result
