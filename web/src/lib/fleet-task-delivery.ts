import { isLocked } from "@/lib/idle";
import { useEffect, useRef } from "react";
import { sameTerminal, terminalReference, type BindingPane, type TerminalRef } from "../../../fleet/bindings/identity.ts";

interface ComposerPort {
  readonly pane: BindingPane | undefined;
  readonly blocked: boolean;
  readonly submit: (text: string) => Promise<boolean>;
}
let current: (() => ComposerPort) | null = null;
let sending = false;

/** A lifecycle-bound port to the existing composer, never an alternate terminal send API. */
export function useFleetTaskComposer(port: ComposerPort): void {
  const latest = useRef(port);
  latest.current = port;
  useEffect(() => {
    const read = () => latest.current;
    current = read;
    return () => { if (current === read) current = null; };
  }, []);
}

export async function deliverTodoistTask(reference: TerminalRef, paneId: string, text: string): Promise<boolean> {
  const read = current, port = read?.();
  const actual = port?.pane ? terminalReference(port.pane) : null;
  if (isLocked() || document.visibilityState === "hidden" || !port || port.blocked || sending || !actual || !sameTerminal(actual, reference) || port.pane?.paneId !== paneId) return false;
  sending = true;
  try {
    if (current !== read) return false;
    return await port.submit(text);
  } finally { sending = false; }
}
