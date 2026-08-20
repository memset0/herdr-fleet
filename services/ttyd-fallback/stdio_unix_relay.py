#!/usr/bin/env python3
"""Forced-command SSH relay from stdio to one configured Unix socket."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import selectors
import socket
import sys

import node


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    try:
        cfg = node.load_config(args.config)
        node.gate(cfg)
        if os.environ.get("SSH_ORIGINAL_COMMAND"):
            raise node.FallbackError("SSH command arguments are not permitted")
        _root, _state_path, socket_path = node.runtime_paths(cfg)
        status = node.read_state(_state_path)
        if not node.state_live(status) or not socket_path.exists():
            raise node.FallbackError("no active fallback lease")
        upstream = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        upstream.connect(str(socket_path))
        upstream.setblocking(False)
        os.set_blocking(sys.stdin.fileno(), False)
        os.set_blocking(sys.stdout.fileno(), False)
        selector = selectors.DefaultSelector()
        selector.register(sys.stdin.fileno(), selectors.EVENT_READ, "stdin")
        selector.register(upstream, selectors.EVENT_READ, "socket")
        pending_stdout = bytearray()
        pending_socket = bytearray()
        stdin_open = True
        socket_open = True
        while socket_open or pending_stdout:
            events = selector.select(timeout=10)
            for key, _mask in events:
                if key.data == "stdin" and stdin_open:
                    try:
                        data = os.read(sys.stdin.fileno(), 65536)
                    except BlockingIOError:
                        data = None
                    if data == b"":
                        stdin_open = False
                        selector.unregister(sys.stdin.fileno())
                        upstream.shutdown(socket.SHUT_WR)
                    elif data:
                        pending_socket.extend(data)
                elif key.data == "socket" and socket_open:
                    try:
                        data = upstream.recv(65536)
                    except BlockingIOError:
                        data = None
                    if data == b"":
                        socket_open = False
                        selector.unregister(upstream)
                    elif data:
                        pending_stdout.extend(data)
            if pending_socket:
                try:
                    sent = upstream.send(pending_socket)
                    del pending_socket[:sent]
                except BlockingIOError:
                    pass
            if pending_stdout:
                try:
                    sent = os.write(sys.stdout.fileno(), pending_stdout)
                    del pending_stdout[:sent]
                except BlockingIOError:
                    pass
            if not stdin_open and not pending_socket and not socket_open:
                break
        upstream.close()
        return 0
    except (node.FallbackError, OSError, json.JSONDecodeError) as exc:
        print(f"herdr-ttyd-relay: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
