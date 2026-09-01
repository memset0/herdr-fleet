#!/usr/bin/env python3
"""One descriptor-driven installer for the ttyd fallback companion."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import pwd
import shutil
import socket
import subprocess
import tempfile
import urllib.parse
import urllib.request

import controller
import platform_support


SERVICE_DIR = pathlib.Path(__file__).resolve().parent
REQUIRED_OPTIONS = (
    "--interface", "--socket-owner", "--auth-header", "--writable", "--check-origin",
    "--max-clients", "--base-path",
)
RUNTIME_FILES = (
    "node.py", "platform_support.py", "stdio_unix_relay.py", "stdio_broker.py",
    "auth_helper.py", "controller.py", "installer.py", "ttyd-fallback", "install.sh",
)


class InstallerError(RuntimeError):
    pass


def release_identity(architecture: str) -> dict[str, str]:
    version = (SERVICE_DIR / "VERSION").read_text().strip()
    asset = {"x86_64": "ttyd.x86_64", "aarch64": "ttyd.aarch64"}[architecture]
    checksums = {}
    for line in (SERVICE_DIR / "SHA256SUMS").read_text().splitlines():
        parts = line.split()
        if len(parts) == 2:
            checksums[parts[1]] = parts[0]
    digest = checksums.get(asset, "")
    if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
        raise InstallerError(f"missing checksum for {asset}")
    return {
        "asset": asset,
        "sha256": digest,
        "version_output": f"ttyd version {version}-40e79c7",
        "url": f"https://github.com/tsl0922/ttyd/releases/download/{version}/{asset}",
    }


def expected_identity(node: dict[str, object]) -> dict[str, str]:
    binary = node["binary"]
    assert isinstance(binary, dict)
    if binary["source"] == "release_asset":
        if node["platform"] != "linux":
            raise InstallerError("release_asset is supported only for Linux")
        return {"source": "release_asset", **release_identity(str(node["architecture"]))}
    return {
        "source": "local_path",
        "path": str(binary["path"]),
        "sha256": str(binary["sha256"]),
        "version_output": str(binary["version_output"]),
    }


def gate(node: dict[str, object]) -> None:
    expected_owner = str(node["owner"])
    if pwd.getpwuid(os.geteuid()).pw_name != expected_owner:
        raise InstallerError(f"owner gate rejected; expected {expected_owner}")
    host = socket.gethostname().split(".")[0]
    if node.get("host_exact") and host != node["host_exact"]:
        raise InstallerError(f"host gate rejected: {host}")
    if node.get("host_prefix") and not host.startswith(str(node["host_prefix"])):
        raise InstallerError(f"host gate rejected: {host}")
    if node.get("reject_slurm") and (os.environ.get("SLURM_JOB_ID") or os.environ.get("SLURM_JOBID")):
        raise InstallerError("scheduler-job gate rejected")


def acquire_candidate(identity: dict[str, str], override: str, target: pathlib.Path) -> None:
    if override:
        source = pathlib.Path(override)
        if not source.is_file():
            raise InstallerError(f"source binary does not exist: {source}")
        shutil.copyfile(source, target)
    elif identity["source"] == "local_path":
        source = pathlib.Path(identity["path"])
        if not source.is_file():
            raise InstallerError(f"source binary does not exist: {source}")
        shutil.copyfile(source, target)
    else:
        request = urllib.request.Request(identity["url"], headers={"User-Agent": "herdr-web-remote"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response, target.open("wb") as output:
                shutil.copyfileobj(response, output)
        except OSError as exc:
            raise InstallerError("could not download the pinned ttyd release asset") from exc
    os.chmod(target, 0o755)


def verify_candidate(path: pathlib.Path, node: dict[str, object], identity: dict[str, str]) -> str:
    digest = platform_support.sha256_file(path)
    if digest != identity["sha256"]:
        raise InstallerError("checksum mismatch for ttyd candidate")
    file_format = platform_support.verify_executable(
        path, str(node["platform"]), str(node["architecture"])
    )
    try:
        version = subprocess.run(
            [str(path), "--version"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=10, check=False,
        )
        help_result = subprocess.run(
            [str(path), "--help"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise InstallerError("ttyd candidate could not be inspected") from exc
    if version.returncode != 0 or version.stdout.strip() != identity["version_output"]:
        raise InstallerError("unexpected ttyd version output")
    for option in REQUIRED_OPTIONS:
        if option not in help_result.stdout:
            raise InstallerError(f"required option missing: {option}")
    return file_format


def node_config(node: dict[str, object], install_root: pathlib.Path,
                identity: dict[str, str]) -> dict[str, object]:
    copied = {
        key: node[key] for key in (
            "id", "owner", "herdr_owner", "herdr", "session", "server_socket", "runtime_dir",
            "host_exact", "host_prefix", "reject_slurm", "environment",
        ) if key in node
    }
    copied.update({
        "platform": node["platform"],
        "architecture": node["architecture"],
        "public_host": urllib.parse.urlsplit(str(node["public_origin"])).hostname,
        "ttyd": str(install_root / "bin" / "ttyd"),
        "ttyd_sha256": identity["sha256"],
        "ttyd_version_output": identity["version_output"],
    })
    return copied


def write_json(path: pathlib.Path, value: dict[str, object], mode: int) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    os.chmod(path, mode)


def install_payload(candidate: pathlib.Path, node: dict[str, object], install_root: pathlib.Path,
                    identity: dict[str, str]) -> None:
    parent = install_root.parent
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    stage = pathlib.Path(tempfile.mkdtemp(prefix=f".{install_root.name}.new.", dir=parent))
    backup = parent / f".{install_root.name}.previous.{os.getpid()}"
    moved_previous = False
    try:
        os.chmod(stage, 0o700)
        (stage / "bin").mkdir(mode=0o700)
        (stage / "web").mkdir(mode=0o700)
        shutil.copyfile(candidate, stage / "bin" / "ttyd")
        os.chmod(stage / "bin" / "ttyd", 0o755)
        for name in RUNTIME_FILES:
            shutil.copyfile(SERVICE_DIR / name, stage / name)
            os.chmod(stage / name, 0o755)
        for name in ("VERSION", "SHA256SUMS", "UPSTREAM.md"):
            shutil.copyfile(SERVICE_DIR / name, stage / name)
            os.chmod(stage / name, 0o644)
        shutil.copyfile(SERVICE_DIR / "web" / "index.html", stage / "web" / "index.html")
        os.chmod(stage / "web" / "index.html", 0o644)
        write_json(stage / "node.json", node_config(node, install_root, identity), 0o600)
        if backup.exists():
            raise InstallerError(f"reserved rollback path already exists: {backup}")
        if install_root.exists():
            os.replace(install_root, backup)
            moved_previous = True
        os.replace(stage, install_root)
        if moved_previous:
            shutil.rmtree(backup)
    except Exception:
        if install_root.exists() and moved_previous:
            shutil.rmtree(install_root)
        if moved_previous and backup.exists():
            os.replace(backup, install_root)
        raise
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("--inventory", required=True)
    result.add_argument("--node", required=True)
    result.add_argument("--install-root")
    result.add_argument("--source-binary", default=os.environ.get("HERDR_WEB_TTYD_SOURCE_BINARY", ""))
    result.add_argument("--dry-run", action="store_true")
    return result


def main() -> int:
    args = parser().parse_args()
    if os.environ.get("HERDR_WEB_TTYD_DRY_RUN") == "1":
        args.dry_run = True
    try:
        inventory = controller.load_inventory(pathlib.Path(args.inventory))
        node = controller.select_node(inventory, args.node)
        gate(node)
        actual_platform = platform_support.platform_name()
        actual_arch = platform_support.architecture()
        if node["platform"] != actual_platform:
            raise InstallerError(
                f"platform mismatch for {args.node}: inventory={node['platform']} local={actual_platform}"
            )
        if node["architecture"] != actual_arch:
            raise InstallerError(
                f"architecture mismatch for {args.node}: inventory={node['architecture']} local={actual_arch}"
            )
        runtime_python = pathlib.Path(str(node["python"]))
        if not runtime_python.is_file() or not os.access(runtime_python, os.X_OK):
            raise InstallerError(f"node Python is unavailable: {runtime_python}")
        install_root = pathlib.Path(args.install_root or str(node["install_root"]))
        if not install_root.is_absolute():
            raise InstallerError("install root must be absolute")
        identity = expected_identity(node)
        candidate_needed = bool(args.source_binary or identity["source"] == "local_path" or not args.dry_run)
        if candidate_needed:
            with tempfile.TemporaryDirectory(prefix="herdr-web-remote-ttyd-candidate.") as temporary:
                candidate = pathlib.Path(temporary) / "ttyd"
                acquire_candidate(identity, args.source_binary, candidate)
                file_format = verify_candidate(candidate, node, identity)
                if not args.dry_run:
                    install_payload(candidate, node, install_root, identity)
            state = "validated" if args.dry_run else "installed"
            print(
                f"herdr-web-remote ttyd: {state} source={identity['source']} "
                f"platform={actual_platform} architecture={actual_arch} format={file_format} "
                f"node={args.node} target={install_root / 'bin' / 'ttyd'}"
            )
        else:
            print(
                f"herdr-web-remote ttyd: dry-run source={identity['source']} "
                f"platform={actual_platform} architecture={actual_arch} "
                f"node={args.node} target={install_root / 'bin' / 'ttyd'}"
            )
        print("herdr-web-remote ttyd: no process, listener, route, service, timer, hook, or supervisor was started")
        return 0
    except (controller.ControllerError, InstallerError, platform_support.PlatformSupportError,
            OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"herdr-web-remote ttyd: error: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
