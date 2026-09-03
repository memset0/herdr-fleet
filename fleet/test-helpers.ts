import {
  parseFleetToml,
  type FleetSchema1LeadConfig,
  type FleetSchema2LeadConfig,
  type FleetSchema2PeerConfig,
} from "./config.ts";

export function fleetTestConfig(): FleetSchema1LeadConfig {
  const config = parseFleetToml(`schema_version = 1
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
session_secret = "${Buffer.alloc(32, 11).toString("base64url")}"
session_ttl_seconds = 3600
[auth.rate_limit]
max_failures = 2
window_seconds = 10
block_seconds = 20
max_sources = 2
aggregate_max_failures = 4
aggregate_window_seconds = 10
aggregate_block_seconds = 30
[proxy]
client_ip_header = "X-Forwarded-For"
`);
  if (config.schemaVersion !== 1) throw new Error("test configuration did not parse as schema 1");
  return config;
}

export function fleetTestPackLeadConfig(): FleetSchema2LeadConfig {
  const config = parseFleetToml(`schema_version = 2
role = "lead"
[lifecycle]
mode = "native-pack"
pack_state = "collie"
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
session_secret = "${Buffer.alloc(32, 12).toString("base64url")}"
session_ttl_seconds = 3600
[proxy]
client_ip_header = "X-Forwarded-For"
[[reachability]]
member_id = "peer-a"
host = "127.0.0.1"
port = 18901
`);
  if (config.schemaVersion !== 2 || config.role !== "lead") {
    throw new Error("test configuration did not parse as schema 2 lead");
  }
  return config;
}

export function fleetTestPackPeerConfig(): FleetSchema2PeerConfig {
  const config = parseFleetToml(`schema_version = 2
role = "peer"
[lifecycle]
mode = "native-pack"
pack_state = "collie"
[collie]
host = "::1"
port = 8787
[transport]
mode = "ssh-reverse"
ssh_host = "lead.example.com"
ssh_port = 22
ssh_user = "fleet-tunnel"
identity_file = "/synthetic/fleet/id_ed25519"
known_hosts_file = "/synthetic/fleet/known_hosts"
lead_bind_host = "127.0.0.1"
lead_bind_port = 18901
peer_bind_host = "::1"
peer_bind_port = 18902
lead_collie_host = "127.0.0.1"
lead_collie_port = 8787
retry_max_seconds = 60
`);
  if (config.schemaVersion !== 2 || config.role !== "peer") {
    throw new Error("test configuration did not parse as schema 2 peer");
  }
  return config;
}
