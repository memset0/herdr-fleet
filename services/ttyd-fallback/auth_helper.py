#!/usr/bin/env python3
"""Activation-scoped Basic authentication and bounded failure throttling."""

from __future__ import annotations

import argparse
import base64
import binascii
import collections
import hashlib
import hmac
import http.server
import json
import os
import pathlib
import socketserver
import threading
import time
from typing import Any


class AuthState:
    def __init__(self, verifier_path: str, username: str) -> None:
        verifier = json.loads(pathlib.Path(verifier_path).read_text())
        self.username = username
        self.iterations = int(verifier["iterations"])
        self.salt = bytes.fromhex(verifier["salt"])
        self.digest = bytes.fromhex(verifier["digest"])
        if verifier.get("algorithm") != "pbkdf2-sha256" or self.iterations < 200_000:
            raise ValueError("unsupported verifier")
        self.failures: dict[str, collections.deque[float]] = collections.defaultdict(collections.deque)
        self.blocked_until: dict[str, float] = {}
        self.lock = threading.Lock()
        self.workers = threading.BoundedSemaphore(4)

    def reject(self, source: str, now: float) -> tuple[bool, bool]:
        queue = self.failures[source]
        while queue and queue[0] <= now - 60:
            queue.popleft()
        queue.append(now)
        if len(queue) >= 5:
            self.blocked_until[source] = now + 300
            queue.clear()
            return False, True
        return False, False

    def verify(self, authorization: str, source: str) -> tuple[bool, bool]:
        now = time.monotonic()
        with self.lock:
            if self.blocked_until.get(source, 0) > now:
                return False, True
        try:
            scheme, payload = authorization.split(" ", 1)
            raw = base64.b64decode(payload, validate=True).decode("utf-8")
            username, password = raw.split(":", 1)
        except (ValueError, UnicodeError, binascii.Error):
            with self.lock:
                return self.reject(source, now)
        if scheme.lower() != "basic" or not self.workers.acquire(blocking=False):
            with self.lock:
                return self.reject(source, now)
        try:
            candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), self.salt, self.iterations)
            valid = hmac.compare_digest(username.encode(), self.username.encode()) & hmac.compare_digest(candidate, self.digest)
        finally:
            self.workers.release()
        with self.lock:
            if valid:
                self.failures[source].clear()
                self.blocked_until.pop(source, None)
                return True, False
            return self.reject(source, now)


class Handler(http.server.BaseHTTPRequestHandler):
    server: Any

    def do_GET(self) -> None:
        source = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip() or "unknown"
        valid, limited = self.server.auth.verify(self.headers.get("Authorization", ""), source)
        if valid:
            self.send_response(200)
            self.send_header("X-Herdr-Fallback-User", self.server.auth.username)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        self.send_response(429 if limited else 401)
        if limited:
            self.send_header("Retry-After", "300")
        else:
            self.send_header("WWW-Authenticate", 'Basic realm="Herdr emergency terminal", charset="UTF-8"')
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
    parser.add_argument("--verifier", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--deadline", type=int, required=True)
    args = parser.parse_args()
    path = pathlib.Path(args.socket)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    server = UnixHTTPServer(str(path), Handler)
    server.auth = AuthState(args.verifier, args.username)
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
