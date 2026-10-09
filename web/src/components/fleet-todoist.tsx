import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useNav } from "@/hooks/use-nav";
import { sameTerminal, terminalReference, terminalKey, type BindingPane } from "../../../fleet/bindings/identity.ts";
import { taskAncestors, taskBody, type TodoTask, type TodoProject, type TodoFilter } from "../../../fleet/todoist/model.ts";
import { taskRows, type TaskRow } from "../../../fleet/todoist/view.ts";
import { FleetPanel } from "@/components/fleet-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapse } from "@/components/ui/collapse";
import { Notice } from "@/components/ui/notice";
import { useDialogFocus } from "@/components/ui/sheet";
import { deliverTodoistTask } from "@/lib/fleet-task-delivery";
import { deliveryReceipt, hasDeliveryReceipt, saveDeliveryReceipt, todoistRequest, TodoistClientError, type TodoistHistory } from "@/lib/fleet-todoist";
import { useTodoist, useTodoistAvailable } from "./fleet-todoist-provider";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";

function rowGuides(rows: readonly TaskRow[]): boolean[][] {
  const nextDepth: number[] = [];
  const result: boolean[][] = [];
  for (let index = rows.length - 1; index >= 0; index--) {
    const depth = rows[index]?.depth ?? 0;
    result[index] = Array.from({ length: Math.min(depth, 8) }, (_, level) => nextDepth[level + 1] === level + 1);
    for (let level = depth; level <= 8; level++) nextDepth[level] = depth;
  }
  return result;
}

function displayBody(description: string): string {
  try { return taskBody(description); } catch { return description; }
}

type TaskPane = BindingPane & { readonly agent?: string; readonly kind?: string; readonly terminalTitle?: string; readonly tabLabel?: string };

const FIELD = "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function errorText(code: string): string {
  if (code === "descendants_incomplete") return ft("fleet.todoist.descendants");
  if (code === "ancestors_completed" || code === "parent_completed") return ft("fleet.todoist.ancestors");
  if (code === "selection_changed" || code === "task_changed") return ft("fleet.todoist.conflict");
  if (code === "sent_binding_pending") return ft("fleet.todoist.sentPending");
  if (code === "recurring_occurrence") return ft("fleet.todoist.recurringHistory");
  if (code === "composer_not_ready") return ft("fleet.todoist.composerBlocked");
  if (code === "terminal_unavailable") return ft("fleet.todoist.terminalUnavailable");
  if (code === "reconnect_required" || code === "not_connected") return ft("fleet.todoist.reconnect");
  if (code === "scope_unavailable") return ft("fleet.todoist.scopeUnavailable");
  if (code === "rate_limited") return ft("fleet.todoist.rateLimited");
  return ft("fleet.todoist.failed");
}

export function TodoistDialog({ title, close, children, focusCancel = false }: { title: string; close(): void; children: ReactNode; focusCancel?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);
  useEffect(() => { if (focusCancel) ref.current?.querySelector<HTMLButtonElement>("button[data-todoist-cancel]")?.focus(); }, [focusCancel]);
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
  useFleetLocale();
  return <TodoistDialog title={errorText(error.code)} close={close}>
    <ul className="list-disc space-y-2 pl-5 text-sm">{error.blockers.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
    <Button onClick={close}>{ft("fleet.todoist.close")}</Button>
  </TodoistDialog>;
}

function TodoistProblem() {
  const { error, clearError } = useTodoist();
  useFleetLocale();
  return <Collapse open={error !== null && error.blockers.length === 0}>{error && <Notice tone="danger" variant="box" onDismiss={clearError} dismissLabel={ft("fleet.todoist.close")}>{errorText(error.code)}</Notice>}</Collapse>;
}

export function FleetTodoistSettings() {
  const available = useTodoistAvailable();
  return available ? <TodoistSettingsBody /> : null;
}

function TodoistScopePicker() {
  const todo = useTodoist();
  useFleetLocale();
  const [choices, setChoices] = useState<{ projects: TodoProject[]; filters: TodoFilter[] } | null>(null);
  const [choiceError, setChoiceError] = useState(false), [choiceReload, setChoiceReload] = useState(0);
  const connected = todo.state?.connected, accountId = todo.state?.accountId;
  useEffect(() => {
    setChoices(null); setChoiceError(false);
    if (!connected) return;
    let active = true;
    void todoistRequest<{ projects: TodoProject[]; filters: TodoFilter[] }>("choices")
      .then((value) => { if (active) setChoices(value); return value; })
      .catch(() => { if (active) setChoiceError(true); });
    return () => { active = false; };
  }, [connected, accountId, choiceReload]);
  const scope = todo.state?.scope ?? { kind: "all" as const };
  const scopeValue = scope.kind === "all" ? "all" : `${scope.kind}:${scope.id}`;
  if (!connected) return null;
  return <div className="space-y-2">
        <div className="flex items-end gap-2"><label className="block min-w-0 flex-1 text-xs">{ft("fleet.todoist.displayScope")}
          <select className={FIELD} value={scopeValue} disabled={todo.busy} onChange={(event) => {
            const value = event.target.value;
            if (value === "all") { void todo.mutate("scope", { scope: { kind: "all" } }); return; }
            const kind = value.startsWith("project:") ? "project" : "filter";
            const id = value.slice(kind.length + 1), entry = (kind === "project" ? choices?.projects : choices?.filters)?.find((item) => item.id === id);
            if (entry) void todo.mutate("scope", { scope: { kind, id, name: entry.name } });
          }}>
            <option value="all">{ft("fleet.todoist.allProjects")}</option>
            {scope.kind !== "all" && !(scope.kind === "project" ? choices?.projects : choices?.filters)?.some((item) => item.id === scope.id) && <option value={scopeValue}>{scope.name}</option>}
            <optgroup label={ft("fleet.todoist.projects")}>{choices?.projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</optgroup>
            <optgroup label={ft("fleet.todoist.filters")}>{choices?.filters.map((filter) => <option key={filter.id} value={`filter:${filter.id}`}>{filter.name}</option>)}</optgroup>
          </select>
        </label>
        <Button size="icon" variant="outline" className="size-11 shrink-0" aria-label={ft("fleet.todoist.refresh")} disabled={todo.busy} onClick={() => setChoiceReload((value) => value + 1)}><RefreshCw className="size-4" /></Button></div>
        {choiceError && <Notice tone="danger" variant="box">{ft("fleet.todoist.failed")}</Notice>}
      </div>;
}

function TodoistSettingsBody() {
  const todo = useTodoist();
  const [clientId, setClientId] = useState(""), [clientSecret, setSecret] = useState("");
  const [configuring, setConfiguring] = useState(false);
  useFleetLocale();
  return <Card className="gap-3 p-4 [&_button]:min-h-11">
    <h3 className="text-sm font-semibold">Todoist</h3>
    <p className="text-xs text-muted-foreground">{ft("fleet.todoist.shared")}</p>
    <TodoistProblem />
    {!todo.state ? <Button variant="outline" onClick={() => void todo.refresh()}>{ft("fleet.todoist.refresh")}</Button> : <>
      {!todo.state.connected && <label className="block text-xs">{ft("fleet.todoist.callback")}<input className={FIELD} value={todo.state.callback} readOnly onFocus={(event) => event.target.select()} /></label>}
      {(!todo.state.configured || configuring) && <form className="space-y-3 [&_button]:min-h-11" onSubmit={(event) => {
        event.preventDefault();
        void todo.mutate("configure", { clientId, clientSecret }).then((ok) => { if (ok) { setClientId(""); setSecret(""); setConfiguring(false); } return ok; });
      }}>
        <p className="text-xs">{ft("fleet.todoist.setup")}</p>
        <label className="block text-xs">{ft("fleet.todoist.clientId")}<input className={FIELD} value={clientId} onChange={(event) => setClientId(event.target.value)} required autoComplete="off" /></label>
        <label className="block text-xs">{ft("fleet.todoist.clientSecret")}<input className={FIELD} type="password" value={clientSecret} onChange={(event) => setSecret(event.target.value)} required autoComplete="new-password" /></label>
        <Button type="submit" disabled={todo.busy}>{ft("fleet.todoist.save")}</Button>
        {configuring && <Button type="button" variant="outline" onClick={() => { setConfiguring(false); setClientId(""); setSecret(""); }}>{ft("fleet.todoist.cancel")}</Button>}
      </form>}
      {todo.state.configured && !configuring && <Button variant="outline" disabled={todo.busy} onClick={() => setConfiguring(true)}>{ft("fleet.todoist.appSettings")}</Button>}
      {todo.state.configured && !todo.state.connected && <Button disabled={todo.busy} onClick={() => void todo.perform(async () => {
        const result = await todoistRequest<{ url: string }>("connect", {});
        const url = new URL(result.url);
        if (url.origin !== "https://app.todoist.com") throw new TodoistClientError("integration_unavailable");
        window.location.assign(url.href);
      })}>{ft("fleet.todoist.connect")}</Button>}
      {todo.state.configured && !configuring && <div className="space-y-2 text-xs">
        <label className="block">{ft("fleet.todoist.clientId")}<input className={FIELD} value={todo.state.clientId ?? ""} readOnly /></label>
        <p>{ft("fleet.todoist.secretSaved")}</p>
      </div>}
      <TodoistScopePicker />
      {todo.state.connected && <Button variant="outline" disabled={todo.busy} onClick={() => void todo.mutate("disconnect")}>{ft("fleet.todoist.disconnect")}</Button>}
    </>}
  </Card>;
}

function TaskEditor({ task, parentId, close }: { task?: TodoTask; parentId: string | null; close(): void }) {
  const todo = useTodoist();
  const [title, setTitle] = useState(task?.title ?? ""), [description, setDescription] = useState(() => task ? displayBody(task.description) : "");
  const parent = parentId ? [...(todo.state?.treeTasks ?? []), ...(todo.state?.tasks ?? []), ...(todo.state?.boundTasks ?? [])].find((entry) => entry.id === parentId) : undefined;
  const [projectId, setProjectId] = useState(task?.projectId ?? parent?.projectId ?? (todo.state?.scope.kind === "project" ? todo.state.scope.id : ""));
  useFleetLocale();
  return <TodoistDialog title={ft(task ? "fleet.todoist.edit" : "fleet.todoist.add")} close={close}>
    <form className="space-y-3 [&_button]:min-h-11" onSubmit={(event) => {
      event.preventDefault();
      const mutation = task ? todo.mutate("edit", { taskId: task.id, title, description, expected: task.updatedAt, originalTitle: task.title, originalDescription: task.description }) : todo.mutate("create", { title, description, parentId, projectId });
      void mutation.then((ok) => { if (ok) close(); return ok; });
    }}>
      <label className="block text-xs">{ft("fleet.todoist.project")}
        <select className={FIELD} value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={Boolean(task || parentId)} required>
          <option value="">{ft("fleet.todoist.chooseProject")}</option>
          {todo.state?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label className="block text-xs">{ft("fleet.todoist.title")}<input className={FIELD} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} /></label>
      <label className="block text-xs">{ft("fleet.todoist.description")}<textarea className={`${FIELD} min-h-40`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={16_000} /></label>
      <TodoistProblem />
      <div className="flex gap-2"><Button type="submit" disabled={todo.busy}>{ft("fleet.todoist.save")}</Button><Button type="button" variant="outline" onClick={close}>{ft("fleet.todoist.cancel")}</Button></div>
    </form>
  </TodoistDialog>;
}

function readView(): "tree" | "list" {
  try { return localStorage.getItem("fleet:todoist:view") === "list" ? "list" : "tree"; } catch { return "tree"; }
}

export function FleetTodoistPane({ pane }: { pane?: TaskPane }) {
  const todo = useTodoist(), state = todo.state, perform = todo.perform;
  const nav = useNav();
  const [view, setView] = useState(readView);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedFromBound, setSelectedFromBound] = useState(false);
  const [sendRequest, setSendRequest] = useState<{ task: TodoTask; key: string; target: string } | null>(null);
  const [editor, setEditor] = useState<{ task?: TodoTask; parentId: string | null } | null>(null);
  const [history, setHistory] = useState<TodoistHistory | null>(null), [showHistory, setShowHistory] = useState(false);
  const ref = pane ? terminalReference(pane) : null;
  const sendKey = JSON.stringify([ref ? terminalKey(ref) : null, pane?.paneId, pane?.agent, state?.accountId, state?.generation]);
  useEffect(() => { if (sendRequest && sendRequest.key !== sendKey) setSendRequest(null); }, [sendRequest, sendKey]);
  useFleetLocale();
  useEffect(() => {
    setHistory(null); setSelectedTask(null); setEditor(null);

  }, [state?.generation, state?.accountId]);
  useEffect(() => { setShowHistory(false); }, [state?.accountId]);
  useEffect(() => {
    if (!showHistory || !state?.connected || history?.generation === state.generation) return;
    void perform(async (snapshot) => {
      const next = await todoistRequest<TodoistHistory>(`history?generation=${snapshot.generation}&before=${Date.now()}`);
      setHistory(next);
    });
  }, [state?.connected, state?.generation, showHistory, history, perform]);
  if (!state) return <div className="p-3"><TodoistProblem /><Button variant="outline" onClick={() => void todo.refresh()}>{ft("fleet.todoist.refresh")}</Button></div>;
  if (!state.connected) return <div className="space-y-3 p-3 text-sm"><p>{ft("fleet.todoist.selectInSettings")}</p><Button variant="outline" onClick={() => nav.down("/settings")}>{ft("fleet.todoist.settings")}</Button><TodoistProblem /></div>;
  const tree = !showHistory && view === "tree";
  const source = showHistory ? history?.tasks ?? [] : tree ? state.treeTasks : state.tasks;
  const visibleProjects = state.scope.kind === "project" ? state.projects.filter((project) => project.id === (state.scope.kind === "project" ? state.scope.id : "")) : state.projects;
  const groups = tree
    ? visibleProjects.filter((project) => state.scope.kind === "project" || source.some((task) => task.projectId === project.id)).map((project) => ({ project, rows: taskRows(source.filter((task) => task.projectId === project.id), state.sections, true, new Set()) }))
    : [{ project: null, rows: taskRows(source, state.sections, false, new Set(), showHistory) }];
  const projectName = (id: string) => state.projects.find((project) => project.id === id)?.name ?? id;
  const byId = new Map([...state.tasks, ...state.treeTasks, ...state.contextTasks, ...state.boundTasks, ...(history?.tasks ?? [])].map((task) => [task.id, task]));
  const bound = ref ? state.links.filter((link) => sameTerminal(link.terminal, ref)) : [];
  const boundIds = new Set(bound.map((link) => link.taskId));
  const loadHistory = () => void todo.perform(async (snapshot) => {
    const next = await todoistRequest<TodoistHistory>(`history?generation=${snapshot.generation}&before=${history?.since ?? Date.now()}`);
    setHistory((old) => ({ ...next, until: old?.until ?? next.until, tasks: [...new Map([...(old?.tasks ?? []), ...next.tasks].map((task) => [task.id, task])).values()] }));
  });
  const toggleTask = async (task: TodoTask, reopen: boolean) => {
    const ok = await todo.mutate(reopen ? "reopen" : "complete", { taskId: task.id });
    if (ok) setHistory((old) => reopen && old ? { ...old, tasks: old.tasks.filter((entry) => entry.id !== task.id) } : null);
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
  const taskBindingButton = (task: TodoTask) => <Button type="button" size="sm" variant="outline"
    className="min-h-11 min-w-11 shrink-0 px-2 text-xs" disabled={todo.busy || !ref}
    aria-pressed={boundIds.has(task.id)} title={ft(boundIds.has(task.id) ? "fleet.todoist.unbind" : "fleet.todoist.bind")}
    aria-label={`${ft(boundIds.has(task.id) ? "fleet.todoist.unbind" : "fleet.todoist.bind")}: ${task.title}`}
    onClick={() => { if (ref) void todo.mutate(boundIds.has(task.id) ? "unbind" : "bind", { taskId: task.id, terminal: { ...ref } }); }}>
    {ft(boundIds.has(task.id) ? "fleet.todoist.unbindShort" : "fleet.todoist.bindShort")}
  </Button>;
  const taskMetadata = (task: TodoTask) => {
    const chain = taskAncestors(task, byId);
    const section = state.sections.find((entry) => entry.id === task.sectionId)?.name;
    return [projectName(task.projectId), section, ...(chain.ok ? chain.ancestors.map((ancestor) => ancestor.title) : [])].filter(Boolean).join(" / ");
  };
  const taskDetails = (task: TodoTask) => <section className="space-y-2 border-t border-rule p-3 [&_button]:min-h-11" aria-label={task.title}>
      <p data-slot="todoist-task-metadata" className="break-words text-[10px] text-muted-foreground">{taskMetadata(task)}</p>
      <p className="whitespace-pre-wrap break-words font-content text-xs">{displayBody(task.description) || ft("fleet.todoist.noDescription")}</p>
      <div className="flex flex-wrap gap-1">
        {taskBindingButton(task)}
        <Button size="sm" variant="outline" disabled={todo.busy || (showHistory && task.recurring && !task.completed)} onClick={() => void toggleTask(task, showHistory || task.completed)}>{ft(showHistory || task.completed ? "fleet.todoist.reopen" : "fleet.todoist.complete")}</Button>
        <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => setEditor({ task: task, parentId: task.parentId })}>{ft("fleet.todoist.edit")}</Button>
        <Button size="sm" variant="outline" disabled={todo.busy || task.completed} onClick={() => setEditor({ parentId: task.id })}>{ft("fleet.todoist.addChild")}</Button>
        {ref && bound.some((link) => link.taskId === task.id && link.state === "pending") && !(state.accountId && hasDeliveryReceipt(deliveryReceipt(state.accountId, task.id, ref))) && <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => void todo.mutate("bind", { taskId: task.id, terminal: { ...ref } })}>{ft("fleet.todoist.retryBinding")}</Button>}
        <Button size="sm" disabled={todo.busy || !ref || !pane?.agent || pane.agent === "shell" || pane.kind === "shell"} onClick={() => {
          if (!ref || !pane || !state.accountId) return;
          if (hasDeliveryReceipt(deliveryReceipt(state.accountId, task.id, ref))) { sendTask(task); return; }
          setSendRequest({ task, key: sendKey, target: [pane.agent, ref.host || ft("fleet.navigation.thisHost"), ref.session, pane.terminalTitle || pane.tabLabel, pane.paneId].filter(Boolean).join(" · ") });
        }}>{ft(ref && state.accountId && hasDeliveryReceipt(deliveryReceipt(state.accountId, task.id, ref)) ? "fleet.todoist.retryBinding" : "fleet.todoist.send")}</Button>
        <a className="inline-flex min-h-11 items-center gap-1 px-2 text-xs underline" href={task.url} target="_blank" rel="noreferrer">Todoist<ExternalLink className="size-3" aria-hidden /></a>
      </div>
      {showHistory && task.recurring && !task.completed && <p className="text-xs text-muted-foreground">{ft("fleet.todoist.recurringHistory")}</p>}
    </section>;
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" data-slot="todoist-pane">
    <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11"><strong className="min-w-0 flex-1 truncate text-sm">{state.scope.kind === "all" ? ft("fleet.todoist.allProjects") : state.scope.name}</strong><Button size="sm" variant="outline" disabled={todo.busy} onClick={() => void todo.refresh()}>{ft("fleet.todoist.refresh")}</Button></div>
    <TodoistProblem />
    <TodoistScopePicker />
    {!ref && <p className="text-xs text-muted-foreground">{ft("fleet.todoist.openPane")}</p>}
    <div className="flex flex-wrap gap-1 [&_button]:min-h-11" aria-label={ft("fleet.todoist.view")}>
      {(["tree", "list"] as const).map((mode) => <Button key={mode} size="sm" variant={!showHistory && view === mode ? "default" : "outline"} aria-pressed={!showHistory && view === mode} onClick={() => {
        setView(mode); setShowHistory(false); try { localStorage.setItem("fleet:todoist:view", mode); } catch { /* Browser-local preference. */ }
      }}>{ft(mode === "tree" ? "fleet.todoist.tree" : "fleet.todoist.list")}</Button>)}
      <Button size="sm" variant={showHistory ? "default" : "outline"} aria-pressed={showHistory} disabled={todo.busy} onClick={() => setShowHistory(true)}>{ft("fleet.todoist.history")}</Button>
      <Button size="sm" variant="outline" disabled={todo.busy} onClick={() => setEditor({ parentId: null })}>{ft("fleet.todoist.add")}</Button>
    </div>
    {bound.length > 0 && <section aria-label={ft("fleet.todoist.bound")} className="space-y-1 border-b border-rule pb-3">
      <h3 className="text-xs font-medium">{ft("fleet.todoist.bound")}</h3>
      {bound.map((link) => {
        const task = byId.get(link.taskId), selected = selectedFromBound && selectedTask === link.taskId;
        return <div key={link.id} data-slot="todoist-bound-card" data-selected={selected} className={`overflow-hidden rounded-md border transition-colors duration-[240ms] motion-reduce:transition-none ${selected ? "border-primary/60 bg-primary/10 shadow-sm" : "border-border"}`}>
          <div className="flex items-start gap-1 p-0.5"><Button variant="ghost" size="sm" className="h-auto min-h-7 min-w-0 flex-1 justify-start whitespace-normal text-left [@media(pointer:coarse)]:min-h-11" aria-expanded={selected} onClick={() => { setSelectedFromBound(true); setSelectedTask(selected ? null : link.taskId); }}>
            {task?.title ?? ft("fleet.todoist.taskUnavailable")}{link.state === "pending" ? ` · ${ft("fleet.todoist.pending")}` : ""}
          </Button>
          </div>
          <Collapse open={selected && Boolean(task)}>{selected && task ? taskDetails(task) : null}</Collapse>
        </div>;
      })}
    </section>}
    {source.length === 0 && <p className="text-xs text-muted-foreground">{ft("fleet.todoist.empty")}</p>}
    {groups.map(({ project, rows }) => { const guidesByRow = rowGuides(rows); return <section key={project?.id ?? "all"} className="space-y-1" aria-label={project?.name ?? ft("fleet.todoist.allProjects")}>
      {project && <h3 className="border-b border-rule py-2 text-xs font-medium">{project.name}</h3>}
      {rows.length === 0 && <p className="py-2 text-xs text-muted-foreground">{ft("fleet.todoist.empty")}</p>}
      <ul className="space-y-0">{rows.map(({ task, depth, children }, index) => {
      const guides = guidesByRow[index] ?? [];
      const selected = !selectedFromBound && selectedTask === task.id;
      return <li key={task.id} className="relative flex pb-1 [--todoist-row-center:17px] [@media(pointer:coarse)]:[--todoist-row-center:25px]">
        {tree && <span data-slot="todoist-tree-guides" aria-hidden="true" className="pointer-events-none relative flex shrink-0" style={{ width: `min(${(Math.min(depth, 8) + 1) * 12}px, 35%)` }}>
          {guides.map((continuing, level) => <span key={level} data-continuing={continuing} className="relative min-w-0 flex-1">
            {(continuing || level === guides.length - 1) && <span data-slot="todoist-tree-line" className={`absolute start-1/2 top-0 border-s border-rule ${continuing ? "-bottom-1" : "h-[var(--todoist-row-center)]"}`} />}
            {level === guides.length - 1 && <span data-slot="todoist-tree-elbow" className="absolute start-1/2 top-[var(--todoist-row-center)] w-[150%] border-t border-rule" />}
          </span>)}
          <span className="relative min-w-0 flex-1">{children && <span data-slot="todoist-tree-stem" className="absolute -bottom-1 start-1/2 top-[var(--todoist-row-center)] border-s border-rule" />}</span>
        </span>}
        <div data-slot="todoist-task-card" data-selected={selected} className={`relative min-w-0 flex-1 overflow-hidden rounded-md border transition-colors duration-[240ms] motion-reduce:transition-none ${selected ? "border-primary/60 bg-primary/10 shadow-sm" : boundIds.has(task.id) ? "border-primary/30 bg-primary/5" : "border-transparent"}`}>
        <div data-slot="todoist-task-header" className="relative flex items-start gap-1 p-0.5">
          <button type="button" className="min-h-7 min-w-0 flex-1 break-words px-0 text-left font-content text-xs focus-visible:outline-2 focus-visible:outline-ring [@media(pointer:coarse)]:min-h-11" onClick={() => { setSelectedFromBound(false); setSelectedTask(selected ? null : task.id); }} aria-expanded={selected} aria-label={`${task.title} · ${projectName(task.projectId)}`}>
            <span className={showHistory || task.completed ? "text-muted-foreground line-through" : ""}>{task.title}</span>
          </button>
        </div>
        <Collapse open={selected}>{selected ? taskDetails(task) : null}</Collapse>
        </div>
      </li>;
    })}</ul></section>; })}
    {showHistory && <div className="space-y-2 text-xs">{history && <p>{ft("fleet.todoist.historyRange", { since: new Date(history.since).toLocaleDateString(), until: new Date(history.until).toLocaleDateString() })}</p>}<Button variant="outline" size="sm" disabled={todo.busy} onClick={loadHistory}>{ft("fleet.todoist.older")}</Button></div>}
    {sendRequest && sendRequest.key === sendKey && <TodoistDialog focusCancel title={ft("fleet.todoist.confirmSend")} close={() => setSendRequest(null)}>
      <p className="break-words font-content text-sm font-medium">{sendRequest.task.title}</p>
      <p className="break-words text-xs text-muted-foreground">{ft("fleet.todoist.sendDestination", { target: sendRequest.target })}</p>
      <p className="text-xs">{ft("fleet.todoist.sendConfirmHint")}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" data-todoist-cancel="" onClick={() => setSendRequest(null)}>{ft("fleet.todoist.cancel")}</Button>
        <Button type="button" disabled={todo.busy} onClick={() => {
          if (sendRequest.key !== sendKey) return;
          const task = sendRequest.task; setSendRequest(null); sendTask(task);
        }}>{ft("fleet.todoist.confirmSendButton")}</Button>
      </div>
    </TodoistDialog>}
    {editor && <TaskEditor {...editor} close={() => setEditor(null)} />}
  </div>;
}

export function FleetRightSidebar({ agents, pane }: { agents: ReactNode; pane?: TaskPane }) {
  const [tab, setTab] = useState<"agents" | "todoist">("agents");
  useFleetLocale();
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex gap-1 border-b border-rule p-2 [&_button]:min-h-11" aria-label={ft("fleet.todoist.sidebar")}>
    <Button size="sm" variant={tab === "agents" ? "default" : "outline"} aria-pressed={tab === "agents"} onClick={() => setTab("agents")}>{ft("fleet.navigation.agents")}</Button>
    <Button size="sm" variant={tab === "todoist" ? "default" : "outline"} aria-pressed={tab === "todoist"} onClick={() => setTab("todoist")}>Todoist</Button>
  </div>{tab === "agents" ? agents : <FleetTodoistPane pane={pane} />}</div>;
}
