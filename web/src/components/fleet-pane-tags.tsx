import { createContext, useCallback, useContext, useMemo, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pencil, Tags, X } from "lucide-react";

import { MAX_NAME, normalizeTagName, TAG_COLORS, tagsForPane, validTagName, type PaneTag, type PanePlace, type TagCommand } from "../../../fleet/pane-tags/document.ts";
import { createPaneTagClient, tagPanePlace, type PaneTagClient, type TagClientState } from "@/lib/fleet-pane-tags";
import { FleetPanel } from "@/components/fleet-panel";
import { Badge } from "@/components/ui/badge";
import { isLocked, useLocked } from "@/lib/idle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapse } from "@/components/ui/collapse";
import { useDialogFocus } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import type { AgentView } from "@/lib/types";

interface TagContextValue {
  client: PaneTagClient;
  state: TagClientState;
  open: (pane: PanePlace | null) => void;
}
const TagContext = createContext<TagContextValue | null>(null);

export function FleetPaneTagsProvider({ children, client: supplied }: { children: ReactNode; client?: PaneTagClient }) {
  const [client] = useState(() => supplied ?? createPaneTagClient());
  const locked = useLocked();
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [editor, setEditor] = useState<{ pane: PanePlace | null } | null>(null);
  useEffect(() => {
    const refresh = () => { if (!isLocked() && document.visibilityState !== "hidden") void client.refresh(); };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [client, locked]);
  const open = useCallback((pane: PanePlace | null) => {
    client.clearError(); setEditor({ pane }); void client.refresh();
  }, [client]);
  const context = useMemo(() => ({ client, state, open }), [client, state, open]);
  return (
    <TagContext value={context}>
      {children}
      {editor && <TagEditor pane={editor.pane} state={state} client={client} onClose={() => setEditor(null)} />}
    </TagContext>
  );
}

export function TagBadge({ tag, compact = false }: { tag: PaneTag; compact?: boolean }) {
  return (
    <Badge variant="outline" data-slot="pane-tag" className={`max-w-full shrink whitespace-normal gap-1.5 px-1.5 font-normal leading-4 ${compact ? "py-0 text-[10px]" : ""}`}
      style={{ borderColor: `color-mix(in srgb, ${tag.color} 60%, transparent)`, backgroundColor: `color-mix(in srgb, ${tag.color} 12%, transparent)` }}>
      <span aria-hidden className={`${compact ? "size-1.5" : "size-2"} shrink-0 rounded-full`} style={{ backgroundColor: tag.color }} />
      <span className="min-w-0 break-all">{tag.name}</span>
    </Badge>
  );
}

export function PaneTagLine({ agent }: { agent: AgentView }) {
  const context = useContext(TagContext);
  const tags = context?.state.snapshot ? tagsForPane(context.state.snapshot.document, tagPanePlace(agent)) : [];
  return (
    <Collapse open={tags.length > 0}>
      {tags.length > 0 && <div data-slot="pane-tag-line" className="flex min-w-0 flex-wrap gap-1 px-3 pb-1 pt-0.5 pr-10 pointer-coarse:pr-14">
        {tags.map((tag) => <TagBadge key={tag.id} tag={tag} compact />)}
      </div>}
    </Collapse>
  );
}

export function PaneTagButton({ agent }: { agent: AgentView }) {
  useLocale();
  const context = useContext(TagContext);
  if (!context || agent.kind === "shell") return null;
  return <Button type="button" variant="ghost" size="icon" data-slot="agent-tag-action" aria-label={t("fleet.tags.assign")} onClick={() => context.open(tagPanePlace(agent))}
    className="size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 pointer-coarse:size-11">
    <Tags className="size-3.5" aria-hidden />
  </Button>;
}

export function ManagePaneTags({ settings = false }: { settings?: boolean }) {
  useLocale();
  const context = useContext(TagContext);
  if (!context) return null;
  const button = <Button type="button" variant="outline" size="sm" onClick={() => context.open(null)}>
    <Tags className="size-4" aria-hidden />{t("fleet.tags.manage")}
  </Button>;
  return settings ? <Card className="flex flex-col gap-3 p-4">
    <div className="text-sm font-medium">{t("fleet.tags.title")}</div>
    <p className="text-xs text-muted-foreground">{t("fleet.tags.shared")}</p>
    <div>{button}</div>
  </Card> : button;
}

const INPUT_CLASS = "min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function TagEditor({ pane, state, client, onClose }: {
  pane: PanePlace | null; state: TagClientState; client: PaneTagClient; onClose: () => void;
}) {
  useLocale();
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panel);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ tag: PaneTag; version: string } | null>(null);
  useEffect(() => {
    if (editing === null) panel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [editing]);
  const document = state.snapshot?.document;
  const tags = document?.tags ?? [];
  const assigned = new Set(document && pane ? tagsForPane(document, pane).map((tag) => tag.id) : []);
  const busy = state.busy || !state.available;
  const normalized = normalizeTagName(query);
  const exact = tags.find((tag) => tag.name === normalized);
  const visible = tags.filter((tag) => tag.name.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()));
  const mutate = async (command: TagCommand, version?: string) => {
    const ok = await client.mutate(command, version);
    if (ok) setQuery("");
    return ok;
  };
  useEffect(() => {
    const element = panel.current;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && (window.document.activeElement === first || window.document.activeElement === panel.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (editing) setEditing(null); else onClose(); }
    };
    element?.addEventListener("keydown", keydown);
    return () => element?.removeEventListener("keydown", keydown);
  }, [editing, onClose]);
  const title = pane ? t("fleet.tags.assign") : t("fleet.tags.manage");
  return <FleetPanel open label={title} onClose={onClose} className="max-h-[76dvh]">
    <div ref={panel} role="group" tabIndex={-1} className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label={t("fleet.tags.close")} onClick={onClose}><X className="size-4" aria-hidden /></Button>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground">{t("fleet.tags.shared")}</p>
      {editing ? <EditTag key={editing.tag.id} tag={editing.tag} busy={busy}
        onCancel={() => setEditing(null)} onSave={async (name, color) => {
          const saved = await mutate({ kind: "edit", id: editing.tag.id, name, color }, editing.version);
          if (saved || client.getSnapshot().error === "conflict") { setEditing(null); setQuery(""); }
        }} /> : <>
        <form className="flex gap-2 p-4" onSubmit={(event) => {
          event.preventDefault();
          if (pane && !busy && validTagName(normalized)) void mutate({ kind: "attach", pane, name: normalized });
        }}>
          <input aria-label={t("fleet.tags.search")} placeholder={t("fleet.tags.search")} maxLength={MAX_NAME} value={query}
            onChange={(event) => setQuery(event.target.value)} className={`${INPUT_CLASS} flex-1`} />
          {pane && <Button type="submit" disabled={busy || !validTagName(normalized) || !!exact && assigned.has(exact.id)}>
            {exact ? t("fleet.tags.add") : t("fleet.tags.create")}
          </Button>}
        </form>
        <div className="min-h-24 overflow-y-auto px-4 pb-4">
          {visible.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t("fleet.tags.empty")}</p>}
          {visible.map((tag) => <div key={tag.id} className="flex min-h-11 items-center gap-2 border-b border-rule py-1 last:border-0">
            {pane ? <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
              <input type="checkbox" checked={assigned.has(tag.id)} disabled={busy} aria-label={tag.name}
                onChange={() => void mutate(assigned.has(tag.id) ? { kind: "detach", pane, id: tag.id } : { kind: "attach", pane, name: tag.name })} />
              <TagBadge tag={tag} />
            </label> : <div className="min-w-0 flex-1"><TagBadge tag={tag} /></div>}
            <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={t("fleet.tags.editNamed", { name: tag.name })}
              onClick={() => { client.clearError(); setEditing({ tag, version: state.snapshot!.version }); }}><Pencil className="size-4" aria-hidden /></Button>
          </div>)}
        </div>
      </>}
      <div className="flex min-h-12 items-center justify-between gap-2 border-t border-rule px-4 py-2 text-xs text-muted-foreground" role="status">
        <span>{state.busy ? t("fleet.tags.saving") : state.loading ? t("fleet.tags.loading") : !state.available ? t("fleet.tags.error.unavailable") : state.error ? t(`fleet.tags.error.${state.error}`) : ""}</span>
        {!state.available && !state.loading && <Button type="button" size="sm" variant="outline" onClick={() => void client.refresh()}>{t("fleet.tags.retry")}</Button>}
      </div>
    </div>
  </FleetPanel>;
}

function EditTag({ tag, busy, onCancel, onSave }: {
  tag: PaneTag; busy: boolean; onCancel: () => void; onSave: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState(tag.name), [color, setColor] = useState(tag.color);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <form className="flex flex-col gap-4 overflow-y-auto p-4" onSubmit={(event) => { event.preventDefault(); if (!busy && validTagName(normalizeTagName(name))) void onSave(normalizeTagName(name), color); }}>
    <p className="text-xs text-muted-foreground">{t("fleet.tags.globalEdit")}</p>
    <label className="flex flex-col gap-1.5 text-sm">{t("fleet.tags.name")}
      <input ref={input} className={INPUT_CLASS} value={name} maxLength={MAX_NAME} onChange={(event) => setName(event.target.value)} />
    </label>
    <label className="flex items-center gap-3 text-sm">{t("fleet.tags.color")}
      <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent" />
    </label>
    <div className="flex flex-wrap gap-1" role="group" aria-label={t("fleet.tags.palette")}>
      {TAG_COLORS.map((value) => <button key={value} type="button" aria-label={value} aria-pressed={color === value} onClick={() => setColor(value)}
        className="flex size-9 items-center justify-center rounded-full border border-transparent aria-pressed:border-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <span className="size-5 rounded-full" style={{ backgroundColor: value }} />
      </button>)}
    </div>
    <div><TagBadge tag={{ ...tag, name: name || tag.name, color }} /></div>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>{t("fleet.tags.cancel")}</Button>
      <Button type="submit" disabled={busy || !validTagName(normalizeTagName(name))}>{t("fleet.tags.save")}</Button>
    </div>
  </form>;
}
