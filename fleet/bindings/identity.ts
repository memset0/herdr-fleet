import { asJsonObject, asJsonString, type JsonValue } from "../../web/src/lib/json.ts";

/** Fleet's durable identity seam. Layout addresses remain navigation metadata. */
export interface TerminalRef {
  readonly version: 1;
  readonly host: string;
  readonly session: string;
  readonly id: string;
}

export interface BindingPane {
  readonly host?: string;
  readonly session?: string;
  readonly bindingId?: string;
  readonly bindingSession?: string;
  readonly paneId: string;
}

const OPAQUE_ID = /^[A-Za-z0-9_:-]{1,160}$/;
const SCOPE = /^[^\p{Cc}]{0,256}$/u;

export function terminalReference(pane: BindingPane): TerminalRef | null {
  const id = asJsonString(pane.bindingId);
  const host = asJsonString(pane.host ?? ""), session = asJsonString(pane.bindingSession ?? pane.session ?? "");
  if (host === undefined || session === undefined || !id || !OPAQUE_ID.test(id) || !SCOPE.test(host) || !SCOPE.test(session)) return null;
  return { version: 1, host, session, id };
}

export function terminalKey(ref: TerminalRef): string {
  return JSON.stringify([ref.version, ref.host, ref.session, ref.id]);
}

export function parseTerminalReference(value: JsonValue | undefined): TerminalRef | null {
  const object = asJsonObject(value);
  if (object?.version !== 1) return null;
  const host = asJsonString(object.host), session = asJsonString(object.session), id = asJsonString(object.id);
  if (host === undefined || session === undefined || id === undefined) return null;
  return terminalReference({ host, session, bindingId: id, paneId: "" });
}

export function sameTerminal(a: TerminalRef, b: TerminalRef): boolean {
  return terminalKey(a) === terminalKey(b);
}

export type TerminalResolution<T> =
  | { readonly status: "resolved"; readonly pane: T }
  | { readonly status: "unavailable" | "ambiguous" };

/** Inventory freshness is explicit: a cached row cannot authorize navigation or a send. */
export function resolveTerminalReference<T extends BindingPane>(
  ref: TerminalRef, panes: readonly T[], fresh: boolean,
): TerminalResolution<T> {
  if (!fresh) return { status: "unavailable" };
  const matches = panes.filter((pane) => {
    const candidate = terminalReference(pane);
    return candidate !== null && sameTerminal(ref, candidate);
  });
  if (matches.length > 1) return { status: "ambiguous" };
  const pane = matches[0];
  return pane ? { status: "resolved", pane } : { status: "unavailable" };
}

export interface TerminalRelation {
  readonly terminal: TerminalRef;
  readonly kind: string;
  readonly resource: string;
}

export function relationKey(relation: TerminalRelation): string {
  return JSON.stringify([terminalKey(relation.terminal), relation.kind, relation.resource]);
}

export function attachRelation<T extends TerminalRelation>(relations: readonly T[], relation: T): readonly T[] {
  const key = relationKey(relation);
  return relations.some((entry) => relationKey(entry) === key) ? relations : [...relations, relation];
}

export function detachRelation<T extends TerminalRelation>(relations: readonly T[], relation: TerminalRelation): readonly T[] {
  const key = relationKey(relation);
  return relations.filter((entry) => relationKey(entry) !== key);
}

export function relationsFor<T extends TerminalRelation>(
  relations: readonly T[], terminal: TerminalRef, kind?: string,
): readonly T[] {
  return relations.filter((entry) => sameTerminal(entry.terminal, terminal) && (kind === undefined || entry.kind === kind));
}
