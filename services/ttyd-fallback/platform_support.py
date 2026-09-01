#!/usr/bin/env python3
"""Portable integrity and process-identity primitives for the ttyd companion."""

from __future__ import annotations

import hashlib
import os
import pathlib
import struct
import subprocess
import sys
from typing import Callable, Iterable


class PlatformSupportError(RuntimeError):
    pass


ARCH_ALIASES = {
    "amd64": "x86_64",
    "x86_64": "x86_64",
    "aarch64": "aarch64",
    "arm64": "aarch64",
}


def platform_name(value: str | None = None) -> str:
    current = (value or sys.platform).lower()
    if current.startswith("linux"):
        return "linux"
    if current == "darwin":
        return "darwin"
    raise PlatformSupportError(f"unsupported platform: {current}")


def architecture(value: str | None = None) -> str:
    current = (value or os.uname().machine).lower()
    try:
        return ARCH_ALIASES[current]
    except KeyError as exc:
        raise PlatformSupportError(f"unsupported architecture: {current}") from exc


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _macho_arch(cpu_type: int) -> str | None:
    return {0x01000007: "x86_64", 0x0100000C: "aarch64"}.get(cpu_type)


def executable_identity(path: pathlib.Path) -> tuple[str, set[str]]:
    """Return (format, architectures) for a native ELF or Mach-O executable."""
    with path.open("rb") as handle:
        header = handle.read(4096)
    if len(header) < 20:
        raise PlatformSupportError("candidate executable header is truncated")
    if header[:4] == b"\x7fELF":
        byte_order = {1: "<", 2: ">"}.get(header[5])
        if byte_order is None:
            raise PlatformSupportError("candidate ELF byte order is invalid")
        machine = struct.unpack(f"{byte_order}H", header[18:20])[0]
        arch = {62: "x86_64", 183: "aarch64"}.get(machine)
        if arch is None:
            raise PlatformSupportError(f"candidate ELF architecture is unsupported: {machine}")
        return "elf", {arch}

    magic = header[:4]
    thin_orders = {
        b"\xcf\xfa\xed\xfe": "<",
        b"\xfe\xed\xfa\xcf": ">",
    }
    if magic in thin_orders:
        cpu_type = struct.unpack(f"{thin_orders[magic]}I", header[4:8])[0]
        arch = _macho_arch(cpu_type)
        if arch is None:
            raise PlatformSupportError(f"candidate Mach-O architecture is unsupported: {cpu_type}")
        return "macho", {arch}

    fat_layouts = {
        b"\xca\xfe\xba\xbe": (">", 20),
        b"\xbe\xba\xfe\xca": ("<", 20),
        b"\xca\xfe\xba\xbf": (">", 32),
        b"\xbf\xba\xfe\xca": ("<", 32),
    }
    if magic in fat_layouts:
        byte_order, entry_size = fat_layouts[magic]
        count = struct.unpack(f"{byte_order}I", header[4:8])[0]
        if count < 1 or count > 32 or len(header) < 8 + count * entry_size:
            raise PlatformSupportError("candidate universal Mach-O table is invalid")
        arches: set[str] = set()
        for index in range(count):
            offset = 8 + index * entry_size
            arch = _macho_arch(struct.unpack(f"{byte_order}I", header[offset:offset + 4])[0])
            if arch:
                arches.add(arch)
        if not arches:
            raise PlatformSupportError("candidate universal Mach-O has no supported architecture")
        return "macho", arches
    raise PlatformSupportError("candidate is not a native ELF or Mach-O executable")


def verify_executable(path: pathlib.Path, expected_platform: str, expected_arch: str) -> str:
    file_format, arches = executable_identity(path)
    required_format = {"linux": "elf", "darwin": "macho"}.get(expected_platform)
    if required_format is None:
        raise PlatformSupportError(f"unsupported platform: {expected_platform}")
    if file_format != required_format:
        raise PlatformSupportError(
            f"candidate format mismatch: platform={expected_platform} format={file_format}"
        )
    if expected_arch not in arches:
        raise PlatformSupportError(
            f"candidate architecture mismatch: expected={expected_arch} actual={','.join(sorted(arches))}"
        )
    return file_format


def _linux_process_identity(pid: int, proc_root: pathlib.Path) -> tuple[str, str] | None:
    try:
        stat_text = (proc_root / str(pid) / "stat").read_text()
        end = stat_text.rfind(")")
        if end < 0:
            return None
        fields = stat_text[end + 2:].split()
        start = fields[19]
        command = (proc_root / str(pid) / "cmdline").read_bytes().replace(b"\0", b" ").decode(
            "utf-8", errors="replace"
        ).strip()
    except (OSError, IndexError):
        return None
    return (start, command) if start and command else None


def _darwin_process_identity(
    pid: int,
    runner: Callable[..., subprocess.CompletedProcess[str]],
) -> tuple[str, str] | None:
    environment = {"LC_ALL": "C", "PATH": "/usr/bin:/bin"}
    common = {"env": environment, "stdout": subprocess.PIPE, "stderr": subprocess.DEVNULL,
              "text": True, "check": False}
    start = runner(["/bin/ps", "-p", str(pid), "-o", "lstart="], **common)
    command = runner(["/bin/ps", "-p", str(pid), "-o", "command="], **common)
    if start.returncode != 0 or command.returncode != 0:
        return None
    start_value = start.stdout.strip()
    command_value = command.stdout.strip()
    return (start_value, command_value) if start_value and command_value else None


def process_identity(
    pid: int,
    *,
    system: str | None = None,
    proc_root: pathlib.Path = pathlib.Path("/proc"),
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> tuple[str, str] | None:
    if pid <= 0:
        return None
    selected = platform_name(system)
    if selected == "linux":
        return _linux_process_identity(pid, proc_root)
    return _darwin_process_identity(pid, runner)


def process_matches(pid: int, start: str, markers: Iterable[str], **kwargs: object) -> bool:
    identity = process_identity(pid, **kwargs)
    if identity is None or identity[0] != start:
        return False
    command = identity[1]
    return all(marker and marker in command for marker in markers)
