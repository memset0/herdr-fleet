import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";

/**
 * Which `herdr` executable Fleet runs — one answer for every place that runs it.
 *
 * A plugin's processes inherit the Herdr server's environment, and that `PATH` is whatever the
 * server was launched with: it can omit the directory Herdr was installed in. Herdr states its own
 * executable as `HERDR_BIN_PATH` for exactly that reason, so the stated binary comes first and `PATH`
 * is the fallback. The stated value is checked rather than trusted, so a stale one falls back
 * instead of producing a service that starts and then fails at its first spawn.
 *
 * The terminal attach and the manual Pane fit both take their binary from here, which is what keeps
 * them driving the same Herdr on one machine. Nothing here reads configuration or a request.
 */

export const HERDR_COMMAND_NAME = "herdr";
export const HERDR_BIN_PATH_ENV = "HERDR_BIN_PATH";

export type HerdrCommand =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly diagnostic: string };

export interface HerdrCommandDeps {
  readonly env?: NodeJS.ProcessEnv;
  /** `PATH` lookup against the given search path. */
  readonly which?: (name: string, searchPath: string) => string | null;
  /** Is this absolute path an executable regular file? */
  readonly isExecutable?: (path: string) => boolean;
}

function executableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function whichOnPath(name: string, searchPath: string): string | null {
  return Bun.which(name, { PATH: searchPath });
}

/** Why the stated binary was not used, or `null` when it is usable. */
function statedBinaryProblem(stated: string, isExecutable: (path: string) => boolean): string | null {
  if (!isAbsolute(stated)) return `${HERDR_BIN_PATH_ENV} (${stated}) is not an absolute path`;
  if (!isExecutable(stated)) return `${HERDR_BIN_PATH_ENV} (${stated}) is not an executable file`;
  return null;
}

export function resolveHerdrCommand(deps: HerdrCommandDeps = {}): HerdrCommand {
  const env = deps.env ?? process.env;
  const which = deps.which ?? whichOnPath;
  const isExecutable = deps.isExecutable ?? executableFile;

  const stated = env[HERDR_BIN_PATH_ENV]?.trim() ?? "";
  const statedProblem = stated === "" ? `${HERDR_BIN_PATH_ENV} is not set` : statedBinaryProblem(stated, isExecutable);
  if (statedProblem === null) return { ok: true, path: stated };

  const found = which(HERDR_COMMAND_NAME, env.PATH ?? "");
  if (found !== null && isAbsolute(found) && isExecutable(found)) return { ok: true, path: found };
  const pathProblem =
    found === null
      ? `no ${HERDR_COMMAND_NAME} on PATH`
      : `${HERDR_COMMAND_NAME} on PATH (${found}) is not an absolute executable file`;

  return {
    ok: false,
    diagnostic: `the ${HERDR_COMMAND_NAME} command was not found: ${statedProblem}, and ${pathProblem}`,
  };
}
