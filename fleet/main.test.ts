import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, test } from "bun:test";

import { TRUST_STORE_FILENAME, TrustStore } from "../bridge/pack/trust-store.ts";
import { main } from "./main.ts";

const secret = Buffer.alloc(32, 9).toString("base64url");

const PEER_TOML = `schema_version = 2
role = "peer"
[lifecycle]
mode = "native-pack"
pack_state = "collie"
[collie]
host = "127.0.0.1"
port = 19788
[transport]
mode = "ssh-reverse"
ssh_host = "lead.example.com"
ssh_port = 22
ssh_user = "fleet-tunnel"
identity_file = "/synthetic/fleet/id_ed25519"
known_hosts_file = "/synthetic/fleet/known_hosts"
lead_bind_host = "127.0.0.1"
lead_bind_port = 19791
peer_bind_host = "127.0.0.1"
peer_bind_port = 19790
lead_collie_host = "127.0.0.1"
lead_collie_port = 19788
retry_max_seconds = 60
`;

const LEAD_TOML = `schema_version = 1
role = "lead"
[listen]
host = "127.0.0.1"
port = 18787
[public]
origin = "https://fleet.example.com"
[collie]
host = "127.0.0.1"
port = 8787
[auth]
username = "operator"
password_hash = "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA"
session_secret = "${secret}"
session_ttl_seconds = 3600
`;

const roots: string[] = [];

async function fixture(toml: string): Promise<NodeJS.ProcessEnv> {
  const root = await mkdtemp(join(tmpdir(), "herdr-fleet-main-"));
  roots.push(root);
  const configPath = join(root, "fleet.toml");
  await writeFile(configPath, toml, { mode: 0o600 });
  await chmod(configPath, 0o600);
  return {
    HERDR_FLEET_CONFIG: configPath,
    HERDR_PLUGIN_STATE_DIR: root,
    HERDR_PLUGIN_ROOT: root,
    XDG_RUNTIME_DIR: root,
    HERDR_FLEET_GENERATION: "generation-a",
  };
}

/** Run one command with console captured, so an assertion can read exactly what it printed. */
async function run(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  stdin = "",
): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (...parts: unknown[]) => out.push(parts.join(" "));
  console.error = (...parts: unknown[]) => err.push(parts.join(" "));
  try {
    const code = await main(argv, env, Readable.from([stdin]));
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("herdr-fleet entrypoint", () => {
  test("config-check still answers for both roles", async () => {
    const lead = await run(["config-check"], await fixture(LEAD_TOML));
    expect(lead.code).toBe(0);
    expect(JSON.parse(lead.out)).toMatchObject({ ok: true, role: "lead", authentication: "password-session" });

    const peer = await run(["config-check"], await fixture(PEER_TOML));
    expect(peer.code).toBe(0);
    expect(JSON.parse(peer.out)).toMatchObject({ ok: true, role: "peer", authentication: "none" });
  });

  test("a token passed as an argument is refused, and the refusal names both accepted forms", async () => {
    const env = await fixture(PEER_TOML);
    const result = await run(
      ["pack-join", "--lead", "http://127.0.0.1:19790", "--address", "127.0.0.1:19791", "a-real-token"],
      env,
    );
    expect(result.code).toBe(1);
    expect(result.err).toContain("must not be an argument");
    expect(result.err).toContain("`-`");
    expect(result.err).toContain("@<file>");
    // The refusal must not echo the value it refused.
    expect(result.err).not.toContain("a-real-token");
    // And nothing was written on the way to refusing.
    expect(await new TrustStore(join(env.HERDR_PLUGIN_STATE_DIR ?? "", "collie")).load()).toBeNull();
  });

  test("each command refuses the role it does not belong to, writing nothing", async () => {
    const peerEnv = await fixture(PEER_TOML);
    const invite = await run(["pack-invite"], peerEnv);
    expect(invite.code).toBe(1);
    expect(invite.err).toContain("minted on a lead");
    expect(await new TrustStore(join(peerEnv.HERDR_PLUGIN_STATE_DIR ?? "", "collie")).load()).toBeNull();

    const leadEnv = await fixture(LEAD_TOML);
    const join_ = await run(
      ["pack-join", "--lead", "http://127.0.0.1:19790", "--address", "127.0.0.1:19791", "-"],
      leadEnv,
      "token\n",
    );
    expect(join_.code).toBe(1);
    expect(join_.err).toContain("spent on a peer");
    expect(await new TrustStore(join(leadEnv.HERDR_PLUGIN_STATE_DIR ?? "", "collie")).load()).toBeNull();
  });

  test("pack-invite prints the token once, on stdout, and names the restart", async () => {
    const env = await fixture(LEAD_TOML);
    const result = await run(["pack-invite", "--label", "peer"], env);
    expect(result.code).toBe(0);

    const token = result.out.trim();
    expect(token).not.toBe("");
    // Everything else the operator sees is guidance, and none of it repeats the token.
    expect(result.err).not.toContain(token);
    expect(result.err).toContain("single-use");
    expect(result.err).toContain("herdr plugin action invoke restart --plugin memset0.herdr-fleet");
    expect(result.err).not.toContain("systemctl");
    expect(result.err).not.toContain("collie pack");

    const stateDir = join(env.HERDR_PLUGIN_STATE_DIR ?? "", "collie");
    const data = await new TrustStore(stateDir).load();
    expect(data?.invites).toHaveLength(1);
    expect(await Bun.file(join(stateDir, TRUST_STORE_FILENAME)).text()).not.toContain(token);
  });

  test("an unknown command prints usage and neither command is a Collie verb", async () => {
    const result = await run(["pack-rotate"], await fixture(LEAD_TOML));
    expect(result.code).toBe(2);
    expect(result.err).toContain("usage: herdr-fleet");
    expect(result.err).toContain("pack-invite");
    expect(result.err).toContain("pack-join");
  });
});
