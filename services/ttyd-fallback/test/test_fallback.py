#!/usr/bin/env python3

from __future__ import annotations

import base64
import hashlib
import hmac
import importlib.util
import json
import os
import pathlib
import pwd
import socket
import struct
import threading
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


platform_support = load("platform_support")
protocol = load("protocol")
controller = load("controller")
node = load("node")
ingress = load("ingress")
installer = load("installer")
stdio_unix_relay = load("stdio_unix_relay")


class FallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="herdr-ttyd-test-")
        self.root = pathlib.Path(self.temp.name)
        self.runtime = self.root / "runtime"
        self.server_socket = self.root / "existing-herdr.sock"
        self.server_listener = socket.socket(socket.AF_UNIX)
        self.server_listener.bind(str(self.server_socket))
        self.server_listener.listen(1)
        self.args_log = self.root / "ttyd-args.json"
        self.herdr = self.root / "herdr"
        self.ttyd = self.root / "ttyd"
        self.config = self.root / "node.json"
        self.inventory = self.root / "inventory.json"
        self.gateway_config = self.root / "gateway.json"
        self.session_secret = b"synthetic-session-secret-32-bytes!!"
        self.herdr.write_text(f'''#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
if args == ["status", "server", "--json"]:
    print(json.dumps({{"running": True, "compatible": True, "socket": {str(self.server_socket)!r}, "session": None}}))
elif args == ["api", "snapshot"]:
    print(json.dumps({{"result": {{"snapshot": {{"focused_pane_id": "w1:p1", "panes": [{{"pane_id": "w1:p1", "terminal_id": "term_synthetic1"}}]}}}}}}))
elif args[:2] == ["terminal", "attach"]:
    raise SystemExit(0)
else:
    raise SystemExit(2)
''')
        self.ttyd.write_text(f'''#!/usr/bin/env python3
import json, os, pathlib, signal, socket, sys, time
if "--version" in sys.argv:
    print("ttyd version 1.7.7-40e79c7")
    raise SystemExit(0)
if "--help" in sys.argv:
    print("--interface --socket-owner --auth-header --writable --check-origin --max-clients --base-path")
    raise SystemExit(0)
pathlib.Path({str(self.args_log)!r}).write_text(json.dumps(sys.argv[1:]))
path = sys.argv[sys.argv.index("--interface") + 1]
try:
    os.unlink(path)
except FileNotFoundError:
    pass
listener = socket.socket(socket.AF_UNIX)
listener.bind(path)
listener.listen(2)
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
while True:
    conn, _ = listener.accept()
    data = conn.recv(65536)
    if data:
        conn.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\n\\r\\nOK")
    conn.close()
''')
        os.chmod(self.herdr, 0o755)
        os.chmod(self.ttyd, 0o755)
        current_owner = pwd.getpwuid(os.geteuid()).pw_name
        current_platform = platform_support.platform_name()
        current_arch = platform_support.architecture()
        ttyd_digest = platform_support.sha256_file(self.ttyd)
        config = {"id": "synthetic", "owner": current_owner, "herdr_owner": current_owner,
                  "platform": current_platform, "architecture": current_arch,
                  "host_exact": socket.gethostname().split(".")[0], "herdr": str(self.herdr),
                  "session": None, "server_socket": str(self.server_socket),
                  "runtime_dir": str(self.runtime),
                  "ttyd": str(self.ttyd), "ttyd_sha256": ttyd_digest,
                  "ttyd_version_output": "ttyd version 1.7.7-40e79c7"}
        self.config.write_text(json.dumps(config))
        self.inventory.write_text(json.dumps({
            "schema": 3,
            "nodes": {
                "local-a": {
                    "platform": current_platform,
                    "architecture": current_arch,
                    "owner": current_owner,
                    "herdr_owner": current_owner,
                    "python": sys.executable,
                    "host_exact": socket.gethostname().split(".")[0],
                    "herdr": str(self.herdr),
                    "session": None,
                    "server_socket": str(self.server_socket),
                    "runtime_dir": str(self.runtime),
                    "install_root": str(self.root / "install"),
                    "binary": {"source": "local_path", "path": str(self.ttyd),
                               "sha256": ttyd_digest,
                               "version_output": "ttyd version 1.7.7-40e79c7"},
                    "transport": {"kind": "local"},
                }
            },
        }))
        self.gateway_config.write_text(json.dumps({
            "public": {"scheme": "https", "fleetHost": "fleet.example.com", "baseDomain": "example.com",
                       "cookieName": "__Secure-synthetic", "sessionTtlSeconds": 3600},
            "auth": {"username": "owner", "passwordHash": "$argon2id$synthetic",
                     "sessionSecret": base64.urlsafe_b64encode(self.session_secret).rstrip(b"=").decode()},
            "nodes": [{"id": "local-a", "enabled": True}],
        }))
        os.chmod(self.gateway_config, 0o600)

    def tearDown(self) -> None:
        try:
            node.reconcile_node(node.load_config(str(self.config)))
        except (node.FallbackError, OSError):
            pass
        self.server_listener.close()
        self.temp.cleanup()

    def start_node_control(self) -> tuple[subprocess.Popen[bytes], pathlib.Path]:
        process = subprocess.Popen(
            [sys.executable, str(ROOT / "node.py"), "--config", str(self.config),
             "serve"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        path = protocol.socket_path(self.runtime, "node-control", "synthetic")
        for _ in range(100):
            if process.poll() is not None:
                _stdout, stderr = process.communicate()
                self.fail(f"node control exited before listening: {stderr.decode()}")
            if path.exists():
                with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as probe:
                    probe.settimeout(0.1)
                    try:
                        probe.connect(str(path))
                    except OSError:
                        pass
                    else:
                        return process, path
            time.sleep(0.02)
        process.terminate()
        process.wait(timeout=3)
        self.fail("node control socket did not appear")

    def control_request(self, path: pathlib.Path, request_id: str, action: str,
                        payload: dict[str, object]) -> dict[str, object]:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(10)
            client.connect(str(path))
            client.sendall(protocol.encode_request(
                "node-control", request_id, "synthetic", action, payload,
            ))
            response = b""
            while not response.endswith(b"\n"):
                chunk = client.recv(4096)
                if not chunk:
                    break
                response += chunk
        return protocol.decode_response(response, request_id)

    def test_preflight_resolves_only_existing_terminal(self) -> None:
        cfg = node.load_config(str(self.config))
        data = node.preflight(cfg, "w1:p1")
        self.assertEqual(data["pane_id"], "w1:p1")
        with self.assertRaisesRegex(node.FallbackError, "does not resolve"):
            node.preflight(cfg, "w9:p9")

    def test_private_control_protocol_is_strict_versioned_and_node_bound(self) -> None:
        request_id = "1" * 32
        raw = protocol.encode_request("node-control", request_id, "local-a", "activate", {
            "activation_id": "2" * 24,
            "pane_id": "w1:p1",
            "session": None,
            "lease_seconds": 1800,
        })
        decoded = protocol.decode_request(
            raw,
            expected_channel="node-control",
            expected_node="local-a",
        )
        self.assertEqual(decoded["payload"]["pane_id"], "w1:p1")
        self.assertEqual(
            protocol.decode_response(
                protocol.encode_response(request_id, result={"ready": True}),
                request_id,
            ),
            {"ready": True},
        )

        wrong_schema = json.loads(raw)
        wrong_schema["schema"] = 99
        with self.assertRaisesRegex(protocol.ProtocolError, "unsupported protocol schema"):
            protocol.decode_request(json.dumps(wrong_schema))
        with self.assertRaisesRegex(protocol.ProtocolError, "not valid JSON"):
            protocol.decode_request("{malformed")
        unsupported = json.loads(raw)
        unsupported["action"] = "shell"
        with self.assertRaisesRegex(protocol.ProtocolError, "unsupported protocol action"):
            protocol.decode_request(json.dumps(unsupported))
        wrong_node = json.loads(raw)
        wrong_node["node_id"] = "other-a"
        with self.assertRaisesRegex(protocol.ProtocolError, "different node"):
            protocol.decode_request(json.dumps(wrong_node), expected_node="local-a")
        extra = json.loads(raw)
        extra["payload"]["command"] = "/bin/sh"
        with self.assertRaisesRegex(protocol.ProtocolError, "unknown fields"):
            protocol.decode_request(json.dumps(extra))
        with self.assertRaisesRegex(protocol.ProtocolError, "wrong protocol channel"):
            protocol.decode_request(raw, expected_channel="central-ingress")

        replay = protocol.ReplayWindow(limit=2)
        replay.accept(request_id)
        with self.assertRaisesRegex(protocol.ProtocolError, "already used"):
            replay.accept(request_id)

    def test_private_control_socket_addresses_are_contained_and_portable(self) -> None:
        root = pathlib.Path("/tmp/herdr-web-remote-synthetic")
        self.assertEqual(
            protocol.socket_path(root, "node-control", "local-a"),
            root / "terminal-node-local-a.sock",
        )
        self.assertEqual(
            protocol.socket_path(root, "central-ingress"),
            root / "terminal-ingress.sock",
        )
        with self.assertRaisesRegex(protocol.ProtocolError, "valid node id"):
            protocol.socket_path(root, "node-control", "../other")
        with self.assertRaisesRegex(protocol.ProtocolError, "too long"):
            protocol.socket_path(pathlib.Path("/tmp") / ("x" * 100), "central-ingress")

    def test_forced_stdio_relay_routes_only_strict_control_or_active_http(self) -> None:
        cfg = node.load_config(str(self.config))
        request = protocol.encode_request(
            "node-control", "b" * 32, "synthetic", "status", {},
        )
        self.assertEqual(
            stdio_unix_relay.select_upstream(cfg, request),
            self.runtime / "terminal-node-synthetic.sock",
        )
        with self.assertRaises(protocol.ProtocolError):
            stdio_unix_relay.select_upstream(cfg, b'{"malformed":true}\n')
        with self.assertRaisesRegex(node.FallbackError, "no active terminal lease"):
            stdio_unix_relay.select_upstream(cfg, b"GET /terminal/ HTTP/1.1\r\n")

    def test_node_control_activates_exact_pane_and_disables_atomically(self) -> None:
        process, control_socket = self.start_node_control()
        try:
            ready = self.control_request(control_socket, "3" * 32, "ready", {})
            self.assertTrue(ready["control"])
            self.assertFalse(ready["active"])
            active = self.control_request(control_socket, "4" * 32, "activate", {
                "activation_id": "5" * 24,
                "pane_id": "w1:p1",
                "session": None,
                "lease_seconds": 1800,
            })
            self.assertTrue(active["active"])
            self.assertEqual(active["pane_id"], "w1:p1")
            self.assertEqual(active["activation_id"], "5" * 24)
            self.assertEqual(active["data_socket"], str(self.runtime / "ttyd.sock"))
            arguments = json.loads(self.args_log.read_text())
            self.assertEqual(arguments[-3:], ["terminal", "attach", "term_synthetic1"])
            self.assertEqual(arguments[arguments.index("--max-clients") + 1], "1")

            before = active["deadline"]
            time.sleep(1.05)
            renewed = self.control_request(control_socket, "c" * 32, "heartbeat", {
                "activation_id": "5" * 24,
            })
            self.assertGreater(renewed["deadline"], before)
            self.assertEqual(
                json.loads((self.runtime / "lease.json").read_text())["deadline"],
                renewed["deadline"],
            )

            disabled = self.control_request(control_socket, "6" * 32, "disable", {})
            self.assertFalse(disabled["active"])
            self.assertTrue(disabled["stopped"])
            self.assertFalse((self.runtime / "lease.json").exists())
            self.assertFalse((self.runtime / "ttyd.sock").exists())
        finally:
            process.terminate()
            process.communicate(timeout=5)
        self.assertFalse(control_socket.exists())

    def test_node_control_partial_start_failure_cleans_state_and_socket(self) -> None:
        failing = self.ttyd.read_text().replace(
            'pathlib.Path(' + repr(str(self.args_log)) + ').write_text(json.dumps(sys.argv[1:]))',
            'raise SystemExit(7)',
        )
        self.ttyd.write_text(failing)
        cfg = json.loads(self.config.read_text())
        cfg["ttyd_sha256"] = platform_support.sha256_file(self.ttyd)
        self.config.write_text(json.dumps(cfg))
        process, control_socket = self.start_node_control()
        try:
            with self.assertRaisesRegex(protocol.ProtocolError, "failed to become ready"):
                self.control_request(control_socket, "7" * 32, "activate", {
                    "activation_id": "8" * 24,
                    "pane_id": "w1:p1",
                    "session": None,
                    "lease_seconds": 1800,
                })
            self.assertFalse((self.runtime / "lease.json").exists())
            self.assertFalse((self.runtime / "ttyd.sock").exists())
            status = self.control_request(control_socket, "9" * 32, "status", {})
            self.assertFalse(status["active"])
        finally:
            process.terminate()
            process.communicate(timeout=5)

    def test_missing_server_fails_before_runtime(self) -> None:
        text = self.herdr.read_text().replace('"running": True', '"running": False')
        self.herdr.write_text(text)
        with self.assertRaisesRegex(node.FallbackError, "not running"):
            node.start_activation(
                node.load_config(str(self.config)), str(self.config), "d" * 24,
                protocol.LEASE_SECONDS, None,
            )
        self.assertFalse(self.runtime.exists())

    def test_host_and_scheduler_gates(self) -> None:
        cfg = json.loads(self.config.read_text())
        cfg["host_exact"] = "wrong-host"
        self.config.write_text(json.dumps(cfg))
        with self.assertRaisesRegex(node.FallbackError, "host gate"):
            node.preflight(node.load_config(str(self.config)), None)
        cfg["host_exact"] = socket.gethostname().split(".")[0]
        cfg["reject_slurm"] = True
        self.config.write_text(json.dumps(cfg))
        env = os.environ.copy()
        env["SLURM_JOB_ID"] = "synthetic"
        with mock.patch.dict(os.environ, env, clear=True), \
                self.assertRaisesRegex(node.FallbackError, "scheduler-job"):
            node.preflight(node.load_config(str(self.config)), None)

    def test_root_supervisor_drops_once_to_declared_client_owner(self) -> None:
        account = mock.Mock(pw_uid=501, pw_gid=20)
        with mock.patch.object(node.pwd, "getpwnam", return_value=account), \
                mock.patch.object(node.os, "geteuid", return_value=0), \
                mock.patch.object(node.os, "initgroups") as initgroups, \
                mock.patch.object(node.os, "setgid") as setgid, \
                mock.patch.object(node.os, "setuid") as setuid:
            node.drop_to_owner({"owner": "operator"})
        initgroups.assert_called_once_with("operator", 20)
        setgid.assert_called_once_with(20)
        setuid.assert_called_once_with(501)
        with mock.patch.dict(os.environ, {**os.environ, "USER": "root", "LOGNAME": "root"}), \
                mock.patch.object(node.os, "geteuid", return_value=501), \
                mock.patch.object(node.pwd, "getpwuid", return_value=mock.Mock(pw_name="operator")), \
                mock.patch.object(node.socket, "gethostname", return_value="operator-host"):
            node.gate({"owner": "operator"})

        with mock.patch.object(node.pwd, "getpwnam", return_value=account), \
                mock.patch.object(node.os, "geteuid", return_value=1000), \
                self.assertRaisesRegex(node.FallbackError, "cannot change"):
            node.drop_to_owner({"owner": "operator"})

    def test_portable_process_identity_contract(self) -> None:
        proc = self.root / "proc"
        pid_root = proc / "123"
        pid_root.mkdir(parents=True)
        fields = ["S", *(["0"] * 18), "4242", *(["0"] * 5)]
        (pid_root / "stat").write_text(f"123 (synthetic command) {' '.join(fields)}\n")
        (pid_root / "cmdline").write_bytes(b"python\0node.py\0_run_lease\0lease-a\0")
        self.assertEqual(
            platform_support.process_identity(123, system="linux", proc_root=proc),
            ("4242", "python node.py _run_lease lease-a"),
        )
        self.assertTrue(platform_support.process_matches(
            123, "4242", ("node.py", "lease-a"), system="linux", proc_root=proc
        ))
        self.assertFalse(platform_support.process_matches(
            123, "9999", ("node.py",), system="linux", proc_root=proc
        ))
        self.assertFalse(platform_support.process_matches(
            123, "4242", ("node.py", "lease-other"), system="linux", proc_root=proc
        ))
        self.assertIsNone(platform_support.process_identity(
            999, system="linux", proc_root=proc
        ))

        def ps_runner(command, **_kwargs):
            value = "Mon Sep  1 12:34:56 2026\n" if "lstart=" in command else "python node.py _run_lease lease-a\n"
            return subprocess.CompletedProcess(command, 0, value, "")

        self.assertEqual(
            platform_support.process_identity(123, system="darwin", runner=ps_runner),
            ("Mon Sep  1 12:34:56 2026", "python node.py _run_lease lease-a"),
        )

        def malformed_ps_runner(command, **_kwargs):
            value = "\n" if "lstart=" in command else "python node.py\n"
            return subprocess.CompletedProcess(command, 0, value, "")

        self.assertIsNone(platform_support.process_identity(
            123, system="darwin", runner=malformed_ps_runner
        ))

    def test_stale_process_state_never_signals_an_unrelated_process(self) -> None:
        state = {"runner_pid": 123, "runner_start": "old-start", "activation_id": "lease-a"}
        with mock.patch.object(node, "process_matches", return_value=False):
            self.assertFalse(node.state_live(state))
        self.runtime.mkdir(mode=0o700)
        (self.runtime / "lease.json").write_text(json.dumps(state))
        (self.runtime / "ttyd.sock").touch()
        with mock.patch.object(node, "process_matches", return_value=False), \
                mock.patch.object(node.os, "killpg") as node_killpg:
            self.assertFalse(node.reconcile_node(node.load_config(str(self.config))))
            self.assertFalse(node.reconcile_node(node.load_config(str(self.config))))
        node_killpg.assert_not_called()
        self.assertFalse((self.runtime / "lease.json").exists())
        self.assertFalse((self.runtime / "ttyd.sock").exists())
    def test_node_control_restart_reconciles_live_lease_before_ready(self) -> None:
        node.start_activation(
            node.load_config(str(self.config)), str(self.config), "restart-lease",
            protocol.LEASE_SECONDS, None,
        )
        self.assertTrue((self.runtime / "lease.json").exists())
        self.assertTrue((self.runtime / "ttyd.sock").exists())
        process, control_socket = self.start_node_control()
        try:
            state = self.control_request(control_socket, "a" * 32, "ready", {})
            self.assertFalse(state["active"])
            self.assertFalse((self.runtime / "lease.json").exists())
            self.assertFalse((self.runtime / "ttyd.sock").exists())
        finally:
            process.terminate()
            process.communicate(timeout=5)

    def test_native_executable_identity_parses_elf_and_macho(self) -> None:
        elf = self.root / "synthetic.elf"
        elf_header = bytearray(64)
        elf_header[:4] = b"\x7fELF"
        elf_header[4] = 2
        elf_header[5] = 1
        elf_header[18:20] = struct.pack("<H", 62)
        elf.write_bytes(elf_header)
        self.assertEqual(platform_support.executable_identity(elf), ("elf", {"x86_64"}))

        macho = self.root / "synthetic.macho"
        macho_header = bytearray(64)
        macho_header[:4] = b"\xcf\xfa\xed\xfe"
        macho_header[4:8] = struct.pack("<I", 0x0100000C)
        macho.write_bytes(macho_header)
        self.assertEqual(platform_support.executable_identity(macho), ("macho", {"aarch64"}))

    def test_installer_common_validation_and_atomic_payload(self) -> None:
        identity = {
            "source": "local_path",
            "path": str(self.ttyd),
            "sha256": platform_support.sha256_file(self.ttyd),
            "version_output": "ttyd version 1.7.7-40e79c7",
        }
        inventory = controller.load_inventory(self.inventory)
        selected = controller.select_node(inventory, "local-a")
        with mock.patch.object(installer.platform_support, "verify_executable", return_value="synthetic"):
            self.assertEqual(installer.verify_candidate(self.ttyd, selected, identity), "synthetic")
        wrong = dict(identity, sha256="0" * 64)
        with self.assertRaisesRegex(installer.InstallerError, "checksum mismatch"):
            installer.verify_candidate(self.ttyd, selected, wrong)

        wrong_version = dict(identity, version_output="ttyd version 9.9.9-synthetic")
        with mock.patch.object(installer.platform_support, "verify_executable", return_value="synthetic"):
            with self.assertRaisesRegex(installer.InstallerError, "unexpected ttyd version"):
                installer.verify_candidate(self.ttyd, selected, wrong_version)

        missing_flag = self.root / "ttyd-missing-flag"
        missing_flag.write_text(self.ttyd.read_text().replace(" --base-path", ""))
        os.chmod(missing_flag, 0o755)
        missing_identity = dict(identity, path=str(missing_flag),
                                sha256=platform_support.sha256_file(missing_flag))
        with mock.patch.object(installer.platform_support, "verify_executable", return_value="synthetic"):
            with self.assertRaisesRegex(installer.InstallerError, "required option missing"):
                installer.verify_candidate(missing_flag, selected, missing_identity)

        target = self.root / "atomic-install"
        target.mkdir()
        (target / "old-marker").write_text("old")
        installer.install_payload(self.ttyd, selected, target, identity)
        self.assertFalse((target / "old-marker").exists())
        installed = json.loads((target / "node.json").read_text())
        self.assertEqual(installed["ttyd_sha256"], identity["sha256"])
        self.assertTrue((target / "platform_support.py").is_file())
        self.assertTrue((target / "protocol.py").is_file())

        (target / "rollback-marker").write_text("preserve")
        real_replace = installer.os.replace

        def fail_new_install(source, destination):
            source_path = pathlib.Path(source)
            destination_path = pathlib.Path(destination)
            if destination_path == target and source_path.name.startswith(f".{target.name}.new."):
                raise OSError("synthetic atomic replacement failure")
            return real_replace(source, destination)

        with mock.patch.object(installer.os, "replace", side_effect=fail_new_install):
            with self.assertRaisesRegex(OSError, "synthetic atomic replacement failure"):
                installer.install_payload(self.ttyd, selected, target, identity)
        self.assertEqual((target / "rollback-marker").read_text(), "preserve")

    def session_token(self, payload: dict[str, object], secret: bytes | None = None) -> str:
        encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
        signature = base64.urlsafe_b64encode(
            hmac.new(secret or self.session_secret, encoded.encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        return f"{encoded}.{signature}"

    def test_ingress_requires_authenticated_user_navigation_and_strips_selectors(self) -> None:
        os.chmod(self.inventory, 0o600)
        calls: list[dict[str, object]] = []

        def sender(_node: dict[str, object], raw: bytes) -> bytes:
            request = protocol.decode_request(
                raw, expected_channel="node-control", expected_node="local-a",
            )
            calls.append(request)
            payload = request["payload"]
            if request["action"] == "activate":
                result = {
                    "node": "local-a",
                    "active": True,
                    "pane_id": payload["pane_id"] or "w1:p1",
                    "activation_id": payload["activation_id"],
                    "deadline": int(time.time()) + 1800,
                    "data_socket": str(self.runtime / "ttyd.sock"),
                }
            elif request["action"] == "heartbeat":
                result = {
                    "node": "local-a", "active": True,
                    "activation_id": payload["activation_id"],
                    "deadline": int(time.time()) + 1800,
                }
            else:
                result = {"node": "local-a", "active": False, "stopped": True}
            return protocol.encode_response(request["request_id"], result=result)

        state = ingress.IngressState(
            self.inventory, self.gateway_config, self.root, sender,
        )
        path = self.root / "ingress.sock"
        server = ingress.UnixHTTPServer(str(path), state)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        now = int(time.time() * 1000)
        token = self.session_token({
            "username": "owner", "issuedAt": now, "expiresAt": now + 60_000,
        })
        common = {
            "Host": "fleet.example.com",
            "Cookie": f"__Secure-synthetic={token}",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-User": "?1",
            "Sec-Fetch-Site": "same-origin",
            "Referer": "https://fleet.example.com/fleet",
        }

        def request(target: str, headers: dict[str, str], method: str = "GET") -> tuple[int, bytes]:
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(str(path))
            lines = [f"{method} {target} HTTP/1.1", *(f"{key}: {value}" for key, value in headers.items()),
                     *([] if "Connection" in headers else ["Connection: close"]), "", ""]
            client.sendall("\r\n".join(lines).encode())
            response = b""
            while True:
                chunk = client.recv(65536)
                if not chunk:
                    break
                response += chunk
            client.close()
            status = int(response.split(b"\r\n", 1)[0].split()[1])
            return status, response

        try:
            self.assertEqual(request("/ttyd/local-a/", {"Host": "fleet.example.com"})[0], 401)
            self.assertEqual(request("/ttyd/local-a/", {**common, "Host": "other.example.com"})[0], 403)
            self.assertEqual(request("/ttyd/local-a/", {
                **common, "Origin": "https://other.example.com",
            })[0], 403)
            self.assertEqual(request("/ttyd/local-a/", {
                **common, "Sec-Fetch-Site": "cross-site",
            })[0], 403)
            self.assertEqual(request("/ttyd/local-a/", {**common, "Purpose": "prefetch"})[0], 403)
            self.assertEqual(request("/ttyd/local-a/", {
                **common, "Sec-Fetch-Dest": "iframe",
            })[0], 403)
            self.assertEqual(request("/ttyd/unknown/", common)[0], 404)
            self.assertEqual(request("/ttyd/local-a/?command=sh", common)[0], 400)
            self.assertEqual(request("/ttyd/local-a/?pane=../other", common)[0], 400)
            self.assertEqual(request("/ttyd/local-a/?session=other", common)[0], 400)
            self.assertEqual(len(calls), 0)

            status, response = request("/ttyd/local-a/?pane=w1%3Ap1", common)
            self.assertEqual(status, 303)
            self.assertIn(b"Location: /ttyd/local-a/", response)
            self.assertNotIn(b"pane=", response)
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0]["payload"]["pane_id"], "w1:p1")
            self.assertEqual(calls[0]["payload"]["session"], None)
            clean_status, clean_response = request("/ttyd/local-a/", common)
            self.assertEqual(clean_status, 200)
            self.assertIn(b"Herdr emergency terminal", clean_response)
            self.assertEqual(len(calls), 1)
            heartbeat_status, _response = request("/ttyd/local-a/heartbeat", {
                **common,
                "Origin": "https://fleet.example.com",
                "Content-Length": "0",
            }, "POST")
            self.assertEqual(heartbeat_status, 204)
            self.assertEqual(calls[-1]["action"], "heartbeat")

            state.nodes["other-a"] = {
                **state.nodes["local-a"], "id": "other-a",
            }
            with self.assertRaisesRegex(ingress.Conflict, "already active"):
                state.activate(state.nodes["other-a"], None, None)
            state.begin_client("local-a")
            with self.assertRaisesRegex(ingress.Conflict, "already connected"):
                state.begin_client("local-a")
            state.end_client("local-a")

            self.runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
            data_socket = self.runtime / "ttyd.sock"
            captured: list[bytes] = []

            def upstream_once(response: bytes) -> threading.Thread:
                try:
                    data_socket.unlink()
                except FileNotFoundError:
                    pass
                listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                listener.bind(str(data_socket))
                listener.listen(1)

                def serve_upstream() -> None:
                    connection, _address = listener.accept()
                    value = b""
                    while b"\r\n\r\n" not in value:
                        value += connection.recv(4096)
                    captured.append(value)
                    connection.sendall(response)
                    connection.close()
                    listener.close()

                upstream_thread = threading.Thread(target=serve_upstream, daemon=True)
                upstream_thread.start()
                return upstream_thread

            plain_thread = upstream_once(
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"
            )
            proxied_status, proxied = request("/ttyd/local-a/terminal/", {
                **common,
                "Authorization": "Basic forged",
                "X-Herdr-Fallback-User": "forged",
            })
            plain_thread.join(timeout=2)
            self.assertEqual(proxied_status, 200)
            self.assertTrue(proxied.endswith(b"OK"))
            forwarded = captured[-1]
            self.assertNotIn(b"Authorization:", forwarded)
            self.assertNotIn(b"Cookie:", forwarded)
            self.assertNotIn(b"X-Herdr-Fallback-User: forged", forwarded)
            self.assertIn(b"X-Herdr-Fallback-User: owner", forwarded)
            self.assertIn(b"Origin: https://fleet.example.com", forwarded)

            websocket_thread = upstream_once(
                b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                b"Connection: Upgrade\r\n\r\n"
            )
            websocket_status, _response = request("/ttyd/local-a/terminal/ws", {
                **common,
                "Connection": "Upgrade",
                "Upgrade": "websocket",
            })
            websocket_thread.join(timeout=2)
            self.assertEqual(websocket_status, 101)
            self.assertIsNone(state.active)
            self.assertEqual(calls[-1]["action"], "disable")

            state.activate(state.nodes["local-a"], None, None)
            assert state.active
            state.active["deadline"] = int(time.time()) - 1
            self.assertTrue(state.expire_once())
            self.assertIsNone(state.active)
            self.assertEqual(calls[-1]["action"], "disable")

            state.activate(state.nodes["local-a"], None, None)
            try:
                data_socket.unlink()
            except FileNotFoundError:
                pass

            failed_status, _response = request("/ttyd/local-a/terminal/", common)
            self.assertEqual(failed_status, 503)
            self.assertIsNone(state.active)
            self.assertEqual(calls[-1]["action"], "disable")

            page = (ROOT / "web" / "index.html").read_text()
            self.assertIn('document.visibilityState === "visible"', page)
            self.assertIn('fetch("heartbeat"', page)
            self.assertIn("setInterval(heartbeat, 60_000)", page)
            self.assertNotIn("localStorage", page)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_fleet_session_verifier_matches_gateway_contract(self) -> None:
        state = ingress.SessionAuth(str(self.gateway_config))
        now = 2_000_000_000_000
        valid = self.session_token({"username": "owner", "issuedAt": now, "expiresAt": now + 60_000})
        self.assertTrue(state.verify_token(valid, now))
        self.assertTrue(state.verify_cookie(f"unrelated=x; __Secure-synthetic={valid}", now))
        encoded, signature = valid.split(".")
        self.assertFalse(state.verify_token(f"{encoded}.{signature[:-1]}x", now))
        self.assertFalse(state.verify_token(self.session_token({"username": "owner", "issuedAt": now,
                                                               "expiresAt": now - 1}), now))
        self.assertFalse(state.verify_token(self.session_token({"username": "owner", "issuedAt": now + 60_001,
                                                               "expiresAt": now + 120_000}), now))
        self.assertFalse(state.verify_token(self.session_token({"username": "other", "issuedAt": now,
                                                               "expiresAt": now + 60_000}), now))
        self.assertFalse(state.verify_token(valid + ".extra", now))
        self.assertFalse(state.verify_token("malformed", now))
        self.assertFalse(state.verify_cookie("", now))
        self.assertFalse(state.verify_cookie("Authorization=Basic synthetic", now))

    def test_ingress_rejects_gateway_terminal_node_set_drift(self) -> None:
        os.chmod(self.inventory, 0o600)
        config = json.loads(self.gateway_config.read_text())
        config["nodes"].append({"id": "remote-a", "enabled": True})
        self.gateway_config.write_text(json.dumps(config))
        os.chmod(self.gateway_config, 0o600)
        with self.assertRaisesRegex(ingress.IngressError, "node set"):
            ingress.IngressState(self.inventory, self.gateway_config, self.root)

    def test_fleet_session_verifier_matches_shared_vectors(self) -> None:
        vectors = json.loads((ROOT / "test" / "session-vectors.json").read_text())
        config = json.loads(self.gateway_config.read_text())
        config["public"]["cookieName"] = vectors["cookieName"]
        config["auth"]["username"] = vectors["username"]
        config["auth"]["sessionSecret"] = vectors["sessionSecret"]
        self.gateway_config.write_text(json.dumps(config))
        os.chmod(self.gateway_config, 0o600)
        state = ingress.SessionAuth(str(self.gateway_config))
        for vector in vectors["vectors"]:
            self.assertEqual(state.verify_token(vector["token"], vectors["nowMs"]), vector["valid"], vector["name"])

    def test_landing_and_recovery_cli_have_no_manual_activation_path(self) -> None:
        page = (ROOT / "web" / "index.html").read_text()
        self.assertIn('terminal.setAttribute("src", "terminal/")', page)
        self.assertIn("(min-width: 1024px) and (hover: hover) and (pointer: fine)", page)
        self.assertIn('fetch("heartbeat"', page)
        self.assertIn('document.visibilityState === "visible"', page)
        self.assertNotIn("WebSocket(", page)
        cli = (ROOT / "ttyd-fallback").read_text()
        self.assertIn("export PYTHONDONTWRITEBYTECODE=1", cli)
        self.assertIn('exec "$python_bin" -B "$service_dir/controller.py" "$@"', cli)
        self.assertNotIn(" prepare", cli)
        self.assertNotIn(" enable", cli)

    def test_unknown_inventory_never_defaults(self) -> None:
        inventory = controller.load_inventory(self.inventory)
        with self.assertRaises(controller.ControllerError):
            controller.select_node(inventory, "unknown")

    def test_inventory_rejects_retired_enablement_and_url_fields(self) -> None:
        for field, value in (
            ("enabled", False),
            ("public_origin", "https://fleet.example.com"),
            ("public_path", "/ttyd/local-a"),
            ("control_identity", "/tmp/general-purpose-key"),
        ):
            inventory = json.loads(self.inventory.read_text())
            inventory["nodes"]["local-a"][field] = value
            self.inventory.write_text(json.dumps(inventory))
            with self.assertRaisesRegex(controller.ControllerError, "unknown fields"):
                controller.load_inventory(self.inventory)
            inventory["nodes"]["local-a"].pop(field)
            self.inventory.write_text(json.dumps(inventory))
        inventory = json.loads(self.inventory.read_text())
        inventory["schema"] = 2
        self.inventory.write_text(json.dumps(inventory))
        with self.assertRaisesRegex(controller.ControllerError, "unsupported inventory schema"):
            controller.load_inventory(self.inventory)

    def test_inventory_uses_one_forced_identity_for_ssh_control_and_data(self) -> None:
        inventory = json.loads(self.inventory.read_text())
        inventory["nodes"]["remote-a"] = {
            **inventory["nodes"]["local-a"],
            "transport": {
                "kind": "ssh",
                "host": "remote-a.example.com",
                "port": 22,
                "user": "operator",
                "identity": "ssh/remote-a",
                "known_hosts": "ssh/remote-a-known-hosts",
            },
        }
        self.inventory.write_text(json.dumps(inventory))
        loaded = controller.load_inventory(self.inventory)
        self.assertEqual(set(loaded["nodes"]), {"local-a", "remote-a"})
        self.assertNotIn("control_identity", loaded["nodes"]["remote-a"]["transport"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
