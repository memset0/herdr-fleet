#!/usr/bin/env python3
"""Activation-scoped verification of Web Remote's signed Fleet session cookie."""

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
import socketserver
import threading
import time
from typing import Any

BASE64URL = re.compile(r"^[A-Za-z0-9_-]+$")
COOKIE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
USERNAME = re.compile(r"^[A-Za-z0-9_.-]{3,64}$")
MAX_SAFE_INTEGER = 9_007_199_254_740_991


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
        self.username = auth.get("username")
        secret_value = auth.get("sessionSecret")
        if not isinstance(self.cookie_name, str) or not COOKIE_NAME.fullmatch(self.cookie_name):
            raise ValueError("Gateway cookie name is invalid")
        if not isinstance(self.username, str) or not USERNAME.fullmatch(self.username):
            raise ValueError("Gateway username is invalid")
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
        expected = base64url_encode(hmac.new(self.secret, encoded.encode("ascii"), hashlib.sha256).digest())
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


class Handler(http.server.BaseHTTPRequestHandler):
    server: Any

    def do_GET(self) -> None:
        if self.server.auth.verify_cookie(self.headers.get("Cookie", "")):
            self.send_response(200)
            self.send_header("X-Herdr-Fallback-User", self.server.auth.username)
        else:
            self.send_response(401)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def log_message(self, _format: str, *args: object) -> None:
        return


class UnixHTTPServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--socket", required=True)
    parser.add_argument("--socket-gid", type=int, required=True)
    parser.add_argument("--gateway-config", required=True)
    parser.add_argument("--deadline", type=int, required=True)
    args = parser.parse_args()
    path = pathlib.Path(args.socket)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    server = UnixHTTPServer(str(path), Handler)
    server.auth = SessionAuth(args.gateway_config)
    os.chown(path, os.geteuid(), args.socket_gid)
    os.chmod(path, 0o660)
    remaining = max(0, args.deadline - int(time.time()))
    expiry = threading.Timer(remaining, server.shutdown)
    expiry.daemon = True
    expiry.start()
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        expiry.cancel()
        server.server_close()
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
