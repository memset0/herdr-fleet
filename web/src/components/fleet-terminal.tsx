import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { PaneContentProps } from "@/components/agent-chat";
import { Collapse } from "@/components/ui/collapse";
import { fontStack, useDisplayPrefs, type FontFamily } from "@/hooks/use-display-prefs";
import { paneScopeKey } from "@/lib/scope";
import { copyToClipboard, readOsc52, type CopyOutcome } from "../../../fleet/ui/terminal/clipboard.ts";
import { terminalFontFamily } from "../../../fleet/ui/terminal/font.ts";
import { TerminalLink, terminalUrl } from "../../../fleet/ui/terminal/link.ts";
import { InstancePool } from "../../../fleet/ui/terminal/pool.ts";
import { terminalMatches } from "../../../fleet/ui/terminal/search.ts";
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

/** The face and size the surface is currently drawn at, so a change to either can be noticed. */
interface TerminalFace {
  readonly family: string;
  readonly size: number;
}

interface RetainedTerminal {
  readonly terminal: Terminal;
  readonly fit: FitAddon;
  readonly element: HTMLDivElement;
  face: TerminalFace;
  readonly link: TerminalLink;
  /** Set when the connection ends, so a return knows to establish a new one. */
  ended: boolean;
  hasOutput: boolean;
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


const encoder = new TextEncoder();

function copyMessage(outcome: CopyOutcome): string | null {
  if (outcome === "copied") return "Copied";
  if (outcome === "refused") return "The browser refused the clipboard — the selection is still there";
  if (outcome === "unavailable") return "This browser has no clipboard — the selection is still there";
  return null;
}

/**
 * What this surface draws with: the operator's own two font settings, resolved.
 *
 * The same pair the mirror reads — their terminal face and the CJK fallback under it. A terminal is
 * a grid, so the second one is not a nicety here: a CJK face whose advance is not twice the Latin
 * one puts every column after the first Chinese character on a line in the wrong place.
 */
function readRootProperty(property: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(property);
}

function faceFor(family: FontFamily, size: number): TerminalFace {
  return { family: terminalFontFamily(fontStack(family), readRootProperty), size };
}

export function FleetTerminal({ paneId, scope, readOnly, zen, find, onOutputChange }: PaneContentProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const retained = useRef<RetainedTerminal | null>(null);
  const [geometry, setGeometry] = useState<Viewport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [mouseReporting, setMouseReporting] = useState(false);
  const { prefs } = useDisplayPrefs();
  const key = paneScopeKey(scope, paneId);
  const face = faceFor(prefs.fontFamily, prefs.fontSize);
  const { open: findOpen, query: findQuery, current: currentMatch, onMatchCount } = find;
  const [searchSource, setSearchSource] = useState<{ terminal: Terminal } | null>(null);
  const finding = useRef(findOpen);
  finding.current = findOpen;

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
        // Their own two font settings, resolved — see `faceFor`. A `var()` here would be measured
        // rather than resolved, and the cell would be sized from whatever the browser made of it.
        fontFamily: face.family,
        fontSize: face.size,
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
        onOutput: (data) => {
          if (self !== null) self.hasOutput = true;
          terminal.write(data);
        },
        onNotice: (word) => setNotice(word),
        onClose: () => {
          if (self !== null) self.ended = true;
          setNotice((shown) => shown ?? "ended");
        },
      });
      entry = { terminal, fit, element, link, ended: false, hasOutput: false, opened: null, face };
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
    setSearchSource({ terminal: current.terminal });
    onOutputChange(current.hasOutput);
    const parsed = current.terminal.onWriteParsed(() => {
      current.hasOutput = true;
      onOutputChange(true);
      if (finding.current) setSearchSource({ terminal: current.terminal });
    });

    const report = (): void => {
      // DOM removal precedes effect cleanup; a queued old observer has no viewport to report.
      if (!container.isConnected || retained.current !== current) return;
      if (current.element.clientWidth <= 0 || current.element.clientHeight <= 0) return;
      const proposed = current.fit.proposeDimensions();
      if (proposed === undefined) return;
      current.link.report({ columns: proposed.cols, rows: proposed.rows });
      current.fit.fit();
      setGeometry(current.link.geometry());
    };
    /**
     * Re-run the emulator's own DOM measurements, then report the cell count they imply.
     *
     * `open` is the documented way to ask for that — its own contract says it should be called
     * again whenever the measurements need redoing — and it is needed twice here. A web font that
     * arrives AFTER the first measurement is the reason the letters look spaced out: the cell was
     * sized from whatever answered before the face loaded, and the narrower glyphs are then painted
     * inside it. And a change to either font setting is the same problem on purpose.
     */
    const remeasure = (): void => {
      current.terminal.open(current.element);
      report();
    };

    report();
    // The first viewport is held until the socket opens, so the number is only real from then on.
    current.opened = () => setGeometry(current.link.geometry());
    const observer = new ResizeObserver(() => report());
    observer.observe(container);
    current.terminal.focus();

    // The face may have changed under a retained terminal — the operator opened Settings between
    // two visits to this Pane — and the emulator measures at construction, so it has to be told.
    if (current.face.family !== face.family || current.face.size !== face.size) {
      current.face = face;
      current.terminal.options.fontFamily = face.family;
      current.terminal.options.fontSize = face.size;
      remeasure();
    }

    // Fonts load asynchronously and the CJK face loads one `unicode-range` chunk at a time, so
    // "ready" can resolve more than once over a terminal's life. Every one of them is a reason to
    // measure again; a cancelled flag keeps a late one out of an unmounted surface.
    let live = true;
    const settle = (): void => {
      if (live) remeasure();
    };
    void document.fonts?.ready.then(settle).catch(() => undefined);
    document.fonts?.addEventListener("loadingdone", settle);

    return () => {
      live = false;
      parsed.dispose();
      document.fonts?.removeEventListener("loadingdone", settle);
      observer.disconnect();
      current.opened = null;
      current.element.remove();
      retained.current = null;
      pool.put(key, current);
    };
    // `readOnly` is deliberately not a dependency: a device's write permission does not change
    // under a mounted terminal, and rebuilding one on a snapshot field would throw away the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paneId, scope, face.family, face.size, onOutputChange]);

  const matches = useMemo(() => {
    const terminal = searchSource?.terminal;
    return !findOpen || terminal === undefined
      ? []
      : terminalMatches(terminal.buffer.active, terminal.cols, findQuery);
  }, [findOpen, findQuery, searchSource]);
  useEffect(() => {
    if (findOpen) onMatchCount(matches.length);
  }, [findOpen, onMatchCount, matches]);
  const wasFinding = useRef(false);
  useEffect(() => {
    const terminal = retained.current?.terminal;
    if (terminal === undefined) return;
    if (findOpen) {
      const match = matches[Math.min(currentMatch, matches.length - 1)];
      if (match === undefined) terminal.clearSelection();
      else {
        terminal.select(match.column, match.row, match.length);
        terminal.scrollToLine(match.row);
      }
    } else if (wasFinding.current) {
      terminal.clearSelection();
      terminal.focus();
    }
    wasFinding.current = findOpen;
  }, [findOpen, currentMatch, matches]);

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
      <Collapse open={!zen}>
      <div className="flex items-center gap-3 px-3 py-1 text-xs text-muted-foreground" data-testid="fleet-terminal-status">
        <span data-testid="fleet-terminal-geometry">
          {geometry === null ? "connecting" : `${geometry.columns}×${geometry.rows}`}
        </span>
        {readOnly ? <span data-testid="fleet-terminal-readonly">read-only device</span> : null}
        {mouseReporting ? <span data-testid="fleet-terminal-shift-hint">Hold Shift to select</span> : null}
        {copied === null ? null : <span data-testid="fleet-terminal-copy">{copied}</span>}
        {notice === null ? null : <span data-testid="fleet-terminal-notice">{notice}</span>}
      </div>
      </Collapse>
      <div
        ref={host}
        // Match an overflowing mirror's native scrollbar reservation before xterm measures.
        className="min-h-0 min-w-0 w-full flex-1 px-2 overflow-hidden [scrollbar-gutter:stable]"
        data-testid="fleet-terminal-host"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
