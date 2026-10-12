import { join } from "node:path";

import {
  coerceSttFile,
  namedSttProvider,
  STT_ENV_KEYS,
  STT_FILENAME,
  sttEnvSettings,
  writeSttSettingsFile,
} from "../bridge/stt/config.ts";
import type { JsonValue } from "../bridge/json.ts";
import {
  createWhistleModelStore,
  whistleEngineInPlace,
  type WhistleDescription,
  type WhistleModelDeps,
  type WhistleModelStore,
} from "../bridge/stt/whistle-model.ts";
import { WHISTLE_MODEL } from "../bridge/stt/whistle-pins.ts";
import { collieVersionBare, type Environment } from "./context.ts";
import { parseCrewArgs } from "./crew.ts";
import { type Finding, ok, warn } from "./finding.ts";
import { EXIT } from "./io.ts";
import type { SttDeps } from "./stt.ts";
import type { Files } from "./sys.ts";

// `collie stt whistle [--host] [--from <path>] [--remove] [--yes]` — the terminal half of Whistle
// (ADR 0096 Decisions 2 to 4). The model is fetched by this verb or by a tap in Settings, and nothing
// else; both come through `bridge/stt/whistle-model.ts`, so a download started here and one started
// there are the same download, kept apart by the part file when they are separate processes.
//
// WHY THIS IS NOT THE SETUP WIZARD. `stt setup` stores a credential or names a command the bridge
// will run. Whistle has neither (ADR 0096 Decision 3): this verb fetches 17 MB to a fixed path and,
// with `--host`, writes `{ "provider": "whistle" }`. The one thing it must not do is replace a
// provider the operator set up on purpose without being told so, which is what `--host`'s question
// and `--yes` are for.

const BARE_FLAGS = ["host", "remove", "yes"] as const;

/** The usage block, printed on a bad argument and listed by `collie stt`. */
export const WHISTLE_USAGE = [
  "usage: collie stt whistle [--host] [--from <path>] [--yes]",
  "       collie stt whistle --remove",
  "  (no flag)       fetch the Whistle model once, so phones and Settings can use it",
  "  --host          also make Whistle this host's speech engine",
  "  --from <path>   take a copy you already have, through the same hash check",
  "  --yes           say yes to the one question --host can ask",
  "  --remove        delete the model, and the host engine too when it is Whistle",
];

/** What the tests may replace. Production leaves all of it. */
export type WhistleSeams = Partial<Pick<WhistleModelDeps, "fetch" | "lookup" | "pin" | "accepted" | "capBytes" | "timeoutMs">>;

const mb = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;

function storeOf(deps: { ctx: Pick<SttDeps["ctx"], "stateDir" | "root">; whistle?: WhistleSeams }): WhistleModelStore {
  return createWhistleModelStore({ stateDir: deps.ctx.stateDir, version: collieVersionBare(deps.ctx.root), ...deps.whistle });
}

/** What `stt.json` and the environment say about the host's provider. */
interface HostProvider {
  /** The provider the FILE names, or undefined for none. `unreadable` is its own case. */
  file: string | undefined;
  /** The file is there and cannot be read or parsed: it is the operator's, never "nothing". */
  unreadable: boolean;
  /** What the environment names, which outranks the file. */
  env: string | undefined;
}

function hostProvider(ctxEnv: Environment, files: Pick<Files, "read">, stateDir: string): HostProvider {
  const raw = files.read(join(stateDir, STT_FILENAME));
  let file = coerceSttFile(undefined);
  let unreadable = false;
  if (raw !== null) {
    try {
      // SAFETY: `JSON.parse` answers with a JSON value, and `coerceSttFile` checks every field it reads.
      file = coerceSttFile(JSON.parse(raw) as JsonValue);
    } catch {
      unreadable = true;
    }
  }
  return {
    file: unreadable ? undefined : namedSttProvider(file, {}),
    unreadable,
    env: namedSttProvider({}, sttEnvSettings(ctxEnv)),
  };
}

/** The model, in one line, for `stt status`. */
export function modelLine(description: WhistleDescription, total: number): string {
  switch (description.kind) {
    case "absent":
      return `absent — \`collie stt whistle\` fetches it (${mb(total)})`;
    case "downloading":
      return `downloading — ${mb(description.received)} of ${mb(total)}`;
    case "ready": {
      const revision = description.revision === null ? "" : `, revision ${description.revision.slice(0, 8)}`;
      return `ready — ${mb(description.bytes)}, sha256 ${description.sha256.slice(0, 8)}…${revision}`;
    }
    case "mismatch":
      return `does not match this release (sha256 ${description.sha256.slice(0, 8)}…) — \`collie stt whistle\` fetches the right one`;
    case "unreadable":
      return `unreadable — ${description.reason}; \`collie stt whistle --remove\`, then \`collie stt whistle\``;
  }
}

/** The model as `stt status` reports it: whether one is there at all, and the line that says so. */
export async function modelStatus(deps: Pick<SttDeps, "ctx" | "whistle">): Promise<{ present: boolean; line: string }> {
  const description = await storeOf(deps).describe();
  const total = (deps.whistle?.pin ?? WHISTLE_MODEL).bytes;
  return { present: description.kind !== "absent", line: modelLine(description, total) };
}

/** The `stt.whistle-model` check. One finding, or none when Whistle plays no part on this host. */
export async function whistleModelFindings(deps: {
  ctx: Pick<SttDeps["ctx"], "stateDir" | "env" | "root">;
  files: Pick<Files, "read">;
  whistle?: WhistleSeams;
}): Promise<Finding[]> {
  const description = await storeOf(deps).describe();
  const total = (deps.whistle?.pin ?? WHISTLE_MODEL).bytes;
  const provider = hostProvider(deps.ctx.env, deps.files, deps.ctx.stateDir);
  const engine = provider.env === "whistle" || (provider.env === undefined && provider.file === "whistle");
  const check = "stt.whistle-model";
  switch (description.kind) {
    case "absent":
      // Nothing to say about a model nobody asked for. A host engine without one is a real fault.
      return engine
        ? [warn(check, "the host speech engine is Whistle, but its model is not on this host", "run `collie stt whistle`")]
        : [];
    case "downloading":
      return [ok(check, modelLine(description, total))];
    case "ready":
      return [ok(check, modelLine(description, total))];
    case "mismatch":
      return [warn(check, `the model on this host does not match this release (sha256 ${description.sha256})`, "run `collie stt whistle` to fetch the right one")];
    case "unreadable":
      return [warn(check, `the model on this host cannot be read: ${description.reason}`, "run `collie stt whistle --remove`, then `collie stt whistle`")];
  }
}

/** Show a download's progress on a terminal, until the store settles. */
async function waitFor(deps: SttDeps, store: WhistleModelStore, total: number): Promise<void> {
  const settled = store.settled();
  const progress = deps.progress;
  if (progress === undefined) {
    await settled;
    return;
  }
  // One tick per 200 ms until the store settles; `Promise.race` resolves to who won.
  for (let finished = false; !finished; ) {
    const { received } = await store.status();
    progress(`\r  ${mb(received ?? 0)} of ${mb(total)}`);
    finished = await Promise.race([settled.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200))]);
  }
  progress("\n");
}

/** `y` or `yes`, any case. Anything else, an empty answer included, is no. */
const isYes = (answer: string | null): boolean => answer !== null && /^y(es)?$/i.test(answer.trim());

export async function cmdSttWhistle(deps: SttDeps, args: readonly string[]): Promise<number> {
  const { positional, flags, bare } = parseCrewArgs(args, BARE_FLAGS);
  const unknown = Object.keys(flags).filter((name) => name !== "from");
  const bad = (message: string): number => {
    deps.io.err(`error: ${message}`);
    for (const line of WHISTLE_USAGE) deps.io.err(line);
    return EXIT.USAGE;
  };
  if (positional.length > 0) return bad(`unexpected argument \`${positional[0]}\``);
  if (unknown.length > 0) return bad(`unknown option \`--${unknown[0]}\``);
  if (flags.from === "") return bad("`--from` needs the path of a file");
  const from = flags.from;
  if (bare.has("remove")) {
    if (bare.has("host") || from !== undefined || bare.has("yes")) return bad("`--remove` takes no other option");
    return await remove(deps);
  }

  const store = storeOf(deps);
  const total = (deps.whistle?.pin ?? WHISTLE_MODEL).bytes;

  // The question comes BEFORE the fetch: a run that will be refused must not spend 17 MB first, and a
  // person who says no should not have waited for a download to be asked.
  if (bare.has("host")) {
    if (!(await mayTakeHost(deps, bare.has("yes")))) return EXIT.FAIL;
  }

  const code = await fetchModel(deps, store, total, from);
  if (code !== EXIT.OK) return code;
  if (!bare.has("host")) {
    deps.io.out("  Phones and Settings → Speech can use it now. To use it on this host too, run");
    deps.io.out("  `collie stt whistle --host`.");
    return EXIT.OK;
  }
  return turnOnHost(deps);
}

/** Get the model into place: a download, or `--from`. Reports in plain words. */
async function fetchModel(deps: SttDeps, store: WhistleModelStore, total: number, from: string | undefined): Promise<number> {
  const started = from === undefined ? await store.start() : await store.importFile(from);
  if (started.outcome === "refused") {
    deps.io.err(`error: ${started.reason}.`);
    return EXIT.FAIL;
  }
  if (started.outcome === "ready") {
    const held = await store.describe();
    deps.io.out(`✓ the Whistle model is already present — ${held.kind === "ready" ? modelLine(held, total) : "ready"}`);
    return EXIT.OK;
  }
  if (started.elsewhere === true) {
    deps.io.err(`error: a download is already running (${mb(started.status.received ?? 0)} of ${mb(total)} so far), started by the bridge or another terminal.`);
    deps.io.err("       Wait for it to finish, then run this again. Nothing was started.");
    return EXIT.FAIL;
  }
  deps.io.out(from === undefined ? `Fetching the Whistle model (${mb(total)}) from Hugging Face…` : "Checking and copying the file…");
  await waitFor(deps, store, total);
  const after = await store.status();
  if (after.state !== "ready") {
    deps.io.err(`error: ${after.reason ?? "the model did not arrive"}.`);
    deps.io.err("       Nothing was kept.");
    return EXIT.FAIL;
  }
  const held = await store.describe();
  deps.io.out(`✓ the Whistle model is on this host — ${held.kind === "ready" ? modelLine(held, total) : "ready"}`);
  return EXIT.OK;
}

/**
 * May `--host` write `{ "provider": "whistle" }`? `true` to go on; `false` after saying why it
 * stopped (a refusal, or the person's no). Never writes.
 */
async function mayTakeHost(deps: SttDeps, yes: boolean): Promise<boolean> {
  const provider = hostProvider(deps.ctx.env, deps.files, deps.ctx.stateDir);
  if (provider.env !== undefined && provider.env !== "whistle") {
    deps.io.err(`error: the environment already sets the speech provider (${STT_ENV_KEYS.provider} or another COLLIE_STT_* variable), and it outranks ${STT_FILENAME}.`);
    deps.io.err("       Unset it first. Nothing was written.");
    return false;
  }
  const named = provider.unreadable ? "an unreadable file" : provider.file;
  if (named === undefined || named === "whistle") return true;
  const what = provider.unreadable ? `a ${STT_FILENAME} that Collie cannot read` : `the \`${named}\` provider`;
  if (yes) {
    deps.io.out(`  --yes was passed: ${what} will be replaced by Whistle.`);
    return true;
  }
  if (!deps.interactive) {
    deps.io.err(`error: this host already has ${what} set up, and this run is not interactive.`);
    deps.io.err("       Pass `--yes` to replace it with Whistle. Nothing was written, and nothing was fetched.");
    return false;
  }
  deps.io.out(`This host already has ${what} set up. Whistle would replace it.`);
  if (isYes(await deps.prompt("Replace it with Whistle? [y/N] "))) return true;
  deps.io.err("Stopped. Nothing was written, and nothing was fetched.");
  return false;
}

/** Write the provider. The model is in place by now. */
function turnOnHost(deps: SttDeps): number {
  const provider = hostProvider(deps.ctx.env, deps.files, deps.ctx.stateDir);
  if (provider.file === "whistle" && !provider.unreadable) {
    deps.io.out("✓ the host speech engine is already Whistle — nothing to change.");
  } else {
    try {
      writeSttSettingsFile(deps.ctx.stateDir, { provider: "whistle" }, deps.files);
    } catch (err) {
      deps.io.err(`error: could not write ${join(deps.ctx.stateDir, STT_FILENAME)} — ${err instanceof Error ? err.message : String(err)}`);
      return EXIT.FAIL;
    }
    deps.io.out("✓ the host speech engine is now Whistle. It is live at once, with no restart.");
  }
  if (!whistleEngineInPlace(deps.ctx.root)) {
    deps.io.out("  ⚠ the engine files are missing from this install, so dictation cannot run yet.");
    deps.io.out("    `collie doctor` names the web build that holds them.");
  }
  const live = Object.values(STT_ENV_KEYS).filter((name) => (deps.ctx.env[name] ?? "").trim() !== "");
  if (live.length > 0) deps.io.out(`  ⚠ the environment still sets part of the speech settings, and it wins: ${live.join(", ")}.`);
  deps.io.out("  Check it with `collie stt test`.");
  return EXIT.OK;
}

/** `--remove`: the model goes; the provider goes with it only when it is Whistle. */
async function remove(deps: SttDeps): Promise<number> {
  const store = storeOf(deps);
  const before = await store.describe();
  if (before.kind === "downloading") {
    deps.io.err("error: a download is running, started by the bridge or another terminal. Wait for it to finish first.");
    deps.io.err("       Nothing was removed.");
    return EXIT.FAIL;
  }
  const provider = hostProvider(deps.ctx.env, deps.files, deps.ctx.stateDir);
  const whistleFile = provider.file === "whistle" && !provider.unreadable;
  await store.remove();
  const lines: string[] = [];
  if (before.kind !== "absent") lines.push(`✓ removed the Whistle model from ${store.paths.dir}`);
  if (whistleFile) {
    try {
      deps.files.remove(join(deps.ctx.stateDir, STT_FILENAME));
      lines.push(`✓ removed the host provider \`whistle\` (${STT_FILENAME}) — speech-to-text is off from the next request`);
    } catch (err) {
      deps.io.err(`error: could not remove ${join(deps.ctx.stateDir, STT_FILENAME)} — ${err instanceof Error ? err.message : String(err)}`);
      return EXIT.FAIL;
    }
  }
  if (lines.length === 0) {
    deps.io.out("there is no Whistle model on this host — nothing to remove.");
  } else {
    for (const line of lines) deps.io.out(line);
  }
  if (provider.env === "whistle") deps.io.out("  ⚠ the environment still names `whistle` as the provider; unset it too.");
  // A provider of another kind is the operator's, and stays.
  return EXIT.OK;
}
