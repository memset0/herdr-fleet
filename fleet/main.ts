import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath } from "./config.ts";

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (argv[0] !== "config-check" || argv.length !== 1) {
    console.error("usage: herdr-fleet config-check");
    return 2;
  }
  try {
    const config = await loadFleetConfig(resolveFleetConfigPath(env));
    console.log(JSON.stringify(
      isFleetLeadConfig(config)
        ? {
            ok: true,
            role: config.role,
            publicOrigin: config.public.origin,
            gateway: config.listen,
            collie: config.collie,
            authentication: "password-session",
          }
        : {
            ok: true,
            role: config.role,
            lifecycle: config.lifecycle,
            collie: config.collie,
            authentication: "none",
          },
    ));
    return 0;
  } catch (error) {
    console.error(`herdr-fleet: ${error instanceof Error ? error.message : "configuration failed"}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
