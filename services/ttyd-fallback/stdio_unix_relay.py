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
import protocol


def select_upstream(cfg: dict[str, object], prelude: bytes) -> pathlib.Path:
    root, state_path, data_socket = node.runtime_paths(cfg)
    if prelude.lstrip().startswith(b"{"):
        protocol.decode_request(
            prelude,
            expected_channel="node-control",
            expected_node=str(cfg["id"]),
        )
        return protocol.socket_path(root, "node-control", str(cfg["id"]))
    status = node.read_state(state_path)
    if not node.state_live(status) or not data_socket.exists():
        raise node.FallbackError("no active terminal lease")
    return data_socket


def read_prelude() -> bytes:
    value = bytearray()
    while b"\n" not in value and len(value) <= protocol.MAX_LINE_BYTES:
        block = os.read(sys.stdin.fileno(), min(4096, protocol.MAX_LINE_BYTES + 1 - len(value)))
        if not block:
            break
        value.extend(block)
    if not value or len(value) > protocol.MAX_LINE_BYTES or b"\n" not in value:
        raise node.FallbackError("relay request prelude is invalid")
    return bytes(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    try:
        cfg = node.load_config(args.config)
        node.gate(cfg)
        if os.environ.get("SSH_ORIGINAL_COMMAND"):
            raise node.FallbackError("SSH command arguments are not permitted")
        prelude = read_prelude()
        socket_path = select_upstream(cfg, prelude)
        upstream = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        upstream.connect(str(socket_path))
        upstream.sendall(prelude)
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
