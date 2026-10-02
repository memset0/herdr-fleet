import { createHash, randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { diskSettingsIo } from "../settings/store.ts";
import { parseJson } from "../../web/src/lib/json.ts";
import { changeTags, emptyTags, MAX_DOCUMENT_BYTES, parseTagDocument, TAG_COLORS, type TagCommand, type TagSnapshot } from "./document.ts";

export interface TagStoreIo {
  read: (path: string) => Promise<string | null>;
  write: (path: string, text: string) => Promise<void>;
}
const disk: TagStoreIo = {
  async read(path) {
    try { return await readFile(path, "utf8"); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  },
  write: diskSettingsIo.write,
};

export function createTagStore(path: string, io: TagStoreIo = disk) {
  let pending: Promise<void> = Promise.resolve();
  const read = async (): Promise<TagSnapshot> => {
    const text = await io.read(path);
    if (text !== null && Buffer.byteLength(text) > MAX_DOCUMENT_BYTES) throw new Error("Tag document is too large");
    const document = text === null ? emptyTags() : parseTagDocument(parseJson(text));
    if (!document) throw new Error("Invalid tag document");
    return { version: text === null ? "" : createHash("sha256").update(text).digest("hex"), document };
  };
  const apply = async (version: string, command: TagCommand) => {
    const current = await read();
    if (version !== current.version) return { ok: false as const, error: "conflict" as const, snapshot: current };
    const changed = changeTags(current.document, command, () => ({ id: randomUUID(), color: TAG_COLORS[randomInt(TAG_COLORS.length)]! }));
    if (!changed.ok) return changed;
    const text = JSON.stringify(changed.document) + "\n";
    if (Buffer.byteLength(text) > MAX_DOCUMENT_BYTES) return { ok: false as const, error: "limit" as const };
    await io.write(path, text);
    return { ok: true as const, snapshot: { version: createHash("sha256").update(text).digest("hex"), document: changed.document } };
  };
  return {
    read,
    mutate(version: string, command: TagCommand) {
      const result = pending.then(() => apply(version, command));
      pending = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
export type TagStore = ReturnType<typeof createTagStore>;
