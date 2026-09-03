import { parseFleetToml, type FleetConfig } from "./config.ts";

export function fleetTestConfig(): FleetConfig {
  return parseFleetToml(`schema_version = 1
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
}
