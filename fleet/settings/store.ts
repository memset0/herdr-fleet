// The settings document on disk: read live, written whole, and guarded against the second writer.
//
// TWO POSTURES, BORROWED RATHER THAN INVENTED, because both already exist in this codebase and both
// were arrived at the hard way.
//
// Reading follows the operator-file contract: check the modification time, re-read only when it
// moved, and on a failure keep serving the last good document while warning once per change of the
// file rather than once per read. A half-saved file must never take the settings surface down.
//
// Writing follows the session store's: a temporary file renamed into place, so a reader never
// observes half a document. On top of that sits the one thing neither of those needed — a version
// guard, because this file has TWO writers. The browser writes it from the settings page and the
// operator writes it on disk, and last-write-wins would silently discard whichever landed first.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import {
  DEFAULT_FLEET_SETTINGS,
  FLEET_SETTINGS_FILENAME,
  parseFleetSettingsText,
  type FleetSettings,
  type SettingsRejection,
} from "./document.ts";

/** The document as a reader sees it: the settings, and the version a writer must send back. */
export interface SettingsSnapshot {
  readonly settings: FleetSettings;
  /** Opaque. Empty when no document exists yet. */
  readonly version: string;
  /** The text on disk, for the editor to show exactly what it will be replacing. */
  readonly text: string;
}

export type SettingsWriteResult =
  | { readonly ok: true; readonly snapshot: SettingsSnapshot }
  | { readonly ok: false; readonly reason: "invalid"; readonly rejection: SettingsRejection }
  | { readonly ok: false; readonly reason: "conflict"; readonly snapshot: SettingsSnapshot };

const EMPTY: SettingsSnapshot = { settings: DEFAULT_FLEET_SETTINGS, version: "", text: "" };

function versionOf(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export interface SettingsStoreIo {
  mtime: (path: string) => Promise<number | null>;
  read: (path: string) => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
}

export const diskSettingsIo: SettingsStoreIo = {
  async mtime(path) {
    try {
      return (await stat(path)).mtimeMs;
    } catch {
      return null;
    }
  },
  read: (path) => readFile(path, "utf8"),
  async write(path, text) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
    try {
      // 0600, the same posture as the private configuration it sits beside.
      await writeFile(temporary, text, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  },
};

export interface SettingsStore {
  read: () => Promise<SettingsSnapshot>;
  /** Replace the document. `expectedVersion` is what the client last read. */
  write: (text: string, expectedVersion: string) => Promise<SettingsWriteResult>;
}

export function settingsPathFor(configDir: string): string {
  return join(configDir, FLEET_SETTINGS_FILENAME);
}

export function createSettingsStore(
  path: string,
  io: SettingsStoreIo = diskSettingsIo,
  warn: (message: string) => void = (message) => console.warn(`herdr-fleet: ${message}`),
): SettingsStore {
  // The mtime the current snapshot was derived from, INCLUDING one that failed — which is what stops
  // a broken file warning on every single read.
  let seen: number | null | undefined;
  let snapshot: SettingsSnapshot = EMPTY;

  const read = async (): Promise<SettingsSnapshot> => {
    const mtime = await io.mtime(path);
    if (mtime === seen) return snapshot;
    seen = mtime;
    // No file is not an error. It is the ordinary case of an operator who has changed nothing.
    if (mtime === null) {
      snapshot = EMPTY;
      return snapshot;
    }
    let text: string;
    try {
      text = await io.read(path);
    } catch (error) {
      warn(`${FLEET_SETTINGS_FILENAME} could not be read (${String(error)}) — keeping the last good settings`);
      return snapshot;
    }
    const parsed = parseFleetSettingsText(text);
    if (!parsed.ok) {
      warn(
        `${FLEET_SETTINGS_FILENAME} is not usable at ${parsed.rejection.at || "the document"}: ` +
          `${parsed.rejection.message} — keeping the last good settings`,
      );
      return snapshot;
    }
    snapshot = { settings: parsed.settings, version: versionOf(text), text };
    return snapshot;
  };

  return {
    read,
    async write(text, expectedVersion) {
      const parsed = parseFleetSettingsText(text);
      if (!parsed.ok) return { ok: false, reason: "invalid", rejection: parsed.rejection };
      // Re-read before comparing, so a change made on disk since the client's last read is seen even
      // when nothing has asked for the document in between.
      const current = await read();
      if (current.version !== expectedVersion) {
        return { ok: false, reason: "conflict", snapshot: current };
      }
      await io.write(path, text);
      // Force the next read to go to disk: the mtime may not have moved far enough to notice on a
      // coarse clock, and this process is the one that just changed the file.
      seen = undefined;
      return { ok: true, snapshot: await read() };
    },
  };
}
