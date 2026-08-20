#!/usr/bin/env python3
"""Expose a fixed local or SSH-stdio upstream on one protected Unix socket."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import selectors
import shlex
import signal
import socket
import subprocess
import sys
import threading
import time
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
        proxy_args = ["ssh", "-F", "/dev/null", "-W", "%h:%p", "-o", "BatchMode=yes",
                      "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                      "-o", f"UserKnownHostsFile={proxy_known}", "-o", "ForwardAgent=no",
                      "-o", "ForwardX11=no", "-o", "RequestTTY=no", "-o", "ControlMaster=no",
                      "-i", jump["identity"], "-p", str(jump["port"]),
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


def handle(client: socket.socket, spec: dict[str, Any], live_root: pathlib.Path) -> None:
    if spec["kind"] == "local":
        command = [sys.executable, str(pathlib.Path(__file__).with_name("stdio_unix_relay.py")),
                   "--config", spec["node_config"]]
    elif spec["kind"] == "ssh":
        command = ssh_command(spec, live_root)
    else:
        client.close()
        return
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, close_fds=True)
    pump_socket_process(client, process)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--socket", required=True)
    parser.add_argument("--live-root", required=True)
    parser.add_argument("--socket-gid", type=int, required=True)
    parser.add_argument("--deadline", type=int, required=True)
    args = parser.parse_args()
    spec = json.loads(pathlib.Path(args.spec).read_text())
    path = pathlib.Path(args.socket)
    path.parent.mkdir(mode=0o710, parents=True, exist_ok=True)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    listener.bind(str(path))
    os.chown(path, os.geteuid(), args.socket_gid)
    os.chmod(path, 0o660)
    listener.listen(16)
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    listener.settimeout(1)
    try:
        while not stop.is_set() and int(time.time()) < args.deadline:
            try:
                client, _addr = listener.accept()
            except socket.timeout:
                continue
            threading.Thread(target=handle, args=(client, spec, pathlib.Path(args.live_root)), daemon=True).start()
    finally:
        listener.close()
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
