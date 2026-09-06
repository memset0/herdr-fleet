import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { RouteHeader } from "@/components/app-header";
import { paneScopeKey, type Scope } from "@/lib/scope";
import { isReadOnly, type DeviceAuth } from "@/lib/types";
import { copyToClipboard, readOsc52, type CopyOutcome } from "../../../fleet/ui/terminal/clipboard.ts";
import { TerminalLink, terminalUrl } from "../../../fleet/ui/terminal/link.ts";
import { InstancePool } from "../../../fleet/ui/terminal/pool.ts";
import type { Viewport } from "../../../fleet/terminal/browser.ts";

/**
 * A Pane drawn as the terminal it mirrors.
 *
 * The surface this route renders instead of the mirror while the global switch is on. Everything
 * around it — the rails, the header, the Pane's own address — is unchanged, because this replaces
 * what the route draws and not where the route is.
 *
 * Three things here are decisions rather than plumbing.
 *
 * **The terminal outlives the route.** A Pane switch unmounts this component, and disposing the
 * terminal with it would throw away the screen: walking back would show a blank rectangle until
 * something repainted. The instance, its element and its connection are handed to a bounded pool and
 * taken back on return.
 *
 * **The geometry is legible.** This surface seizes a shared resource — the Pane's terminal has one
 * size and it is now this browser's — so the number is on screen. Someone whose terminal has just
 * changed size can see where it went.
 *
 * **A drag that does nothing explains itself.** An attached terminal usually has mouse reporting on,
 * so a plain drag is the program's input and selects nothing. Holding Shift suppresses reporting for
 * the gesture; the hint appears the moment the operator's own drag lands on a program that is
 * consuming it, rather than living in documentation they would have to already suspect.
 */

/** How many terminals this browser keeps alive across Pane switches. */
export const RETAINED_TERMINALS = 3;

interface RetainedTerminal {
  readonly terminal: Terminal;
  readonly fit: FitAddon;
  readonly element: HTMLDivElement;
  readonly link: TerminalLink;
  /** Set when the connection ends, so a return knows to establish a new one. */
  ended: boolean;
  /**
   * What the mounted surface wants to hear when the socket opens. Held on the entry rather than
   * closed over, because the entry outlives the mount and a stale closure would be writing into a
   * component that is no longer on screen.
   */
  opened: (() => void) | null;
}

const pool = new InstancePool<RetainedTerminal>({
  max: RETAINED_TERMINALS,
  dispose: (retained) => {
    retained.link.close();
    retained.terminal.dispose();
    retained.element.remove();
  },
});

export interface FleetTerminalProps {
  readonly paneId: string;
  readonly scope: Scope;
  /** The Pane's own name, for the header row. Never the terminal's contents. */
  readonly label?: string | undefined;
  readonly device: DeviceAuth | undefined;
  readonly onBack: () => void;
}

const encoder = new TextEncoder();

function copyMessage(outcome: CopyOutcome): string | null {
  if (outcome === "copied") return "Copied";
  if (outcome === "refused") return "The browser refused the clipboard — the selection is still there";
  if (outcome === "unavailable") return "This browser has no clipboard — the selection is still there";
  return null;
}

export function FleetTerminal({ paneId, scope, label, device, onBack }: FleetTerminalProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const retained = useRef<RetainedTerminal | null>(null);
  const [geometry, setGeometry] = useState<Viewport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [mouseReporting, setMouseReporting] = useState(false);
  const readOnly = isReadOnly(device);
  const key = paneScopeKey(scope, paneId);

  useEffect(() => {
    const container = host.current;
    if (container === null) return;

    let entry = pool.release(key);
    if (entry === undefined || entry.ended) {
      if (entry !== undefined) {
        entry.link.close();
        entry.terminal.dispose();
        entry.element.remove();
      }
      const element = document.createElement("div");
      element.className = "h-full w-full";
      const terminal = new Terminal({
        allowProposedApi: true,
        // The operator's device decides whether anything may be typed; a read-only device gets a
        // terminal it can read and select in, and no keystroke path at all.
        disableStdin: readOnly,
        convertEol: false,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 13,
        scrollback: 0,
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      container.append(element);
      terminal.open(element);
      // Declared before the link so its own close handler can mark it ended: the entry outlives this
      // component, and a returning mount has to know whether what it takes back is still connected.
      let self: RetainedTerminal | null = null;
      const link = new TerminalLink(new WebSocket(terminalUrl(window.location.origin, paneId, scope)), {
        onOpen: () => self?.opened?.(),
        onOutput: (data) => terminal.write(data),
        onNotice: (word) => setNotice(word),
        onClose: () => {
          if (self !== null) self.ended = true;
          setNotice((shown) => shown ?? "ended");
        },
      });
      entry = { terminal, fit, element, link, ended: false, opened: null };
      self = entry;
      if (!readOnly) terminal.onData((data) => link.type(encoder.encode(data)));
      terminal.parser.registerOscHandler(52, (data) => {
        const request = readOsc52(data);
        // A read is refused by answering nothing at all: writing back even an empty payload would
        // be an answer, and the thing being asked for is whatever the operator last copied.
        if (request.kind !== "write") return true;
        void copyToClipboard(request.text, navigator.clipboard).then((outcome) =>
          setCopied(copyMessage(outcome)),
        );
        return true;
      });
    } else {
      container.append(entry.element);
    }
    const current = entry;
    retained.current = current;

    const report = (): void => {
      const proposed = current.fit.proposeDimensions();
      if (proposed === undefined) return;
      current.link.report({ columns: proposed.cols, rows: proposed.rows });
      current.fit.fit();
      setGeometry(current.link.geometry());
    };
    report();
    // The first viewport is held until the socket opens, so the number is only real from then on.
    current.opened = () => setGeometry(current.link.geometry());
    const observer = new ResizeObserver(() => report());
    observer.observe(container);
    current.terminal.focus();

    return () => {
      observer.disconnect();
      current.opened = null;
      current.element.remove();
      retained.current = null;
      pool.put(key, current);
    };
    // `readOnly` is deliberately not a dependency: a device's write permission does not change
    // under a mounted terminal, and rebuilding one on a snapshot field would throw away the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paneId, scope]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = retained.current;
    if (current === null) return;
    // The hint is earned rather than assumed: it appears when this operator's own drag is about to
    // land on a program that is consuming mouse events, and Shift is what would select instead.
    setMouseReporting(current.terminal.modes.mouseTrackingMode !== "none" && !event.shiftKey);
  }, []);

  const onPointerUp = useCallback(() => {
    const current = retained.current;
    if (current === null) return;
    const selection = current.terminal.getSelection();
    if (selection === "") return;
    void copyToClipboard(selection, navigator.clipboard).then((outcome) => setCopied(copyMessage(outcome)));
  }, []);

  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-[100dvw] flex-1 flex-col overflow-x-hidden">
      <RouteHeader onHome={onBack} mark={false}>
        <span className="truncate font-mono text-sm">{label ?? paneId}</span>
      </RouteHeader>
      <div className="flex items-center gap-3 px-3 py-1 text-xs text-muted-foreground" data-testid="fleet-terminal-status">
        <span data-testid="fleet-terminal-geometry">
          {geometry === null ? "connecting" : `${geometry.columns}×${geometry.rows}`}
        </span>
        {readOnly ? <span data-testid="fleet-terminal-readonly">read-only device</span> : null}
        {mouseReporting ? <span data-testid="fleet-terminal-shift-hint">Hold Shift to select</span> : null}
        {copied === null ? null : <span data-testid="fleet-terminal-copy">{copied}</span>}
        {notice === null ? null : <span data-testid="fleet-terminal-notice">{notice}</span>}
      </div>
      <div
        ref={host}
        className="min-h-0 w-full flex-1"
        data-testid="fleet-terminal-host"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
