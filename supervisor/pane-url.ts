import { spawnSync } from "node:child_process";
import { basename, dirname } from "node:path";

import { loadPluginEnv, PLUGIN_ID } from "./runtime.ts";

const INSTANCE_ID = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PANE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const TARGET_PANE_ENV = "HERDR_WEB_REMOTE_TARGET_PANE";
const TARGET_SESSION_ENV = "HERDR_WEB_REMOTE_TARGET_SESSION";
const POPUP_ENTRYPOINT = "copy-pane-url";
const POPUP_DRAIN_MS = 200;

type Environment = Readonly<Record<string, string | undefined>>;
type EnvLoader = (
  configDir: string,
  inherited: NodeJS.ProcessEnv,
) => Promise<NodeJS.ProcessEnv>;

interface CommandResult {
  error?: Error;
  status: number | null;
}

type CommandRunner = (
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => CommandResult;

export interface FleetPaneUrlInput {
  fleetUrl: string;
  instanceId: string;
  paneId: string;
  session?: string;
}

export class PaneUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaneUrlError";
  }
}

function fail(message: string): never {
  throw new PaneUrlError(message);
}

function requiredValue(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  return normalized || fail(message);
}

export function normalizeFleetUrl(value: string | undefined): string {
  const raw = requiredValue(value, "Fleet URL is not configured");
  if (raw.length > 2_048) fail("Fleet URL is invalid");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail("Fleet URL is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.hostname.length > 253 ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    fail("Fleet URL must be an HTTPS origin root without credentials, query, or fragment");
  }
  return `${parsed.origin}/`;
}

export function normalizeInstanceId(value: string | undefined): string {
  const normalized = requiredValue(value, "Web Remote instance id is not configured");
  if (!INSTANCE_ID.test(normalized)) fail("Web Remote instance id is invalid");
  return normalized;
}

export function normalizePaneId(value: string | undefined): string {
  const normalized = requiredValue(value, "focused Pane id is unavailable");
  if (!PANE_ID.test(normalized)) fail("focused Pane id is invalid");
  return normalized;
}

export function normalizeSessionName(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "default") return undefined;
  if (normalized.length > 128 || CONTROL_CHARACTER.test(normalized)) {
    fail("Herdr session name is invalid");
  }
  return normalized;
}

export function sessionNameFromRuntime(env: Environment): string | undefined {
  if (env.HERDR_SESSION?.trim()) return normalizeSessionName(env.HERDR_SESSION);

  const socketPath = env.HERDR_SOCKET_PATH?.trim();
  if (!socketPath || basename(socketPath) !== "herdr.sock") return undefined;
  const sessionDir = dirname(socketPath);
  if (basename(dirname(sessionDir)) !== "sessions") return undefined;
  return normalizeSessionName(basename(sessionDir));
}

export function buildFleetPaneUrl(input: FleetPaneUrlInput): string {
  const url = new URL(normalizeFleetUrl(input.fleetUrl));
  url.searchParams.set("instance", normalizeInstanceId(input.instanceId));
  url.searchParams.set("pane", normalizePaneId(input.paneId));
  const session = normalizeSessionName(input.session);
  if (session) url.searchParams.set("session", session);
  return url.toString();
}

export function osc52ClipboardSequence(value: string): string {
  return `\u001b]52;c;${Buffer.from(value, "utf8").toString("base64")}\u0007`;
}

export function popupOpenArgs(paneId: string, session?: string): string[] {
  const args = [
    "plugin",
    "pane",
    "open",
    "--plugin",
    PLUGIN_ID,
    "--entrypoint",
    POPUP_ENTRYPOINT,
    "--placement",
    "popup",
    "--env",
    `${TARGET_PANE_ENV}=${normalizePaneId(paneId)}`,
  ];
  const normalizedSession = normalizeSessionName(session);
  if (normalizedSession) {
    args.push("--env", `${TARGET_SESSION_ENV}=${normalizedSession}`);
  }
  return args;
}

async function configuredPaneUrl(
  env: Environment,
  paneId: string,
  session: string | undefined,
  loadEnv: EnvLoader,
): Promise<string> {
  const configDir = requiredValue(env.HERDR_PLUGIN_CONFIG_DIR, "plugin config directory is unavailable");
  let configured: NodeJS.ProcessEnv;
  try {
    configured = await loadEnv(configDir, { ...env });
  } catch {
    return fail("protected plugin configuration could not be read");
  }
  return buildFleetPaneUrl({
    fleetUrl: configured.HERDR_WEB_FLEET_URL ?? "",
    instanceId: configured.HERDR_WEB_INSTANCE_ID ?? "",
    paneId,
    session,
  });
}

const defaultRunner: CommandRunner = (binary, args, env) => {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
  return { error: result.error, status: result.status };
};

export async function runCopyAction(
  env: Environment,
  run: CommandRunner = defaultRunner,
  loadEnv: EnvLoader = loadPluginEnv,
): Promise<void> {
  const paneId = normalizePaneId(env.HERDR_PANE_ID);
  const session = sessionNameFromRuntime(env);
  await configuredPaneUrl(env, paneId, session, loadEnv);

  const binary = env.HERDR_BIN_PATH?.trim() || "herdr";
  const result = run(binary, popupOpenArgs(paneId, session), { ...env });
  if (result.error || result.status !== 0) {
    fail(`Herdr could not open the clipboard popup (exit ${result.status ?? "unavailable"})`);
  }
}

export async function runCopyPopup(
  env: Environment,
  write: (sequence: string) => void | Promise<void>,
  drain: () => Promise<void> = () => Bun.sleep(POPUP_DRAIN_MS),
  loadEnv: EnvLoader = loadPluginEnv,
): Promise<string> {
  const paneId = normalizePaneId(env[TARGET_PANE_ENV]);
  const session = normalizeSessionName(env[TARGET_SESSION_ENV]);
  const url = await configuredPaneUrl(env, paneId, session, loadEnv);
  await write(osc52ClipboardSequence(url));
  await drain();
  return url;
}

async function writeStdout(value: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(value, (error) => (error ? reject(error) : resolve()));
  });
}

async function main(): Promise<number> {
  try {
    const mode = process.argv[2];
    if (mode === "action") await runCopyAction(process.env);
    else if (mode === "copy") await runCopyPopup(process.env, writeStdout);
    else fail("expected action or copy mode");
    return 0;
  } catch (error) {
    const message = error instanceof PaneUrlError ? error.message : "unexpected clipboard helper failure";
    process.stderr.write(`web-remote: ${message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
