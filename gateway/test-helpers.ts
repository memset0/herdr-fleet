import { parseGatewayConfig, type GatewayConfig } from "./config.ts";

export const TEST_SECRET = Buffer.alloc(48, 7).toString("base64url");

export function rawGatewayConfig(): Record<string, unknown> {
  return {
    listen: { host: "127.0.0.1", port: 18787 },
    public: {
      scheme: "https",
      fleetHost: "fleet.example.com",
      baseDomain: "example.com",
      cookieName: "herdr_web_session",
      sessionTtlSeconds: 3_600,
    },
    auth: {
      username: "operator",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA",
      sessionSecret: TEST_SECRET,
    },
    pollIntervalMs: 5_000,
    nodes: [
      {
        id: "local",
        name: "Local node",
        publicHost: "local.example.com",
        enabled: true,
        labels: ["test"],
        transport: { type: "local", url: "http://127.0.0.1:18788" },
      },
    ],
  };
}

export function gatewayConfig(): GatewayConfig {
  return parseGatewayConfig(rawGatewayConfig());
}
