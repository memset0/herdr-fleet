import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useNav } from "@/hooks/use-nav";
import { sameTerminal, terminalReference, type BindingPane } from "../../../fleet/bindings/identity.ts";
import { taskAncestors, taskBody, type TodoTask } from "../../../fleet/todoist/model.ts";
import { taskRows } from "../../../fleet/todoist/view.ts";
import { FleetPanel } from "@/components/fleet-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapse } from "@/components/ui/collapse";
import { Notice } from "@/components/ui/notice";
import { useDialogFocus } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { asJsonString, parseJson } from "@/lib/json";
import { deliverTodoistTask } from "@/lib/fleet-task-delivery";
import { deliveryReceipt, hasDeliveryReceipt, saveDeliveryReceipt, todoistRequest, TodoistClientError, type TodoistHistory } from "@/lib/fleet-todoist";
import { useTodoist, useTodoistAvailable } from "./fleet-todoist-provider";

function displayBody(description: string): string {
  try { return taskBody(description); } catch { return description; }
}

type TaskPane = BindingPane & { readonly agent?: string; readonly kind?: string };

const FIELD = "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function errorText(code: string): string {
  if (code === "descendants_incomplete") return t("fleet.todoist.descendants");
  if (code === "ancestors_completed" || code === "parent_completed") return t("fleet.todoist.ancestors");
  if (code === "selection_changed" || code === "task_changed") return t("fleet.todoist.conflict");
  if (code === "sent_binding_pending") return t("fleet.todoist.sentPending");
  if (code === "recurring_occurrence") return t("fleet.todoist.recurringHistory");
  if (code === "composer_not_ready") return t("fleet.todoist.composerBlocked");
  if (code === "terminal_unavailable") return t("fleet.todoist.terminalUnavailable");
  if (code === "reconnect_required" || code === "not_connected") return t("fleet.todoist.reconnect");
  if (code === "rate_limited") return t("fleet.todoist.rateLimited");
  return t("fleet.todoist.failed");
}

export function TodoistDialog({ title, close, children }: { title: string; close(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!ref.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.stopPropagation(); close(); }
      if (event.key === "Tab") {
        const controls = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]');
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [close]);
  return <FleetPanel open onClose={close} label={title}>
    <div ref={ref} role="group" tabIndex={-1} className="flex max-h-[75dvh] flex-col gap-3 overflow-y-auto p-4 [&_button]:min-h-11">
      <h2 className="text-sm font-semibold">{title}</h2>{children}
    </div>
  </FleetPanel>;
}

export function TodoistBlockers({ error, close }: { error: TodoistClientError; close(): void }) {
  useLocale();
  return <TodoistDialog title={errorText(error.code)} close={close}>
    <ul className="list-disc space-y-2 pl-5 text-sm">{error.blockers.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
    <Button onClick={close}>{t("fleet.todoist.close")}</Button>
  </TodoistDialog>;
}

function TodoistProblem() {
  const { error, clearError } = useTodoist();
  useLocale();
  return <Collapse open={error !== null && error.blockers.length === 0}>{error && <Notice tone="danger" variant="box" onDismiss={clearError} dismissLabel={t("fleet.todoist.close")}>{errorText(error.code)}</Notice>}</Collapse>;
}

export function FleetTodoistSettings() {
  const available = useTodoistAvailable();
  return available ? <TodoistSettingsBody /> : null;
}

function TodoistSettingsBody() {
  const todo = useTodoist();
  const [clientId, setClientId] = useState(""), [clientSecret, setSecret] = useState("");
  const [configuring, setConfiguring] = useState(false);
  useLocale();
  return <Card className="gap-3 p-4 [&_button]:min-h-11">
    <h3 className="text-sm font-semibold">Todoist</h3>
    <p className="text-xs text-muted-foreground">{t("fleet.todoist.shared")}</p>
    <TodoistProblem />
    {!todo.state ? <Button variant="outline" onClick={() => void todo.refresh()}>{t("fleet.todoist.refresh")}</Button> : <>
      {!todo.state.connected && <label className="block text-xs">{t("fleet.todoist.callback")}<input className={FIELD} value={todo.state.callback} readOnly onFocus={(event) => event.target.select()} /></label>}
      {(!todo.state.configured || configuring) && <form className="space-y-3 [&_button]:min-h-11" onSubmit={(event) => {
        event.preventDefault();
        void todo.mutate("configure", { clientId, clientSecret }).then((ok) => { if (ok) { setClientId(""); setSecret(""); setConfiguring(false); } return ok; });
      }}>
        <p className="text-xs">{t("fleet.todoist.setup")}</p>
        <label className="block text-xs">{t("fleet.todoist.clientId")}<input className={FIELD} value={clientId} onChange={(event) => setClientId(event.target.value)} required autoComplete="off" /></label>
        <label className="block text-xs">{t("fleet.todoist.clientSecret")}<input className={FIELD} type="password" value={clientSecret} onChange={(event) => setSecret(event.target.value)} required autoComplete="new-password" /></label>
        <Button type="submit" disabled={todo.busy}>{t("fleet.todoist.save")}</Button>
        {configuring && <Button type="button" variant="outline" onClick={() => { setConfiguring(false); setClientId(""); setSecret(""); }}>{t("fleet.todoist.cancel")}</Button>}
      </form>}
      {todo.state.configured && !configuring && <Button variant="outline" disabled={todo.busy} onClick={() => setConfiguring(true)}>{t("fleet.todoist.appSettings")}</Button>}
      {todo.state.configured && !todo.state.connected && <Button disabled={todo.busy} onClick={() => void todo.perform(async () => {
        const result = await todoistRequest<{ url: string }>("connect", {});
        const url = new URL(result.url);
        if (url.origin !== "https://app.todoist.com") throw new TodoistClientError("integration_unavailable");
        window.location.assign(url.href);
      })}>{t("fleet.todoist.connect")}</Button>}
      {todo.state.configured && !configuring && <div className="space-y-2 text-xs">
        <label className="block">{t("fleet.todoist.clientId")}<input className={FIELD} value={todo.state.clientId ?? ""} readOnly /></label>
        <p>{t("fleet.todoist.secretSaved")}</p>
      </div>}
      {todo.state.connected && <Button variant="outline" disabled={todo.busy} onClick={() => void todo.mutate("disconnect")}>{t("fleet.todoist.disconnect")}</Button>}
    </>}
  </Card>;
}

function TaskEditor({ task, parentId, close }: { task?: TodoTask; parentId: string | null; close(): void }) {
  const todo = useTodoist();
  const [title, setTitle] = useState(task?.title ?? ""), [description, setDescription] = useState(() => task ? displayBody(task.description) : "");
  const parent = parentId ? [...(todo.state?.tasks ?? []), ...(todo.state?.boundTasks ?? [])].find((entry) => entry.id === parentId) : undefined;
  const [projectId, setProjectId] = useState(task?.projectId ?? parent?.projectId ?? "");
  useLocale();
  return <TodoistDialog title={t(task ? "fleet.todoist.edit" : "fleet.todoist.add")} close={close}>
    <form className="space-y-3 [&_button]:min-h-11" onSubmit={(event) => {
      event.preventDefault();
      const mutation = task ? todo.mutate("edit", { taskId: task.id, title, description, expected: task.updatedAt, originalTitle: task.title, originalDescription: task.description }) : todo.mutate("create", { title, description, parentId, projectId });
      void mutation.then((ok) => { if (ok) close(); return ok; });
    }}>
      <label className="block text-xs">{t("fleet.todoist.project")}
        <select className={FIELD} value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={Boolean(task || parentId)} required>
          <option value="">{t("fleet.todoist.chooseProject")}</option>
          {todo.state?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label className="block text-xs">{t("fleet.todoist.title")}<input className={FIELD} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} /></label>
      <label className="block text-xs">{t("fleet.todoist.description")}<textarea className={`${FIELD} min-h-40`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={16_000} /></label>
      <TodoistProblem />
      <div className="flex gap-2"><Button type="submit" disabled={todo.busy}>{t("fleet.todoist.save")}</Button><Button type="button" variant="outline" onClick={close}>{t("fleet.todoist.cancel")}</Button></div>
    </form>
  </TodoistDialog>;
}

function readView(): "tree" | "list" {
  try { return localStorage.getItem("fleet:todoist:view") === "list" ? "list" : "tree"; } catch { return "tree"; }
}

export function FleetTodoistPane({ pane }: { pane?: TaskPane }) {
  const todo = useTodoist(), state = todo.state;
  const nav = useNav();
  const [view, setView] = useState(readView), [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ task?: TodoTask; parentId: string | null } | null>(null);
  const [history, setHistory] = useState<TodoistHistory | null>(null), [showHistory, setShowHistory] = useState(false);
  const ref = pane ? terminalReference(pane) : null;
  useLocale();
  useEffect(() => {
    setHistory(null); setShowHistory(false); setSelectedTask(null); setEditor(null);
    try {
      const value = parseJson(localStorage.getItem(`fleet:todoist:collapsed:${state?.accountId ?? ""}`) ?? "[]");
      setCollapsed(new Set(Array.isArray(value) ? value.flatMap((item) => { const text = asJsonString(item); return text === undefined ? [] : [text]; }) : []));
    } catch { setCollapsed(new Set()); }
  }, [state?.generation, state?.accountId]);
  if (!state) return <div className="p-3"><TodoistProblem /><Button variant="outline" onClick={() => void todo.refresh()}>{t("fleet.todoist.refresh")}</Button></div>;
  if (!state.connected) return <div className="space-y-3 p-3 text-sm"><p>{t("fleet.todoist.selectInSettings")}</p><Button variant="outline" onClick={() => nav.down("/settings")}>{t("fleet.todoist.settings")}</Button><TodoistProblem /></div>;
  const source = showHistory ? history?.tasks ?? [] : state.tasks;
  const groups = state.projects.map((project) => ({ project, rows: taskRows(source.filter((task) => task.projectId === project.id), state.sections, !showHistory && view === "tree", collapsed) }));
  const projectName = (id: string) => state.projects.find((project) => project.id === id)?.name ?? id;
  const byId = new Map([...state.tasks, ...state.boundTasks, ...(history?.tasks ?? [])].map((task) => [task.id, task]));
  const bound = ref ? state.links.filter((link) => sameTerminal(link.terminal, ref)) : [];
  const boundIds = new Set(bound.map((link) => link.taskId));
  const openTask = selectedTask ? byId.get(selectedTask) : undefined;
  const loadHistory = () => void todo.perform(async (snapshot) => {
    const next = await todoistRequest<TodoistHistory>(`history?generation=${snapshot.generation}&before=${history?.since ?? Date.now()}`);
    setHistory((old) => ({ ...next, until: old?.until ?? next.until, tasks: [...new Map([...(old?.tasks ?? []), ...next.tasks].map((task) => [task.id, task])).values()] }));
  });
  const toggleTask = async (task: TodoTask, reopen: boolean) => {
    const ok = await todo.mutate(reopen ? "reopen" : "complete", { taskId: task.id });
    if (ok) setHistory((old) => old ? { ...old, tasks: old.tasks.filter((entry) => entry.id !== task.id) } : null);
  };
  const sendTask = (task: TodoTask) => void todo.perform(async (snapshot) => {
    if (!ref || !snapshot.accountId) throw new TodoistClientError("terminal_unavailable");
    const receipt = deliveryReceipt(snapshot.accountId, task.id, ref);
    if (!hasDeliveryReceipt(receipt)) {
      const prepared = await todoistRequest<{ text: string; paneId: string }>("prepare", { taskId: task.id, generation: snapshot.generation, terminal: { ...ref } });
      if (!await deliverTodoistTask(ref, prepared.paneId, prepared.text)) throw new TodoistClientError("composer_not_ready");
      saveDeliveryReceipt(receipt, true);
    }
    try { await todoistRequest("bind", { taskId: task.id, generation: snapshot.generation, terminal: { ...ref } }); }
    catch { throw new TodoistClientError("sent_binding_pending"); }
    saveDeliveryReceipt(receipt, false);
  });
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [&_button]:min-h-11" data-slot="todoist-pane">
    <div className="flex flex-wrap items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{t("fleet.todoist.allProjects")}</strong><Button size="sm" variant="outline" disabled={todo.busy} onClick={() => void todo.refresh()}>{t("fleet.todoist.refresh")}</Button></div>
    <TodoistProblem />
    <div className="flex flex-wrap gap-1" aria-label={t("fleet.todoist.view")}>
      {(["tree", "list"] as const).map((mode) => <Button key={mode} size="sm" variant={!showHistory && view === mode ? "default" : "outline"} aria-pressed={!showHistory && view === mode} onClick={() => {
        setView(mode); setShowHistory(false); try { localStorage.setItem("fleet:todoist:view", mode); } catch { /* Browser-local preference. */ }
      }}>{t(mode === "tree" ? "fleet.todoist.tree" : "fleet.todoist.list")}</Button>)}
      <Button size="sm" variant={showHistory ? "default" : "outline"} aria-pressed={showHistory} disabled={todo.busy} onClick={() => { setShowHistory(true); if (!history) loadHistory(); }}>{t("fleet.todoist.history")}</Button>
      <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => setEditor({ parentId: null })}>{t("fleet.todoist.add")}</Button>
    </div>
    {bound.length > 0 && <section aria-label={t("fleet.todoist.bound")} className="space-y-1 border-b border-rule pb-3"><h3 className="text-xs font-medium">{t("fleet.todoist.bound")}</h3>{bound.map((link) => <Button key={link.id} variant="outline" size="sm" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setSelectedTask(link.taskId)}>{byId.get(link.taskId)?.title ?? t("fleet.todoist.taskUnavailable")} · {projectName(byId.get(link.taskId)?.projectId ?? link.projectId)}{link.state === "pending" ? ` · ${t("fleet.todoist.pending")}` : ""}</Button>)}</section>}
    {source.length === 0 && <p className="text-xs text-muted-foreground">{t("fleet.todoist.empty")}</p>}
    {groups.map(({ project, rows }) => <section key={project.id} className="space-y-1" aria-label={project.name}>
      <h3 className="border-b border-rule py-2 text-xs font-medium">{project.name}</h3>
      {rows.length === 0 && <p className="py-2 text-xs text-muted-foreground">{t("fleet.todoist.empty")}</p>}
      <ul className="space-y-1">{rows.map(({ task, depth, children }) => {
      const chain = taskAncestors(task, byId);
      const section = state.sections.find((entry) => entry.id === task.sectionId)?.name;
      return <li key={task.id} style={{ paddingInlineStart: Math.min(depth, 8) * 12 }}>
        <div className={`flex items-start gap-1 rounded-md border p-1 ${boundIds.has(task.id) ? "border-primary/50 bg-primary/10" : "border-transparent"}`}>
          {view === "tree" && !showHistory && (children ? <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t(collapsed.has(task.id) ? "fleet.todoist.expand" : "fleet.todoist.collapse")} aria-expanded={!collapsed.has(task.id)} onClick={() => {
            const next = new Set(collapsed); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); setCollapsed(next);
            try { localStorage.setItem(`fleet:todoist:collapsed:${state.accountId ?? ""}`, JSON.stringify([...next])); } catch { /* Browser-local preference. */ }
          }}>{collapsed.has(task.id) ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</Button> : <span className="size-11 shrink-0" aria-hidden />)}
          <label className="flex size-11 shrink-0 items-center justify-center"><input type="checkbox" className="size-4" checked={showHistory || task.completed} disabled={todo.busy || (showHistory && task.recurring && !task.completed)} aria-label={t(task.completed ? "fleet.todoist.reopenTask" : "fleet.todoist.completeTask", { title: task.title })} onChange={() => void toggleTask(task, showHistory || task.completed)} /></label>
          <button type="button" className="min-h-11 min-w-0 flex-1 break-words px-1 text-left font-content text-xs focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)} aria-expanded={selectedTask === task.id} aria-label={`${task.title} · ${project.name}`}>
            <span className={showHistory || task.completed ? "text-muted-foreground line-through" : ""}>{task.title}</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">{[project.name, section, ...(view === "list" && chain.ok ? chain.ancestors.map((ancestor) => ancestor.title) : [])].filter(Boolean).join(" / ")}</span>
          </button>
        </div>
      </li>;
    })}</ul></section>)}
    {showHistory && <div className="space-y-2 text-xs">{history && <p>{t("fleet.todoist.historyRange", { since: new Date(history.since).toLocaleDateString(), until: new Date(history.until).toLocaleDateString() })}</p>}<Button variant="outline" size="sm" disabled={todo.busy} onClick={loadHistory}>{t("fleet.todoist.older")}</Button></div>}
    {openTask && <section className="space-y-2 border-t border-rule pt-3" aria-label={openTask.title}>
      <h3 className="text-sm font-medium">{openTask.title}</h3><p className="text-xs text-muted-foreground">{projectName(openTask.projectId)}</p><p className="whitespace-pre-wrap break-words font-content text-xs">{displayBody(openTask.description) || t("fleet.todoist.noDescription")}</p>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={todo.busy || (showHistory && openTask.recurring && !openTask.completed)} onClick={() => void toggleTask(openTask, showHistory || openTask.completed)}>{t(showHistory || openTask.completed ? "fleet.todoist.reopen" : "fleet.todoist.complete")}</Button>
        <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => setEditor({ task: openTask, parentId: openTask.parentId })}>{t("fleet.todoist.edit")}</Button>
        <Button size="sm" variant="outline" disabled={todo.busy || openTask.completed} onClick={() => setEditor({ parentId: openTask.id })}>{t("fleet.todoist.addChild")}</Button>
        <Button size="sm" variant="outline" disabled={todo.busy || !ref} onClick={() => { if (ref) void todo.mutate(boundIds.has(openTask.id) ? "unbind" : "bind", { taskId: openTask.id, terminal: { ...ref } }); }}>{t(boundIds.has(openTask.id) ? "fleet.todoist.unbind" : "fleet.todoist.bind")}</Button>
        {ref && bound.some((link) => link.taskId === openTask.id && link.state === "pending") && !(state.accountId && hasDeliveryReceipt(deliveryReceipt(state.accountId, openTask.id, ref))) && <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => void todo.mutate("bind", { taskId: openTask.id, terminal: { ...ref } })}>{t("fleet.todoist.retryBinding")}</Button>}
        <Button size="sm" disabled={todo.busy || !ref || !pane?.agent || pane.agent === "shell" || pane.kind === "shell"} onClick={() => sendTask(openTask)}>{t(ref && state.accountId && hasDeliveryReceipt(deliveryReceipt(state.accountId, openTask.id, ref)) ? "fleet.todoist.retryBinding" : "fleet.todoist.send")}</Button>
        <a className="inline-flex min-h-11 items-center gap-1 px-2 text-xs underline" href={openTask.url} target="_blank" rel="noreferrer">Todoist<ExternalLink className="size-3" aria-hidden /></a>
      </div>
      {showHistory && openTask.recurring && !openTask.completed && <p className="text-xs text-muted-foreground">{t("fleet.todoist.recurringHistory")}</p>}
      {!ref && <p className="text-xs text-muted-foreground">{t("fleet.todoist.openPane")}</p>}
    </section>}
    {editor && <TaskEditor {...editor} close={() => setEditor(null)} />}
  </div>;
}

export function FleetRightSidebar({ agents, pane }: { agents: ReactNode; pane?: TaskPane }) {
  const [tab, setTab] = useState<"agents" | "todoist">("agents");
  useLocale();
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex gap-1 border-b border-rule p-2 [&_button]:min-h-11" aria-label={t("fleet.todoist.sidebar")}>
    <Button size="sm" variant={tab === "agents" ? "default" : "outline"} aria-pressed={tab === "agents"} onClick={() => setTab("agents")}>{t("fleet.navigation.agents")}</Button>
    <Button size="sm" variant={tab === "todoist" ? "default" : "outline"} aria-pressed={tab === "todoist"} onClick={() => setTab("todoist")}>Todoist</Button>
  </div>{tab === "agents" ? agents : <FleetTodoistPane pane={pane} />}</div>;
}
