#!/usr/bin/env python3
"""Permanent authenticated ingress for Web Remote's normally dormant terminal."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import http.server
import json
import math
import os
import pathlib
import re
import secrets
import selectors
import signal
import socket
import socketserver
import subprocess
import threading
import time
import urllib.parse
from typing import Any, Callable

import controller
import protocol
import stdio_broker

BASE64URL = re.compile(r"^[A-Za-z0-9_-]+$")
COOKIE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
USERNAME = re.compile(r"^[A-Za-z0-9_.-]{3,64}$")
MAX_SAFE_INTEGER = 9_007_199_254_740_991
LEASE_SECONDS = 1800
FEATURE_DIR = pathlib.Path(__file__).resolve().parent


class IngressError(RuntimeError):
    status = 503


class BadRequest(IngressError):
    status = 400


class Unauthorized(IngressError):
    status = 401


class Forbidden(IngressError):
    status = 403


class NotFound(IngressError):
    status = 404


class Conflict(IngressError):
    status = 409


def base64url_decode(value: str) -> bytes:
    if not value or not BASE64URL.fullmatch(value):
        raise ValueError("invalid base64url value")
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.b64decode(value + padding, altchars=b"-_", validate=True)


def base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def safe_integer(value: Any) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and math.isfinite(value)
        and int(value) == value
        and abs(value) <= MAX_SAFE_INTEGER
    )


def cookie_value(header: str, name: str) -> str | None:
    for part in header.split(";"):
        key, separator, value = part.partition("=")
        if separator and key.strip() == name:
            return value.strip()
    return None


class SessionAuth:
    """Validate the existing Gateway cookie without contacting Gateway or Collie."""

    def __init__(self, gateway_config: str) -> None:
        path = pathlib.Path(gateway_config)
        metadata = path.stat()
        if metadata.st_uid != os.geteuid() or metadata.st_mode & 0o077:
            raise ValueError("Gateway config must be owner-only")
        data = json.loads(path.read_text())
        public = data.get("public")
        auth = data.get("auth")
        if not isinstance(public, dict) or not isinstance(auth, dict):
            raise ValueError("Gateway config lacks public/auth sections")
        self.cookie_name = public.get("cookieName", "__Secure-herdr_web_session")
        scheme = public.get("scheme", "https")
        fleet_host = public.get("fleetHost")
        self.username = auth.get("username")
        secret_value = auth.get("sessionSecret")
        if not isinstance(self.cookie_name, str) or not COOKIE_NAME.fullmatch(self.cookie_name):
            raise ValueError("Gateway cookie name is invalid")
        if not isinstance(self.username, str) or not USERNAME.fullmatch(self.username):
            raise ValueError("Gateway username is invalid")
        if (scheme != "https" or not isinstance(fleet_host, str)
                or not controller.HOSTNAME.fullmatch(fleet_host)):
            raise ValueError("Gateway Fleet origin is invalid")
        raw_nodes = data.get("nodes")
        if not isinstance(raw_nodes, list):
            raise ValueError("Gateway nodes are invalid")
        enabled_ids: list[str] = []
        for index, raw_node in enumerate(raw_nodes):
            if not isinstance(raw_node, dict) or not isinstance(raw_node.get("id"), str):
                raise ValueError(f"Gateway node {index} is invalid")
            if raw_node.get("enabled", True) is True:
                if not protocol.NODE_ID.fullmatch(raw_node["id"]):
                    raise ValueError(f"Gateway node {index} id is invalid")
                enabled_ids.append(raw_node["id"])
        if not enabled_ids or len(enabled_ids) != len(set(enabled_ids)):
            raise ValueError("Gateway enabled node ids are invalid")
        self.node_ids = frozenset(enabled_ids)
        self.host = fleet_host
        self.origin = f"https://{fleet_host}"
        if not isinstance(secret_value, str):
            raise ValueError("Gateway session secret is invalid")
        self.secret = base64url_decode(secret_value)
        if len(self.secret) < 32:
            raise ValueError("Gateway session secret is too short")

    def verify_token(self, token: str, now_ms: int | None = None) -> bool:
        parts = token.split(".")
        if len(parts) != 2 or not all(parts):
            return False
        encoded, supplied_signature = parts
        if not BASE64URL.fullmatch(encoded) or not BASE64URL.fullmatch(supplied_signature):
            return False
        expected = base64url_encode(
            hmac.new(self.secret, encoded.encode("ascii"), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(supplied_signature.encode(), expected.encode()):
            return False
        try:
            payload = json.loads(base64url_decode(encoded))
        except (ValueError, UnicodeError, json.JSONDecodeError):
            return False
        if not isinstance(payload, dict):
            return False
        issued_at = payload.get("issuedAt")
        expires_at = payload.get("expiresAt")
        now = int(time.time() * 1000) if now_ms is None else now_ms
        return (
            payload.get("username") == self.username
            and safe_integer(issued_at)
            and safe_integer(expires_at)
            and issued_at <= now + 60_000
            and expires_at > now
        )

    def verify_cookie(self, header: str, now_ms: int | None = None) -> bool:
        token = cookie_value(header, self.cookie_name)
        return bool(token and self.verify_token(token, now_ms))


def protected_file(value: str, label: str) -> pathlib.Path:
    path = pathlib.Path(value)
    if not path.is_absolute() or not path.is_file():
        raise IngressError(f"{label} must be an existing absolute file")
    info = path.stat()
    if info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise IngressError(f"{label} must be owner-only")
    return path


def unix_exchange(path: pathlib.Path, request: bytes) -> bytes:
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(20)
    try:
        client.connect(str(path))
        client.sendall(request)
        response = b""
        while not response.endswith(b"\n") and len(response) <= protocol.MAX_LINE_BYTES:
            chunk = client.recv(4096)
            if not chunk:
                break
            response += chunk
        return response
    finally:
        client.close()


class IngressState:
    def __init__(self, inventory_path: pathlib.Path, gateway_config: pathlib.Path,
                 live_root: pathlib.Path,
                 sender: Callable[[dict[str, Any], bytes], bytes] | None = None) -> None:
        self.inventory = controller.load_inventory(inventory_path)
        self.auth = SessionAuth(str(gateway_config))
        self.nodes = {
            node_id: controller.select_node(self.inventory, node_id)
            for node_id in self.inventory["nodes"]
        }
        if frozenset(self.nodes) != self.auth.node_ids:
            raise IngressError("terminal node set must equal enabled Gateway node set")
        self.origin = self.auth.origin
        self.host = self.auth.host
        self.live_root = live_root
        self._sender = sender or self._send_control
        self.lock = threading.RLock()
        self.active: dict[str, Any] | None = None
        self.client_active = False

    def _send_control(self, node: dict[str, Any], request: bytes) -> bytes:
        if node["transport"]["kind"] == "local":
            path = protocol.socket_path(
                pathlib.Path(node["runtime_dir"]), "node-control", node["id"],
            )
            return unix_exchange(path, request)
        result = subprocess.run(
            stdio_broker.ssh_command(node["transport"], self.live_root),
            input=request,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=20,
            check=False,
        )
        if result.returncode != 0:
            raise IngressError("node control transport is unavailable")
        return result.stdout

    def control(self, node: dict[str, Any], action: str,
                payload: dict[str, Any]) -> dict[str, Any]:
        request_id = secrets.token_hex(16)
        request = protocol.encode_request(
            "node-control", request_id, node["id"], action, payload,
        )
        try:
            return protocol.decode_response(self._sender(node, request), request_id)
        except (OSError, subprocess.TimeoutExpired, protocol.ProtocolError) as exc:
            raise IngressError(f"node control rejected {action}: {exc}") from exc

    def activate(self, node: dict[str, Any], pane_id: str | None,
                 session: str | None) -> dict[str, Any]:
        with self.lock:
            if self.active:
                if self.active["node"] != node["id"]:
                    raise Conflict("another terminal node is already active")
                if pane_id is not None or session != self.active.get("session"):
                    raise Conflict("the terminal node is already active with another selection")
                return dict(self.active)
            activation_id = secrets.token_hex(12)
            result = self.control(node, "activate", {
                "activation_id": activation_id,
                "pane_id": pane_id,
                "session": session,
                "lease_seconds": LEASE_SECONDS,
            })
            if result.get("active") is not True or result.get("activation_id") != activation_id:
                try:
                    self.control(node, "disable", {})
                except IngressError:
                    pass
                raise IngressError("node activation did not publish a healthy endpoint")
            expected_socket = str(pathlib.Path(node["runtime_dir"]) / "ttyd.sock")
            deadline = result.get("deadline")
            if (result.get("data_socket") != expected_socket or not isinstance(deadline, int)
                    or isinstance(deadline, bool) or deadline <= int(time.time())):
                try:
                    self.control(node, "disable", {})
                except IngressError:
                    pass
                raise IngressError("node activation published invalid endpoint metadata")
            self.active = {
                "node": node["id"],
                "activation_id": activation_id,
                "pane_id": result.get("pane_id"),
                "session": session,
                "deadline": deadline,
                "data_socket": expected_socket,
            }
            return dict(self.active)

    def heartbeat(self, node: dict[str, Any]) -> int:
        with self.lock:
            if not self.active or self.active["node"] != node["id"]:
                raise Conflict("terminal activation is not current")
            result = self.control(node, "heartbeat", {
                "activation_id": self.active["activation_id"],
            })
            deadline = result.get("deadline")
            if (result.get("active") is not True or not isinstance(deadline, int)
                    or isinstance(deadline, bool) or deadline <= int(time.time())):
                self.active = None
                self.client_active = False
                raise IngressError("node heartbeat returned invalid state")
            self.active["deadline"] = deadline
            return deadline

    def deactivate(self, expected_node: str | None = None) -> None:
        with self.lock:
            active = self.active
            if not active or (expected_node is not None and active["node"] != expected_node):
                return
            node = self.nodes[active["node"]]
            self.active = None
            self.client_active = False
            try:
                self.control(node, "disable", {})
            except IngressError:
                pass

    def expire_once(self, now: int | None = None) -> bool:
        current = int(time.time()) if now is None else now
        with self.lock:
            if not self.active or int(self.active.get("deadline", 0)) > current:
                return False
            node_id = self.active["node"]
        self.deactivate(node_id)
        return True

    def begin_client(self, node_id: str) -> None:
        with self.lock:
            if not self.active or self.active["node"] != node_id:
                raise Conflict("terminal activation is not current")
            if self.client_active:
                raise Conflict("another terminal client is already connected")
            self.client_active = True

    def end_client(self, node_id: str) -> None:
        with self.lock:
            if self.active and self.active["node"] == node_id:
                self.client_active = False

    def active_for(self, node_id: str) -> dict[str, Any]:
        with self.lock:
            if (not self.active or self.active["node"] != node_id
                    or int(self.active.get("deadline", 0)) <= int(time.time())):
                raise Conflict("terminal activation is not current")
            return dict(self.active)

    def status(self) -> dict[str, Any]:
        with self.lock:
            if not self.active:
                return {"ready": True, "active": False, "nodes": len(self.nodes)}
            return {
                "ready": True,
                "active": True,
                "node": self.active["node"],
                "pane_id": self.active.get("pane_id"),
                "deadline": self.active.get("deadline"),
            }


class UnixHTTPServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    allow_reuse_address = False
    daemon_threads = True
    request_queue_size = 64

    def __init__(self, path: str, state: IngressState):
        self.state = state
        super().__init__(path, Handler)


class Handler(http.server.BaseHTTPRequestHandler):
    server: Any
    server_version = "HerdrTerminalIngress/1"

    def do_GET(self) -> None:
        try:
            if self.path == "/health":
                self._json(200, self.server.state.status())
                return
            node, suffix, query = self._request_context()
            if suffix:
                if query or (suffix != "terminal" and not suffix.startswith("terminal/")):
                    raise NotFound("terminal resource is unavailable")
                self._proxy(node, suffix)
                return
            selectors = self._selectors(query)
            if "session" in selectors and selectors["session"] != node["session"]:
                raise BadRequest("terminal session selector does not match the node")
            active = self.server.state.active
            if active is None or selectors:
                self._require_navigation()
                self.server.state.activate(
                    node, selectors.get("pane"), selectors.get("session", node["session"]),
                )
            elif active["node"] != node["id"]:
                raise Conflict("another terminal node is already active")
            if selectors:
                self.send_response(303)
                self.send_header("Location", f"/ttyd/{node['id']}/")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self._landing()
        except IngressError as exc:
            self._json(exc.status, {"error": str(exc)})
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            self._json(503, {"error": f"terminal ingress unavailable: {type(exc).__name__}"})

    def do_POST(self) -> None:
        try:
            node, suffix, query = self._request_context()
            if suffix != "heartbeat" or query:
                raise NotFound("terminal heartbeat is unavailable")
            if (self.headers.get("Origin") != self.server.state.origin
                    or self.headers.get("Sec-Fetch-Site") != "same-origin"):
                raise Forbidden("same-origin heartbeat required")
            if self.headers.get("Content-Length", "0") not in {"", "0"}:
                raise BadRequest("terminal heartbeat body must be empty")
            deadline = self.server.state.heartbeat(node)
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Herdr-Terminal-Deadline", str(deadline))
            self.end_headers()
        except IngressError as exc:
            self._json(exc.status, {"error": str(exc)})

    def _request_context(self) -> tuple[dict[str, Any], str, str]:
        state: IngressState = self.server.state
        if not state.auth.verify_cookie(self.headers.get("Cookie", "")):
            raise Unauthorized("valid Fleet session required")
        host = self.headers.get("Host", "").lower().rstrip(".")
        if host != state.host:
            raise Forbidden("request Host is not the Fleet host")
        origin = self.headers.get("Origin")
        if origin is not None and origin != state.origin:
            raise Forbidden("request Origin is not the Fleet origin")
        target = urllib.parse.urlsplit(self.path)
        match = re.fullmatch(r"/ttyd/([a-z0-9-]+)/?(.*)", target.path)
        if not match or not target.path.startswith(f"/ttyd/{match.group(1)}/"):
            raise NotFound("unknown terminal path")
        node_id, suffix = match.groups()
        node = state.nodes.get(node_id)
        if node is None:
            raise NotFound("unknown terminal node")
        return node, suffix, target.query

    def _selectors(self, query: str) -> dict[str, str]:
        if not query:
            return {}
        try:
            pairs = urllib.parse.parse_qsl(query, keep_blank_values=True, strict_parsing=True)
        except ValueError as exc:
            raise BadRequest("terminal selectors are malformed") from exc
        result: dict[str, str] = {}
        for key, value in pairs:
            if key not in {"pane", "session"} or key in result or not value:
                raise BadRequest("terminal selectors are invalid")
            pattern = protocol.PANE_ID if key == "pane" else protocol.SESSION
            if not pattern.fullmatch(value):
                raise BadRequest(f"terminal {key} selector is invalid")
            result[key] = value
        return result

    def _require_navigation(self) -> None:
        state: IngressState = self.server.state
        if any(self.headers.get(key) for key in (
            "Purpose", "Sec-Purpose", "X-Purpose", "X-Moz",
        )):
            raise Forbidden("speculative terminal navigation rejected")
        site = self.headers.get("Sec-Fetch-Site", "")
        if (self.headers.get("Sec-Fetch-Mode") != "navigate"
                or self.headers.get("Sec-Fetch-Dest") != "document"
                or self.headers.get("Sec-Fetch-User") != "?1"
                or site not in {"same-origin", "none"}):
            raise Forbidden("top-level user navigation required")
        origin = self.headers.get("Origin")
        referer = self.headers.get("Referer")
        # A browser top-level GET normally omits Origin, and Fleet deliberately uses
        # no-referrer. Sec-Fetch-Site is therefore the positive same-origin signal;
        # Origin/Referer are additional exact checks only when the browser sends them.
        if referer is not None and not referer.startswith(state.origin + "/"):
            raise Forbidden("navigation Referer rejected")
        if site == "none" and origin not in {None, state.origin}:
            raise Forbidden("direct navigation Origin rejected")

    def _landing(self) -> None:
        body = (FEATURE_DIR / "web" / "index.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, node: dict[str, Any], suffix: str) -> None:
        state: IngressState = self.server.state
        active = state.active_for(node["id"])
        websocket = self.headers.get("Upgrade", "").lower() == "websocket"
        if websocket:
            state.begin_client(node["id"])
        filtered = {
            "authorization", "cookie", "host", "origin", "proxy-authorization",
            "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
            "x-herdr-fallback-user",
        }
        headers = [
            (key, value) for key, value in self.headers.items()
            if key.lower() not in filtered and (websocket or key.lower() != "connection")
        ]
        headers.extend([
            ("Host", state.host),
            ("Origin", state.origin),
            ("X-Herdr-Fallback-User", state.auth.username),
        ])
        if not websocket:
            headers.append(("Connection", "close"))
        request = (
            f"GET /{suffix} HTTP/1.1\r\n"
            + "".join(f"{key}: {value}\r\n" for key, value in headers)
            + "\r\n"
        ).encode()
        try:
            if node["transport"]["kind"] == "local":
                upstream = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                try:
                    upstream.settimeout(20)
                    upstream.connect(active["data_socket"])
                    upstream.sendall(request)
                    if websocket:
                        self.close_connection = True
                        self._pump_socket(upstream)
                    else:
                        while True:
                            block = upstream.recv(65536)
                            if not block:
                                break
                            self.connection.sendall(block)
                finally:
                    upstream.close()
            else:
                process = subprocess.Popen(
                    stdio_broker.ssh_command(node["transport"], state.live_root),
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    close_fds=True,
                )
                assert process.stdin and process.stdout
                process.stdin.write(request)
                process.stdin.flush()
                if websocket:
                    self.close_connection = True
                    stdio_broker.pump_socket_process(self.connection, process)
                else:
                    while True:
                        block = process.stdout.read(65536)
                        if not block:
                            break
                        self.connection.sendall(block)
                    process.stdin.close()
                    if process.wait(timeout=5) != 0:
                        raise IngressError("terminal transport closed unexpectedly")
        except (OSError, subprocess.TimeoutExpired) as exc:
            state.deactivate(node["id"])
            raise IngressError("terminal transport is unavailable") from exc
        finally:
            if websocket:
                state.end_client(node["id"])
                state.deactivate(node["id"])

    def _pump_socket(self, upstream: socket.socket) -> None:
        client = self.connection
        client.setblocking(False)
        upstream.setblocking(False)
        selector = selectors.DefaultSelector()
        selector.register(client, selectors.EVENT_READ, upstream)
        selector.register(upstream, selectors.EVENT_READ, client)
        try:
            while True:
                events = selector.select(timeout=60)
                if not events:
                    continue
                for key, _mask in events:
                    try:
                        block = key.fileobj.recv(65536)
                    except BlockingIOError:
                        continue
                    if not block:
                        return
                    destination = key.data
                    destination.sendall(block)
        finally:
            selector.close()
            upstream.close()

    def _json(self, status: int, value: dict[str, Any]) -> None:
        body = (json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: Any) -> None:
        return


def serve(args: argparse.Namespace) -> None:
    inventory = protected_file(args.inventory, "terminal inventory")
    gateway_config = protected_file(args.gateway_config, "Gateway config")
    live_root = pathlib.Path(args.live_root)
    socket_path = pathlib.Path(args.socket)
    for path, label in ((live_root, "live root"), (socket_path, "ingress socket")):
        if not path.is_absolute():
            raise IngressError(f"{label} must be absolute")
    socket_gid = int(args.socket_gid)
    if socket_gid < 0 or socket_gid > 2_147_483_647:
        raise IngressError("ingress socket GID is invalid")
    if socket_path.parent == pathlib.Path("/") or socket_path.parent.is_symlink():
        raise IngressError("ingress socket requires a dedicated real parent directory")
    socket_path.parent.mkdir(mode=0o710, parents=True, exist_ok=True)
    parent_info = socket_path.parent.stat()
    if parent_info.st_uid != os.geteuid():
        raise IngressError("ingress socket parent must be owned by the service user")
    os.chown(socket_path.parent, os.geteuid(), socket_gid)
    os.chmod(socket_path.parent, 0o710)
    try:
        socket_path.unlink()
    except FileNotFoundError:
        pass
    state = IngressState(inventory, gateway_config, live_root)
    stop_requested = False
    expiry_stop = threading.Event()

    def expire_loop() -> None:
        while not expiry_stop.wait(1):
            state.expire_once()

    expiry_thread = threading.Thread(target=expire_loop, name="terminal-expiry", daemon=True)
    expiry_thread.start()

    def request_stop(_signum: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True

    previous_term = signal.signal(signal.SIGTERM, request_stop)
    previous_int = signal.signal(signal.SIGINT, request_stop)
    server = UnixHTTPServer(str(socket_path), state)
    server.timeout = 0.25
    os.chown(socket_path, os.geteuid(), socket_gid)
    os.chmod(socket_path, 0o660)
    try:
        while not stop_requested:
            server.handle_request()
    finally:
        expiry_stop.set()
        state.deactivate()
        expiry_thread.join(timeout=2)
        server.server_close()
        try:
            socket_path.unlink()
        except FileNotFoundError:
            pass
        signal.signal(signal.SIGTERM, previous_term)
        signal.signal(signal.SIGINT, previous_int)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("--socket", required=True)
    result.add_argument("--socket-gid", required=True, type=int)
    result.add_argument("--inventory", required=True)
    result.add_argument("--gateway-config", required=True)
    result.add_argument("--live-root", required=True)
    return result


def main() -> int:
    try:
        serve(parser().parse_args())
        return 0
    except (IngressError, OSError, ValueError, json.JSONDecodeError,
            controller.ControllerError) as exc:
        print(f"herdr-terminal-ingress: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
