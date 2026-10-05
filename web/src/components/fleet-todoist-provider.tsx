import { TodoistBlockers } from "./fleet-todoist";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TodoistClientError, todoistRequest, type TodoistSnapshot, type TodoistStatus } from "@/lib/fleet-todoist";
import type { JsonValue } from "@/lib/json";
import { isLocked } from "@/lib/idle";

interface TodoistContextValue {
  state: TodoistSnapshot | null;
  busy: boolean;
  error: TodoistClientError | null;
  activate(): void;
  refresh(): Promise<void>;
  perform(work: (state: TodoistSnapshot) => Promise<void>): Promise<boolean>;
  mutate(action: string, body?: Record<string, JsonValue>): Promise<boolean>;
  clearError(): void;
}
const TodoistContext = createContext<TodoistContextValue | null>(null);

export function FleetTodoistProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TodoistSnapshot | null>(null);
  const [active, setActive] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<TodoistClientError | null>(null);
  const serial = useRef(0), busyRef = useRef(false), current = useRef(state);
  current.current = state;
  const activate = useCallback(() => setActive(true), []);
  const refresh = useCallback(async () => {
    if (busyRef.current || isLocked() || document.visibilityState === "hidden") return;
    const own = ++serial.current;
    try {
      const status = await todoistRequest<TodoistStatus>("status");
      if (own !== serial.current) return;
      // Connection controls remain usable even if the provider's task inventory fails.
      setState((previous) => previous?.generation === status.generation && previous.accountId === status.accountId
        ? { ...previous, ...status }
        : { ...status, projects: [], tasks: [], sections: [], boundTasks: [] });
      const snapshot = status.connected
        ? await todoistRequest<TodoistSnapshot>(`tasks?generation=${status.generation}`)
        : { ...status, projects: [], tasks: [], sections: [], boundTasks: [] };
      if (own === serial.current) setState(snapshot);
    } catch (failure) { if (own === serial.current) setError(failure instanceof TodoistClientError ? failure : new TodoistClientError("integration_unavailable")); }
  }, []);
  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    const visible = () => { void refresh(); };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [active, refresh]);
  const perform = useCallback(async (work: (snapshot: TodoistSnapshot) => Promise<void>) => {
    const snapshot = current.current;
    if (busyRef.current || !snapshot || isLocked()) return false;
    busyRef.current = true; ++serial.current; setBusy(true); setError(null);
    let ok = false;
    try { await work(snapshot); ok = true; }
    catch (failure) { setError(failure instanceof TodoistClientError ? failure : new TodoistClientError("integration_unavailable")); }
    finally { busyRef.current = false; setBusy(false); await refresh(); }
    return ok;
  }, [refresh]);
  const value = useMemo<TodoistContextValue>(() => ({
    state, busy, error, activate, refresh, perform,
    mutate: (action, body = {}) => perform(async (snapshot) => { await todoistRequest(action, { ...body, generation: snapshot.generation }); }),
    clearError: () => setError(null),
  }), [state, busy, error, activate, refresh, perform]);
  return <TodoistContext value={value}>{children}{error && error.blockers.length > 0 && <TodoistBlockers error={error} close={() => setError(null)} />}</TodoistContext>;
}

export function useTodoist() {
  const context = useContext(TodoistContext);
  if (!context) throw new Error("Todoist requires its Fleet provider");
  const { activate } = context;
  useEffect(() => { activate(); }, [activate]);
  return context;
}

export function useTodoistAvailable(): boolean { return useContext(TodoistContext) !== null; }
