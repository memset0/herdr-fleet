import { readFile } from "node:fs/promises";

import { isFleetLeadConfig, loadFleetConfig, resolveFleetConfigPath, type FleetConfig } from "./config.ts";
import { joinPack, mintPeerInvite } from "./pack-enrollment.ts";
import { resolveRuntimePaths } from "./runtime.ts";

const USAGE = [
  "usage: herdr-fleet config-check",
  "       herdr-fleet pack-invite [--label <name>]",
  "       herdr-fleet pack-join --lead <origin> --address <host:port> [--label <name>] (- | @<file>)",
].join("\n");

/** The plugin restart that carries a persisted membership change into the running runtime. */
const RESTART_HINT =
  "  apply it to the running runtime:\n" +
  "    herdr plugin action invoke restart --plugin memset0.herdr-fleet";

function configCheck(config: FleetConfig): string {
  return JSON.stringify(
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
  );
}

/** `--flag value` pairs plus bare positionals, in the one spelling both commands share. */
interface ParsedArgs {
  readonly flags: Map<string, string>;
  readonly positional: readonly string[];
}

function parseFlags(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value`);
    flags.set(argument.slice(2), value);
    index += 1;
  }
  return { flags, positional };
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The invite token, from standard input or an owner-only file and from nowhere else.
 *
 * `/proc/<pid>/cmdline` is world-readable, so a token passed as an argument is a token every local
 * uid can read for as long as the process lives (PACK_PROTOCOL.md §8.3). The refusal names both
 * accepted forms rather than just declining.
 */
async function readToken(source: string | undefined, stdin: NodeJS.ReadableStream): Promise<string> {
  if (source === undefined) throw new Error("no token supplied — pass `-` to read stdin, or `@<file>`");
  if (source === "-") return (await readAll(stdin)).trim();
  if (source.startsWith("@")) return (await readFile(source.slice(1), "utf8")).trim();
  throw new Error(
    "a token must not be an argument — every local uid can read it there. Pass `-` to read stdin, or `@<file>`",
  );
}

async function packInvite(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  const { flags } = parseFlags(argv);
  const config = await loadFleetConfig(resolveFleetConfigPath(env));
  if (!isFleetLeadConfig(config)) throw new Error("an invite is minted on a lead, and this is a peer");
  const paths = resolveRuntimePaths(env);
  const minted = await mintPeerInvite({
    collieStateDir: paths.collieStateDir,
    selfId: "lead",
    label: flags.get("label") ?? null,
  });
  // Shown once, and only here: the store keeps its hash, never the token.
  console.log(minted.token);
  console.error(`  single-use · expires ${new Date(minted.expiresAt).toISOString()}`);
  console.error(RESTART_HINT);
  console.error("  then spend it on the peer:");
  console.error("    herdr-fleet pack-join --lead <origin> --address <host:port> -");
  return 0;
}

async function packJoin(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  stdin: NodeJS.ReadableStream,
): Promise<number> {
  const { flags, positional } = parseFlags(argv);
  const config = await loadFleetConfig(resolveFleetConfigPath(env));
  if (isFleetLeadConfig(config)) throw new Error("an invite is spent on a peer, and this is a lead");
  const lead = flags.get("lead");
  const address = flags.get("address");
  if (lead === undefined || address === undefined) throw new Error("pack-join needs --lead and --address");
  const paths = resolveRuntimePaths(env);
  const token = await readToken(positional[0], stdin);
  if (token === "") throw new Error("the supplied token was empty");
  const response = await joinPack({
    collieStateDir: paths.collieStateDir,
    selfId: "peer",
    leadOrigin: lead,
    address,
    token,
    label: flags.get("label") ?? null,
  });
  console.log(JSON.stringify({ ok: true, memberId: response.memberId, lead: response.leadMemberId }));
  console.error(RESTART_HINT);
  return 0;
}

export async function main(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  stdin: NodeJS.ReadableStream = process.stdin,
): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "config-check" && rest.length === 0) {
      console.log(configCheck(await loadFleetConfig(resolveFleetConfigPath(env))));
      return 0;
    }
    if (command === "pack-invite") return await packInvite(rest, env);
    if (command === "pack-join") return await packJoin(rest, env, stdin);
    console.error(USAGE);
    return 2;
  } catch (error) {
    console.error(`herdr-fleet: ${error instanceof Error ? error.message : "operation failed"}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
