import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Scaling } from "lucide-react";

import * as api from "@/lib/api";
import { setStatus } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  registerFleetShortcutHandler,
  type FleetShortcutChildAction,
} from "./shortcuts";
import { measureTerminalColumns } from "./terminal-resize";

export const FLEET_FIXED_KEY_ACTIONS = {
  "send-escape": ["Escape"],
  "send-enter": ["Enter"],
  "send-up-arrow": ["Up"],
  "send-down-arrow": ["Down"],
  "send-left-arrow": ["Left"],
  "send-right-arrow": ["Right"],
  "send-space": ["Space"],
  "send-ctrl-c": ["ctrl+c"],
} as const satisfies Partial<Record<FleetShortcutChildAction, readonly string[]>>;

interface DirectTypingPort {
  active: boolean;
  activate(): void;
  deactivate(): void;
}

export interface ComposerFleetHandlerOptions {
  direct: DirectTypingPort;
  locked(): boolean;
  hasDraft(): boolean;
  pressKeys(keys: string[]): Promise<boolean>;
}

export function createComposerFleetShortcutHandlers({
  direct,
  locked,
  hasDraft,
  pressKeys,
}: ComposerFleetHandlerOptions): Map<FleetShortcutChildAction, () => void | Promise<void>> {
  const handlers = new Map<FleetShortcutChildAction, () => void | Promise<void>>();
  handlers.set("toggle-type-mode", () => {
    if (direct.active) {
      direct.deactivate();
      return;
    }
    if (locked() || hasDraft()) {
      throw new Error(
        locked()
          ? "Type mode is unavailable"
          : "Send or clear the draft before typing into the terminal",
      );
    }
    direct.activate();
  });
  for (const [action, keys] of Object.entries(FLEET_FIXED_KEY_ACTIONS)) {
    handlers.set(action as FleetShortcutChildAction, async () => {
      if (!(await pressKeys([...keys]))) throw new Error("Key send failed");
    });
  }
  return handlers;
}

/** Register Composer-owned actions once while dispatching through its latest live state. */
export function useFleetComposerShortcuts(options: ComposerFleetHandlerOptions): void {
  const current = useRef(options);
  current.current = options;

  useEffect(() => {
    const handlers = createComposerFleetShortcutHandlers({
      direct: {
        get active() {
          return current.current.direct.active;
        },
        activate: () => current.current.direct.activate(),
        deactivate: () => current.current.direct.deactivate(),
      },
      locked: () => current.current.locked(),
      hasDraft: () => current.current.hasDraft(),
      pressKeys: (keys) => current.current.pressKeys(keys),
    });
    const unregister = [...handlers].map(([action, handler]) =>
      registerFleetShortcutHandler(action, handler),
    );
    return () => {
      for (const remove of unregister) remove();
    };
  }, []);
}

interface FleetPaneResizeOptions {
  paneId: string;
  session?: string;
  fontSize: number;
  readOnly: boolean;
  scrollport: {
    current: { getScrollElement(): HTMLElement | null } | null;
  };
  revalidate(): void;
}

/** Keep Fleet's resize measurement, request, feedback, and shortcut in one owned hook. */
export function useFleetPaneResize({
  paneId,
  session,
  fontSize,
  readOnly,
  scrollport,
  revalidate,
}: FleetPaneResizeOptions): () => Promise<void> {
  const resize = useCallback(async () => {
    if (readOnly) {
      setStatus("Read-only — device not authorised", "error");
      return;
    }
    const element = scrollport.current?.getScrollElement();
    if (!element) {
      setStatus("Terminal width is not ready to measure", "error");
      return;
    }
    try {
      const cols = measureTerminalColumns(element, fontSize);
      const result = await api.resizePane(paneId, cols, session);
      if (!result.ok) {
        setStatus(result.error, "error");
        return;
      }
      setStatus(`Resized to ${result.cols} columns`, "success");
      revalidate();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }, [fontSize, paneId, readOnly, revalidate, scrollport, session]);

  useEffect(
    () => registerFleetShortcutHandler("fit-pane-width", resize),
    [resize],
  );
  return resize;
}

/** Downstream-owned Display row; Collie exposes only a ReactNode slot for it. */
export function FleetResizeRow({
  disabled,
  onResize,
}: {
  disabled: boolean;
  onResize(): Promise<void>;
}) {
  const [resizing, setResizing] = useState(false);

  async function resize() {
    if (disabled || resizing) return;
    setResizing(true);
    try {
      await onResize();
    } finally {
      setResizing(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          Resize
          <Badge
            variant="outline"
            className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
          >
            Custom
          </Badge>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Fits the real Pane width once. Later layout changes do not resize it.
        </p>
      </div>
      <Button
        className="shrink-0"
        variant="outline"
        size="sm"
        disabled={disabled || resizing}
        onClick={() => void resize()}
        aria-label="Resize pane to this view"
      >
        {resizing ? <Loader2 className="animate-spin" /> : <Scaling />}
        Resize
      </Button>
    </div>
  );
}
