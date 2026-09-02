#!/usr/bin/env python3
"""Expose a fixed local or SSH-stdio upstream on one protected Unix socket."""

from __future__ import annotations

import os
import pathlib
import selectors
import shlex
import socket
import subprocess
from typing import Any


def ssh_command(spec: dict[str, Any], live_root: pathlib.Path) -> list[str]:
    identity = live_root / spec["identity"]
    known_hosts = live_root / spec["known_hosts"]
    command = ["ssh", "-T", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
               "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known_hosts}",
               "-o", "RequestTTY=no", "-o", "ClearAllForwardings=yes", "-o", "ForwardAgent=no",
               "-o", "ForwardX11=no", "-o", "PermitLocalCommand=no", "-o", "ControlMaster=no",
               "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
               "-i", str(identity), "-p", str(spec["port"])]
    if spec.get("jump"):
        jump = spec["jump"]
        proxy_known = live_root / jump["known_hosts"]
        proxy_identity = live_root / jump["identity"]
        proxy_args = ["ssh", "-F", "/dev/null", "-W", "%h:%p", "-o", "BatchMode=yes",
                      "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                      "-o", f"UserKnownHostsFile={proxy_known}", "-o", "ForwardAgent=no",
                      "-o", "ForwardX11=no", "-o", "RequestTTY=no", "-o", "ControlMaster=no",
                      "-i", str(proxy_identity), "-p", str(jump["port"]),
                      f"{jump['user']}@{jump['host']}"]
        command.extend(["-o", f"ProxyCommand={shlex.join(proxy_args)}"])
    command.append(f"{spec['user']}@{spec['host']}")
    return command


def pump_socket_process(client: socket.socket, process: subprocess.Popen[bytes]) -> None:
    assert process.stdin and process.stdout
    client.setblocking(False)
    os.set_blocking(process.stdin.fileno(), False)
    os.set_blocking(process.stdout.fileno(), False)
    selector = selectors.DefaultSelector()
    selector.register(client, selectors.EVENT_READ, "client")
    selector.register(process.stdout, selectors.EVENT_READ, "upstream")
    to_client = bytearray()
    to_upstream = bytearray()
    client_open = True
    upstream_open = True
    try:
        while (client_open or upstream_open) and process.poll() is None:
            for key, _mask in selector.select(timeout=2):
                if key.data == "client" and client_open:
                    try:
                        data = client.recv(65536)
                    except BlockingIOError:
                        data = None
                    if data == b"":
                        client_open = False
                        selector.unregister(client)
                        process.stdin.close()
                    elif data:
                        to_upstream.extend(data)
                elif key.data == "upstream" and upstream_open:
                    try:
                        data = os.read(process.stdout.fileno(), 65536)
                    except BlockingIOError:
                        data = None
                    if data == b"":
                        upstream_open = False
                        selector.unregister(process.stdout)
                    elif data:
                        to_client.extend(data)
            if to_upstream and not process.stdin.closed:
                try:
                    sent = os.write(process.stdin.fileno(), to_upstream)
                    del to_upstream[:sent]
                except (BlockingIOError, BrokenPipeError):
                    pass
            if to_client:
                try:
                    sent = client.send(to_client)
                    del to_client[:sent]
                except (BlockingIOError, BrokenPipeError):
                    pass
            if not client_open and not to_upstream:
                break
    finally:
        client.close()
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
