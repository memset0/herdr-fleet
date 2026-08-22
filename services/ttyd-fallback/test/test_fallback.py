#!/usr/bin/env python3

from __future__ import annotations

import base64
import grp
import hashlib
import hmac
import importlib.util
import json
import os
import pathlib
import pwd
import socket
import threading
import subprocess
import sys
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


node = load("node")
auth_helper = load("auth_helper")
controller = load("controller")


class FallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="herdr-ttyd-test-")
        self.root = pathlib.Path(self.temp.name)
        self.runtime = self.root / "runtime"
        self.server_socket = self.root / "existing-herdr.sock"
        self.server_socket.touch()
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
        config = {"id": "synthetic", "owner": pwd.getpwuid(os.geteuid()).pw_name,
                  "host_exact": socket.gethostname().split(".")[0], "herdr": str(self.herdr),
                  "session": None, "server_socket": str(self.server_socket),
                  "runtime_dir": str(self.runtime), "public_host": "synthetic.invalid",
                  "ttyd": str(self.ttyd),
                  "ttyd_version_output": "ttyd version 1.7.7-40e79c7"}
        self.config.write_text(json.dumps(config))
        self.inventory.write_text(json.dumps({
            "schema": 1,
            "nodes": {
                "local-a": {
                    "enabled": True,
                    "architecture": "x86_64",
                    "owner": pwd.getpwuid(os.geteuid()).pw_name,
                    "python": sys.executable,
                    "host_exact": socket.gethostname().split(".")[0],
                    "herdr": str(self.herdr),
                    "session": None,
                    "server_socket": str(self.server_socket),
                    "runtime_dir": str(self.runtime),
                    "install_root": str(self.root / "install"),
                    "public_origin": "https://fleet.example.com",
                    "public_path": "/ttyd/local-a",
                    "transport": {"kind": "local"},
                }
            },
        }))
        self.gateway_config.write_text(json.dumps({
            "public": {"fleetHost": "fleet.example.com", "baseDomain": "example.com",
                       "cookieName": "__Secure-synthetic", "sessionTtlSeconds": 3600},
            "auth": {"username": "owner", "passwordHash": "$argon2id$synthetic",
                     "sessionSecret": base64.urlsafe_b64encode(self.session_secret).rstrip(b"=").decode()},
        }))
        os.chmod(self.gateway_config, 0o600)

    def tearDown(self) -> None:
        subprocess.run([sys.executable, str(ROOT / "node.py"), "--config", str(self.config), "stop"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        self.temp.cleanup()

    def run_node(self, *arguments: str, expected: int = 0) -> subprocess.CompletedProcess[str]:
        result = subprocess.run([sys.executable, str(ROOT / "node.py"), "--config", str(self.config), *arguments],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        self.assertEqual(result.returncode, expected, result.stderr)
        return result

    def test_preflight_resolves_only_existing_terminal(self) -> None:
        data = json.loads(self.run_node("preflight", "--pane", "w1:p1").stdout)
        self.assertEqual(data["pane_id"], "w1:p1")
        bad = self.run_node("preflight", "--pane", "w9:p9", expected=1)
        self.assertIn("does not resolve", bad.stderr)

    def test_start_is_fixed_one_client_client_only_and_stops(self) -> None:
        self.run_node("start", "--activation-id", "synthetic-lease", "--lease", "30")
        status = json.loads(self.run_node("status").stdout)
        self.assertTrue(status["active"])
        arguments = json.loads(self.args_log.read_text())
        self.assertIn("--auth-header", arguments)
        self.assertIn("--check-origin", arguments)
        self.assertEqual(arguments[arguments.index("--max-clients") + 1], "1")
        self.assertNotIn("--url-arg", arguments)
        self.assertEqual(arguments[-3:], ["terminal", "attach", "term_synthetic1"])
        self.run_node("stop")
        self.assertFalse((self.runtime / "ttyd.sock").exists())
        self.run_node("status", expected=3)

    def test_missing_server_fails_before_runtime(self) -> None:
        text = self.herdr.read_text().replace('"running": True', '"running": False')
        self.herdr.write_text(text)
        result = self.run_node("start", "--activation-id", "missing", "--lease", "30", expected=1)
        self.assertIn("not running", result.stderr)
        self.assertFalse(self.runtime.exists())

    def test_host_and_scheduler_gates(self) -> None:
        cfg = json.loads(self.config.read_text())
        cfg["host_exact"] = "wrong-host"
        self.config.write_text(json.dumps(cfg))
        self.assertIn("host gate", self.run_node("preflight", expected=1).stderr)
        cfg["host_exact"] = socket.gethostname().split(".")[0]
        cfg["reject_slurm"] = True
        self.config.write_text(json.dumps(cfg))
        env = os.environ.copy()
        env["SLURM_JOB_ID"] = "synthetic"
        result = subprocess.run([sys.executable, str(ROOT / "node.py"), "--config", str(self.config), "preflight"],
                                env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("scheduler-job", result.stderr)

    def session_token(self, payload: dict[str, object], secret: bytes | None = None) -> str:
        encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
        signature = base64.urlsafe_b64encode(
            hmac.new(secret or self.session_secret, encoded.encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        return f"{encoded}.{signature}"

    def test_fleet_session_verifier_matches_gateway_contract(self) -> None:
        state = auth_helper.SessionAuth(str(self.gateway_config))
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

    def test_fleet_session_verifier_matches_shared_vectors(self) -> None:
        vectors = json.loads((ROOT / "test" / "session-vectors.json").read_text())
        config = json.loads(self.gateway_config.read_text())
        config["public"]["cookieName"] = vectors["cookieName"]
        config["auth"]["username"] = vectors["username"]
        config["auth"]["sessionSecret"] = vectors["sessionSecret"]
        self.gateway_config.write_text(json.dumps(config))
        os.chmod(self.gateway_config, 0o600)
        state = auth_helper.SessionAuth(str(self.gateway_config))
        for vector in vectors["vectors"]:
            self.assertEqual(state.verify_token(vector["token"], vectors["nowMs"]), vector["valid"], vector["name"])

    def test_auth_http_ignores_basic_and_accepts_only_fleet_cookie(self) -> None:
        path = self.root / "auth.sock"
        server = auth_helper.UnixHTTPServer(str(path), auth_helper.Handler)
        server.auth = auth_helper.SessionAuth(str(self.gateway_config))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def request(headers: str) -> bytes:
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(str(path))
            client.sendall(f"GET /verify HTTP/1.1\r\nHost: localhost\r\n{headers}\r\n".encode())
            response = b""
            while b"\r\n\r\n" not in response:
                response += client.recv(4096)
            client.close()
            return response

        try:
            basic = request("Authorization: Basic c3ludGhldGljOnBhc3N3b3Jk\r\n")
            self.assertTrue(basic.startswith(b"HTTP/1.0 401"))
            self.assertNotIn(b"WWW-Authenticate", basic)
            now = int(time.time() * 1000)
            token = self.session_token({"username": "owner", "issuedAt": now, "expiresAt": now + 60_000})
            accepted = request(f"Cookie: __Secure-synthetic={token}\r\nAuthorization: Basic ignored\r\n")
            self.assertTrue(accepted.startswith(b"HTTP/1.0 200"))
            self.assertIn(b"X-Herdr-Fallback-User: owner", accepted)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_caddy_and_desktop_contract(self) -> None:
        inventory = controller.load_inventory(self.inventory)
        selected = controller.select_node(inventory, "local-a")
        fragment = controller.caddy_fragment(selected, pathlib.Path("/run/synthetic"), pathlib.Path("/var/lib/synthetic"), 2000000000)
        self.assertIn("forward_auth unix//", fragment)
        self.assertIn("host fleet.example.com", fragment)
        self.assertIn("path /ttyd/local-a/*", fragment)
        self.assertIn("uri strip_prefix /ttyd/local-a", fragment)
        self.assertIn("not header Origin https://fleet.example.com", fragment)
        self.assertIn("int({time.now.unix}) >= 2000000000", fragment)
        self.assertIn("request_header -Authorization", fragment)
        self.assertIn("request_header -X-Herdr-Fallback-User", fragment)
        self.assertIn("request_header -Cookie", fragment)
        self.assertIn("request_header X-Forwarded-For {http.request.remote.host}", fragment)
        self.assertIn("handle /terminal*", fragment)
        page = (ROOT / "web" / "index.html").read_text()
        self.assertIn('href="terminal/"', page)
        self.assertIn("(min-width: 1024px) and (hover: hover) and (pointer: fine)", page)
        self.assertNotIn("fetch(", page)
        self.assertNotIn("WebSocket(", page)
        cli = (ROOT / "ttyd-fallback").read_text()
        self.assertIn("export PYTHONDONTWRITEBYTECODE=1", cli)
        self.assertIn('exec "$python_bin" -B "$service_dir/controller.py" "$@"', cli)

    def test_unknown_inventory_never_defaults(self) -> None:
        inventory = controller.load_inventory(self.inventory)
        with self.assertRaises(controller.ControllerError):
            controller.select_node(inventory, "unknown")

    def test_inventory_requires_exact_shared_origin_node_path(self) -> None:
        for field, value, message in (
            ("public_origin", "http://fleet.example.com", "exact HTTPS origin"),
            ("public_origin", "https://fleet.example.com:8443", "exact HTTPS origin"),
            ("public_origin", "https://operator@fleet.example.com", "exact HTTPS origin"),
            ("public_origin", "https://fleet.example.com/path", "exact HTTPS origin"),
            ("public_path", "/ttyd/other", "/ttyd/local-a"),
            ("public_path", "/ttyd/local-a/../other", "/ttyd/local-a"),
        ):
            inventory = json.loads(self.inventory.read_text())
            inventory["nodes"]["local-a"][field] = value
            self.inventory.write_text(json.dumps(inventory))
            with self.assertRaisesRegex(controller.ControllerError, message):
                controller.load_inventory(self.inventory)
            inventory["nodes"]["local-a"][field] = (
                "https://fleet.example.com" if field == "public_origin" else "/ttyd/local-a"
            )
            self.inventory.write_text(json.dumps(inventory))

    def test_inventory_requires_explicit_control_identity_for_ssh(self) -> None:
        inventory = json.loads(self.inventory.read_text())
        inventory["nodes"]["remote-a"] = {
            **inventory["nodes"]["local-a"],
            "public_path": "/ttyd/remote-a",
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
        with self.assertRaisesRegex(controller.ControllerError, "control_identity"):
            controller.load_inventory(self.inventory)

    def test_disabled_inventory_entries_remain_dormant(self) -> None:
        inventory = json.loads(self.inventory.read_text())
        inventory["nodes"]["disabled-a"] = {**inventory["nodes"]["local-a"], "enabled": False,
                                               "public_path": "/ttyd/disabled-a"}
        self.inventory.write_text(json.dumps(inventory))
        loaded = controller.load_inventory(pathlib.Path(self.inventory))
        live_root = self.root / "live"
        controller.write_node_configs(loaded, live_root)
        self.assertTrue((live_root / "nodes" / "local-a.json").exists())
        self.assertFalse((live_root / "nodes" / "disabled-a.json").exists())

    def test_enable_cleans_node_when_central_setup_fails(self) -> None:
        inventory = controller.load_inventory(self.inventory)
        caddy = self.root / "Caddyfile"
        caddy.write_text("import /synthetic/*.caddy\n")
        calls: list[list[str]] = []

        def node_call(_node, _live_root, arguments, timeout=20):
            calls.append(arguments)
            if arguments[0] == "preflight":
                return subprocess.CompletedProcess([], 0, json.dumps({"pane_id": "w1:p1"}), "")
            if arguments[0] == "start":
                return subprocess.CompletedProcess([], 0, json.dumps({"deadline": int(time.time()) + 30}), "")
            return subprocess.CompletedProcess([], 0, json.dumps({"active": False}), "")

        args = SimpleNamespace(
            lease=30, node="local-a", pane=None, live_root=str(self.root / "live"),
            runtime_root=str(self.root / "central-runtime"), state_root=str(self.root / "state"),
            caddy_config=str(caddy), caddy_import="import /synthetic/*.caddy",
            caddy_fragment=str(self.root / "fragment.caddy"), landing_root=str(self.root / "landing"),
            proxy_group="missing-synthetic-group", inventory=str(self.inventory),
            session_config=str(self.gateway_config),
        )
        modules = subprocess.CompletedProcess([], 0, "http.handlers.headers\nhttp.handlers.reverse_proxy\n", "")
        with mock.patch.object(controller, "node_command", side_effect=node_call), \
             mock.patch.object(controller.subprocess, "run", return_value=modules), \
             mock.patch.object(controller, "caddy_apply"):
            with self.assertRaises(KeyError):
                controller.enable(args, inventory)
        self.assertEqual([call[0] for call in calls], ["preflight", "start", "stop"])

    def test_enable_records_all_components_on_success(self) -> None:
        inventory = controller.load_inventory(self.inventory)
        caddy = self.root / "Caddyfile"
        caddy.write_text("import /synthetic/*.caddy\n")
        live = self.root / "live"
        live.mkdir()
        runtime = self.root / "central-runtime"
        state_root = self.root / "state"
        calls: list[list[str]] = []

        def node_call(_node, _live_root, arguments, timeout=20):
            calls.append(arguments)
            if arguments[0] == "preflight":
                payload = {"pane_id": "w1:p1"}
            elif arguments[0] == "start":
                payload = {"deadline": int(time.time()) + 30}
            else:
                payload = {"active": False}
            return subprocess.CompletedProcess([], 0, json.dumps(payload), "")

        processes = []
        process_commands: list[list[str]] = []

        def popen(command, **_kwargs):
            process_commands.append(command)
            process = mock.Mock(pid=1000 + len(processes))
            process.poll.return_value = None
            processes.append(process)
            if "stdio_broker.py" in command[1]:
                runtime.mkdir(parents=True, exist_ok=True)
                (runtime / "upstream.sock").touch()
            elif "auth_helper.py" in command[1]:
                (runtime / "auth.sock").touch()
            return process

        components = iter([
            {"pid": 1000, "start": "1", "marker": "stdio_broker.py"},
            {"pid": 1001, "start": "2", "marker": "auth_helper.py"},
            {"pid": 1002, "start": "3", "marker": "_expire"},
        ])
        args = SimpleNamespace(
            lease=30, node="local-a", pane=None, live_root=str(live),
            runtime_root=str(runtime), state_root=str(state_root),
            caddy_config=str(caddy), caddy_import="import /synthetic/*.caddy",
            caddy_fragment=str(self.root / "fragment.caddy"), landing_root=str(self.root / "landing"),
            proxy_group=grp.getgrgid(os.getegid()).gr_name, inventory=str(self.inventory),
            session_config=str(self.gateway_config),
        )
        modules = subprocess.CompletedProcess([], 0, "http.handlers.headers\nhttp.handlers.reverse_proxy\n", "")
        with mock.patch.object(controller, "node_command", side_effect=node_call), \
             mock.patch.object(controller.subprocess, "run", return_value=modules), \
             mock.patch.object(controller.subprocess, "Popen", side_effect=popen), \
             mock.patch.object(controller.os, "chown"), \
             mock.patch.object(controller, "component", side_effect=lambda *_args: next(components)), \
             mock.patch.object(controller, "unix_http_status", side_effect=[200, 401, 200]), \
             mock.patch.object(controller, "caddy_apply"):
            controller.enable(args, inventory)

        state = json.loads((state_root / "active.json").read_text())
        self.assertEqual(state["broker"]["marker"], "stdio_broker.py")
        self.assertEqual(state["auth"]["marker"], "auth_helper.py")
        self.assertEqual(state["guard"]["marker"], "_expire")
        self.assertEqual([call[0] for call in calls], ["preflight", "start"])
        auth_command = next(command for command in process_commands if "auth_helper.py" in command[1])
        self.assertIn("--gateway-config", auth_command)
        self.assertNotIn("--username", auth_command)
        self.assertNotIn("--verifier", auth_command)


if __name__ == "__main__":
    unittest.main(verbosity=2)
