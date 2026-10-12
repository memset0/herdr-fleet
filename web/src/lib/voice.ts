import type { PhoneEngineBlock, SttEngineChoice } from "@/lib/stt";
import type { StoredModel } from "@/lib/stt-model";
import type { SttCapability, SttHostChoice, SttHostStatus, WhistleStatus } from "@/lib/types";

// ── SETTINGS → VOICE, THE FACTS BEHIND THE WORDS ────────────────────────────────────────────────
//
// Pure rules the Voice pages draw from (components/speech-control.tsx). No store, no network, no
// words: each answer is a code the page turns into a sentence from the catalogue, so a test can pin
// the rule without a screen.
//
// THE FIVE HOST OPTIONS, in the order audio travels: Whistle on the host, a command on the host, a
// speech service off the host, the ChatGPT subscription off the host, then Off. The bridge names them
// by provider (`whistle`, `local-cli`, `openai-compatible`, `codex`, `none`); the page names them by
// what they do. Settings switches three of them (Whistle, ChatGPT, Off, ADR 0097); the other two are
// set up in a terminal on the host.

/** The host's option, as Settings → Voice names it. */
export type HostOption = "whistle" | "command" | "service" | "chatgpt" | "off";

/** Every host option, in the order audio travels. Off last, on its own. */
export const HOST_OPTIONS = ["whistle", "command", "service", "chatgpt", "off"] as const satisfies readonly HostOption[];

/** Where audio goes, one fixed sentence each. `nowhere`: the host takes none. */
export type Reach = "phone" | "host" | "command" | "service" | "chatgpt" | "nowhere";

/** The option a provider id means, or `null` for a name this build does not know. */
export function hostOptionOf(provider: string): HostOption | null {
  switch (provider) {
    case "whistle":
      return "whistle";
    case "local-cli":
      return "command";
    case "openai-compatible":
      return "service";
    case "codex":
      return "chatgpt";
    case "none":
      return "off";
    default:
      return null;
  }
}

/** The choice `PUT /api/stt/host` takes for an option, or `null` for the two set up in a terminal. */
export function choiceOf(option: HostOption): SttHostChoice | null {
  switch (option) {
    case "whistle":
      return "whistle";
    case "chatgpt":
      return "codex";
    case "off":
      return "off";
    case "command":
    case "service":
      return null;
  }
}

/** The option a choice selects. */
export function optionOfChoice(choice: SttHostChoice): HostOption {
  return choice === "codex" ? "chatgpt" : choice;
}

export function reachOf(option: HostOption): Reach {
  switch (option) {
    case "whistle":
      return "host";
    case "off":
      return "nowhere";
    default:
      return option;
  }
}

/** Audio that leaves the host's network: it carries the icon-and-word marker, never a colour alone. */
export function leavesNetwork(reach: Reach): boolean {
  return reach === "service" || reach === "chatgpt";
}

/** The tier an option is listed under. `null`: Off, which stands alone below both. */
export function tierOf(option: HostOption): "stays" | "leaves" | null {
  if (option === "off") return null;
  return leavesNetwork(reachOf(option)) ? "leaves" : "stays";
}

/** The host's option right now: the status read when there is one, else the config's provider. */
export function currentHostProvider(host: SttHostStatus | null, hostStt: SttCapability | null): string {
  return host?.provider ?? hostStt?.provider ?? "none";
}

/** How far audio travels, for "does this change need a word first": a step toward less travel does not. */
const TRAVEL = { off: 0, whistle: 1, command: 2, service: 3, chatgpt: 4 } as const satisfies Record<HostOption, number>;

/**
 * What a tap on a host choice asks for before anything is sent: nothing, the host-wide confirm, or the
 * ChatGPT consent. ChatGPT always asks for consent (ADR 0097). Any other choice asks only when it sends
 * audio further than the option it replaces; a step back toward the host is sent on the tap. A host
 * whose option is not known yet (`null`) counts as Off.
 */
export function askFor(from: HostOption | null, to: SttHostChoice): "none" | "confirm" | "consent" {
  if (to === "codex") return "consent";
  return TRAVEL[optionOfChoice(to)] > TRAVEL[from ?? "off"] ? "confirm" : "none";
}

// ── "WHEN YOU PRESS THE MIC" ────────────────────────────────────────────────────────────────────

/** The state word's look. `works` and `setup` are fine or new; `paused` and `broken` need a person. */
export type VoiceState = "works" | "setup" | "paused" | "broken";

/**
 * What the in-use card says, as codes. `where` names who turns speech into text; `reach` is where
 * audio goes (`null`: nothing is recorded); `action` is the one thing that fixes the state.
 */
export type VoiceStatus =
  | { kind: "phone"; state: "works"; reach: "phone" }
  | { kind: "paused"; state: "paused"; reach: null; action: "restore" | null }
  | { kind: "setup"; state: "setup"; reach: null }
  | { kind: "no-recording"; state: "broken"; reach: null }
  | { kind: "host"; state: "works" | "broken"; option: HostOption | null; provider: string; reach: Reach | null; action: "fix" | null };

export interface VoiceStatusInput {
  /** What this device asked for. */
  engine: SttEngineChoice;
  /** The phone's own copy: `null` none, `undefined` still looking. */
  local: StoredModel | null | undefined;
  /** Why "On this phone" cannot run, if it cannot. */
  block: PhoneEngineBlock | null;
  /** The host's provider id (`none` when it has none). */
  provider: string;
  /** Whether the host's provider could serve a request now. */
  available: boolean;
  /** The host's model, which a lost phone copy is restored from. */
  whistle: WhistleStatus | null;
  /** This browser can record at all. */
  recording: boolean;
}

/** The browser's own reason "On this phone" cannot run, or `null`. A host not ready is not one. */
export function browserBlock(block: PhoneEngineBlock | null): Exclude<PhoneEngineBlock, "host-not-ready"> | null {
  return block === null || block === "host-not-ready" ? null : block;
}

/**
 * Which of this phone's two choices is in force. "On this phone" is in force while the device asked
 * for it and this browser can run it; a copy that is gone does not move the choice to the host (ADR
 * 0096 Decision 12): the choice stays, and dictation is paused until the copy is back or the person
 * chooses the host. A browser that cannot run the engine at all is the one case that reads as the
 * host, because "On this phone" was never available there (ADR 0096 Decision 8).
 */
export function phoneChoiceInForce(engine: SttEngineChoice, block: PhoneEngineBlock | null): SttEngineChoice {
  return engine === "phone" && browserBlock(block) === null ? "phone" : "host";
}

/** What happens when the mic is pressed, from the same facts the composer reads. */
export function voiceStatus(input: VoiceStatusInput): VoiceStatus {
  if (!input.recording) return { kind: "no-recording", state: "broken", reach: null };
  if (phoneChoiceInForce(input.engine, input.block) === "phone") {
    if (input.local === null) {
      const restorable = input.whistle?.state === "ready";
      return { kind: "paused", state: "paused", reach: null, action: restorable ? "restore" : null };
    }
    return { kind: "phone", state: "works", reach: "phone" };
  }
  const option = hostOptionOf(input.provider);
  if (option === "off") return { kind: "setup", state: "setup", reach: null };
  const reach = option === null ? null : reachOf(option);
  if (!input.available) return { kind: "host", state: "broken", option, provider: input.provider, reach, action: "fix" };
  return { kind: "host", state: "works", option, provider: input.provider, reach, action: null };
}

// ── "SET UP SPEECH ON THIS PHONE" ───────────────────────────────────────────────────────────────
//
// One button in the in-use card that walks the whole way to Whistle on this phone: the host's
// download when the host lacks the model, the copy to this phone, then On this phone chosen. It is
// offered only while speech does not work on this device and this device can run the engine. A
// paused phone keeps Restore instead: its choice is already made, and Restore is the same copy.

/** What one tap of "Set up speech on this phone" does from here, or `null` when it is not offered. */
export type GuidedPlan =
  /** The copy is here already: choose On this phone. */
  | "select"
  /** The host holds the model: copy it, then choose On this phone. */
  | "copy"
  /** The host lacks it and this device may write: the host's download, the copy, then the choice. */
  | "both"
  /** The host lacks it and this device may not ask for it: the read-only sentence, no button. */
  | "needs-host";

export function guidedPlan(input: {
  status: VoiceStatus;
  block: PhoneEngineBlock | null;
  recording: boolean;
  whistle: WhistleStatus | null;
  local: StoredModel | null | undefined;
  canWrite: boolean;
}): GuidedPlan | null {
  const { status, block, recording, whistle, local, canWrite } = input;
  if (status.state === "works" || status.kind === "paused") return null;
  if (!recording || browserBlock(block) !== null || local === undefined) return null;
  if (local !== null) return "select";
  if (whistle === null) return null;
  if (whistle.state === "ready") return "copy";
  return canWrite ? "both" : "needs-host";
}

// ── THE MODEL ROW'S CHIP ────────────────────────────────────────────────────────────────────────

/** The model's state in one or two words, for the hub's row. */
export type ModelChip = "gone" | "update" | "downloading" | "failed" | "absent" | "both" | "host" | "phone";

export function modelChip(input: {
  whistle: WhistleStatus | null;
  local: StoredModel | null | undefined;
  /** "On this phone" is in force, so a missing copy is a paused phone rather than a step not taken. */
  phoneInForce: boolean;
}): ModelChip {
  const { whistle, local, phoneInForce } = input;
  const held = local !== null && local !== undefined;
  if (!held && phoneInForce && local === null) return "gone";
  if (held && whistle?.state === "ready" && whistle.sha256 !== undefined && whistle.sha256 !== local.sha256) return "update";
  if (whistle?.state === "downloading") return "downloading";
  if (whistle?.state === "failed" && !held) return "failed";
  if (whistle?.state === "ready") return held ? "both" : "host";
  if (held) return "phone";
  return "absent";
}

// ── THE IN-USE CARD'S FACTS ─────────────────────────────────────────────────────────────────────
//
// The hub's first card names what is in use: the engine as its title, where it runs under it, then
// whether it is ready, where audio goes, and how it was set up. Each is a code here; the card turns
// it into words. The card never says a bare "Works": the status line says what the answer rests on,
// which is a different check for each engine (the bridge's `status()` per provider, bridge/stt/*.ts):
//
//   · this phone      a copy of the model in this browser, and a browser that runs the engine
//   · Whistle (host)  the model held under a hash this release accepts, and the engine files in place
//   · your command    the command is a regular, executable file the host can find
//   · speech service  configured is all the host knows: it has no cheap way to ask the service
//   · ChatGPT         Codex on the host answered that it is signed in with ChatGPT

/** The engine the card's title names. `other`: a provider id this build does not know, shown as the host sent it. */
export type EngineFact = HostOption | "phone" | "other";

/** Where the engine runs, the line under the title. `nothing`: no engine runs at all. */
export type RunsOnFact = "phone" | "host" | "nothing";

/** What the Set up line says. */
export type SetUpFact =
  | { kind: "settings"; by: string; at: string }
  | { kind: "terminal" }
  | { kind: "env" }
  | { kind: "phone" }
  | { kind: "none" };

/** What the status line rests on, as a code. Each one is one sentence in the catalogue. */
export type Readiness =
  | "phone-ready"
  | "phone-gone"
  | "no-recording"
  | "nothing"
  | "whistle-ready"
  | "whistle-no-model"
  | "whistle-no-engine"
  | "command-found"
  | "command-missing"
  | "service-set"
  | "codex-ready"
  | "codex-missing"
  | "codex-signed-out"
  | "codex-other-login"
  | "codex-unknown"
  | "other-ready"
  | "host-says";

/** The Codex sign-in on the host, as the host's switch check found it. `null`: not checked (a lock, or an older bridge). */
export type CodexState = "ready" | "missing" | "signed-out" | "other-login" | "unknown";

/** The host's Codex sign-in, from `switchable.codex`. A lock skips the check, so a lock is `null`. */
export function codexStateOf(host: SttHostStatus | null): CodexState | null {
  const sw = host?.switchable.codex;
  if (sw === undefined) return null;
  if (sw.ok) return "ready";
  switch (sw.reason) {
    case "codex-missing":
      return "missing";
    case "codex-signed-out":
      return "signed-out";
    case "codex-other-login":
      return "other-login";
    case "codex-unknown":
      return "unknown";
    default:
      return null;
  }
}

export interface StatusFactsInput {
  /** The host's status read, or `null` on an older bridge. */
  host: SttHostStatus | null;
  /** The host's model, for the Whistle row's reason. */
  whistle: WhistleStatus | null;
}

/** The in-use card's codes for one status. Its Audio line is the status's own `reach`. */
export interface StatusFacts {
  engine: EngineFact;
  runsOn: RunsOnFact;
  setUp: SetUpFact;
  readiness: Readiness;
}

/** How the host's option was set up: from Settings by a named device, in a terminal, by the environment, or not at all. */
function hostSetUp(provider: string, host: SttHostStatus | null): SetUpFact {
  if (provider === "none") return { kind: "none" };
  if (host?.changedBy !== undefined && host.changedAt !== undefined) return { kind: "settings", by: host.changedBy, at: host.changedAt };
  if (host?.configuredBy === "env") return { kind: "env" };
  return { kind: "terminal" };
}

/** Why a host option in use does not answer, from the facts the page has; `host-says` when only the host's own words do. */
export function hostNotReady(option: HostOption | null, input: StatusFactsInput): Readiness {
  if (option === "whistle" && input.whistle !== null) return input.whistle.state === "ready" ? "whistle-no-engine" : "whistle-no-model";
  if (option === "command") return "command-missing";
  if (option === "chatgpt") {
    const codex = codexStateOf(input.host);
    if (codex !== null && codex !== "ready") return `codex-${codex}`;
  }
  return "host-says";
}

const READY_OF = {
  whistle: "whistle-ready",
  command: "command-found",
  service: "service-set",
  chatgpt: "codex-ready",
} as const satisfies Record<Exclude<HostOption, "off">, Readiness>;

/** The in-use card's facts for one status. */
export function statusFacts(status: VoiceStatus, input: StatusFactsInput): StatusFacts {
  switch (status.kind) {
    case "phone":
      return { engine: "phone", runsOn: "phone", setUp: { kind: "phone" }, readiness: "phone-ready" };
    case "paused":
      return { engine: "phone", runsOn: "phone", setUp: { kind: "none" }, readiness: "phone-gone" };
    case "setup":
      return { engine: "off", runsOn: "nothing", setUp: { kind: "none" }, readiness: "nothing" };
    case "no-recording":
      return { engine: "off", runsOn: "nothing", setUp: { kind: "none" }, readiness: "no-recording" };
    case "host": {
      const engine: EngineFact = status.option ?? "other";
      const setUp = hostSetUp(status.provider, input.host);
      const readiness: Readiness =
        status.state === "broken"
          ? hostNotReady(status.option, input)
          : status.option === null || status.option === "off"
            ? "other-ready"
            : READY_OF[status.option];
      return { engine, runsOn: "host", setUp, readiness };
    }
  }
}

// ── WHAT IS CONFIGURED, BY NAME ─────────────────────────────────────────────────────────────────
//
// The card's title names the setup itself, not only its kind: the command the host runs, a speech
// service's model, Whistle's version. The host sends these names in `setup` (`GET /api/stt/host`), by
// name only; an older host sends none, and the card falls back to the kind.

/** The command earlier docs told people to write round Whistle. Collie runs Whistle itself now. */
export const OLD_WHISTLE_WRAPPER = "whistle-stt";

/** The first seven characters of a revision, or of the hash when the copy names no revision. */
export function shortVersion(revision: string | undefined, sha256: string | undefined): string {
  if (revision !== undefined) return revision.slice(0, 7);
  return sha256 === undefined ? "" : sha256.slice(0, 7);
}

/** What the in-use card names beyond the engine's kind. Each is `null` when there is nothing to name. */
export interface NamedSetup {
  /** The title's own name, shown in mono: a command, or a speech service's model. `null`: the engine's name. */
  name: string | null;
  /** The model, for the line under the title: a model file, Whistle's version, or Codex's model. */
  model: string | null;
  /** A speech service's host, for the line under the title. */
  endpoint: string | null;
}

const NOTHING_NAMED: NamedSetup = { name: null, model: null, endpoint: null };

export interface NamedSetupInput {
  host: SttHostStatus | null;
  whistle: WhistleStatus | null;
  local: StoredModel | null | undefined;
}

/** What the card names for an engine, from the host's `setup`, the host's model, or this phone's copy. */
export function namedSetup(engine: EngineFact, input: NamedSetupInput): NamedSetup {
  const setup = input.host?.setup;
  switch (engine) {
    case "command":
      return { name: setup?.command ?? null, model: setup?.model ?? null, endpoint: null };
    case "service":
      return { name: setup?.model ?? null, model: null, endpoint: setup?.endpoint ?? null };
    case "whistle": {
      const held = input.whistle?.state === "ready" ? shortVersion(input.whistle.revision, input.whistle.sha256) : "";
      return { name: null, model: setup?.model ?? (held === "" ? null : held), endpoint: null };
    }
    case "phone": {
      const copy = input.local ? shortVersion(input.local.revision, input.local.sha256) : "";
      return { name: null, model: copy === "" ? null : copy, endpoint: null };
    }
    case "chatgpt":
      return { name: null, model: setup?.model ?? null, endpoint: null };
    case "other":
    case "off":
      return NOTHING_NAMED;
  }
}

/** Whether the host runs the old Whistle wrapper as its own command, which built-in Whistle replaces. */
export function oldWhistleWrapper(host: SttHostStatus | null): boolean {
  return host?.provider === "local-cli" && host.setup?.command === OLD_WHISTLE_WRAPPER;
}

// ── HOW TO SET UP EACH HOST OPTION ──────────────────────────────────────────────────────────────
//
// Every option on Host speech carries its steps, whether or not it can be switched from the app
// now. The app still never changes a provider set up with a key or a command (ADR 0097): under that
// lock, the steps of the two it could otherwise switch begin with `collie stt off`, run on the host.

/** One step. The page owns the words, the command and the button for each id. */
export type SetupStepId =
  | "lock-off"
  | "lock-env"
  | "lock-unreadable"
  | "whistle-download"
  | "whistle-use"
  | "whistle-command"
  | "command-run"
  | "service-run"
  | "codex-install"
  | "codex-login"
  | "codex-use"
  | "off-choose"
  | "off-command";

/** A step's mark: done, the one to take next, or neither (nothing the page can tell). */
export type StepMark = "done" | "next" | null;

export interface SetupStep {
  id: SetupStepId;
  mark: StepMark;
}

/** Why nothing on Host speech can be chosen from the app. */
export type HostLock = "terminal" | "env" | "unreadable";

export interface SetupInput {
  /** What locks every choice, or `null`. */
  lock: HostLock | null;
  /** This device may write, the host answered, and nothing locks the choice. */
  interactive: boolean;
  /** The option is the host's option now. */
  inUse: boolean;
  /** The host's option answers (`available`). Read only together with `inUse`. */
  working: boolean;
  /** The model is ready on the host. */
  whistleReady: boolean;
  /** The host's Codex sign-in, or `null` when it was not checked. */
  codex: CodexState | null;
}

const LOCK_STEP = { terminal: "lock-off", env: "lock-env", unreadable: "lock-unreadable" } as const satisfies Record<HostLock, SetupStepId>;

/**
 * Marks for steps taken in order: every step before the first one not yet done is done, that one is
 * next, the rest are neither. `doneUntil` is how many steps are done; `null` marks nothing.
 */
function inOrder(ids: readonly SetupStepId[], doneUntil: number | null): SetupStep[] {
  return ids.map((id, i) => ({
    id,
    mark: doneUntil === null ? null : i < doneUntil ? "done" : i === doneUntil ? "next" : null,
  }));
}

/** The steps that set up one host option, with the one to take next marked where the page can tell. */
export function setupSteps(option: HostOption, input: SetupInput): SetupStep[] {
  const { lock, interactive, inUse, working, whistleReady, codex } = input;
  // In use and answering: every step is behind it. In use and not answering: the step that fixes it
  // is next, where the page can tell which one that is.
  const done = inUse && working;
  switch (option) {
    case "whistle": {
      if (lock !== null) return inOrder([LOCK_STEP[lock], "whistle-command"], done ? 2 : 0);
      if (!interactive) return inOrder(["whistle-command"], done ? 1 : inUse ? 0 : null);
      return inOrder(["whistle-download", "whistle-use"], done ? 2 : !whistleReady ? 0 : inUse ? null : 1);
    }
    case "command":
      return inOrder(["command-run"], done ? 1 : inUse ? 0 : null);
    case "service":
      return inOrder(["service-run"], done ? 1 : inUse ? 0 : null);
    case "chatgpt": {
      const ids: SetupStepId[] = ["codex-install", "codex-login", "codex-use"];
      if (lock !== null) return inOrder([LOCK_STEP[lock], ...ids], done ? 4 : 0);
      if (done) return inOrder(ids, 3);
      if (codex === null) return inOrder(ids, null);
      if (codex === "missing") return inOrder(ids, 0);
      if (codex !== "ready") return inOrder(ids, 1);
      return inOrder(ids, inUse ? null : 2);
    }
    case "off":
      return inOrder([interactive ? "off-choose" : "off-command"], inUse ? 1 : null);
  }
}
