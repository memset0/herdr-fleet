import { fleetCjkFallback, fleetWebfont, exclusiveCjkStack, CJK_FALLBACK_UNSET_FAMILY } from "../../../fleet/ui/webfonts.ts";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { TextCursorInput } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import type { PaneContentProps } from "@/components/agent-chat";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { ToggleButton } from "@/components/ui/toggle-button";
import { FleetTerminalComposer } from "@/components/fleet-terminal-composer";
import { Notice, NOTICE_ACTION } from "@/components/ui/notice";
import { fontStack, useDisplayPrefs, type FontFamily } from "@/hooks/use-display-prefs";
import { ft, useFleetLocale, type FleetMessageKey } from "@/lib/fleet-i18n";
import { markDead, markLive } from "@/lib/liveness";
import { paneScopeKey } from "@/lib/scope";
import { copyToClipboard, readOsc52, type CopyOutcome } from "../../../fleet/ui/terminal/clipboard.ts";
import { sendToTerminal, terminalComposerPreference } from "../../../fleet/ui/terminal/composer.ts";
import { terminalSpacingPreference, type TerminalSpacing } from "../../../fleet/ui/terminal/spacing.ts";
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

/**
 * The face, size and spacing the surface is currently drawn at, so a change to any of them can be
 * noticed — on a retained terminal too, which is updated in place rather than rebuilt.
 */
interface TerminalFace {
  readonly family: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

function sameFace(left: TerminalFace, right: TerminalFace): boolean {
  return left.family === right.family && left.size === right.size && left.lineHeight === right.lineHeight && left.letterSpacing === right.letterSpacing;
}

interface RetainedTerminal {
  readonly terminal: Terminal;
  readonly fit: FitAddon;
  readonly element: HTMLDivElement;
  face: TerminalFace;
  readonly link: TerminalLink;
  /** Set when the connection ends, so a return knows to establish a new one. */
  ended: boolean;
  /** True from the socket's open until its close: the Pane is answering through its real terminal. */
  connected: boolean;
  hasOutput: boolean;
  /**
   * What the mounted surface wants to hear when the socket opens. Held on the entry rather than
   * closed over, because the entry outlives the mount and a stale closure would be writing into a
   * component that is no longer on screen.
   */
  opened: (() => void) | null;
  /** The same, for the first output: the Gateway sends output only once the browser is attached. */
  answered: (() => void) | null;
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

/**
 * The sentence for a closed connection. The Gateway's word is a closed vocabulary that carries no
 * reason, so anything unrecognised — or no word at all, a socket that simply dropped — reads "ended".
 */
function closedKey(notice: string | null): FleetMessageKey {
  if (notice === "busy") return "fleet.terminal.closed.busy";
  if (notice === "unavailable") return "fleet.terminal.closed.unavailable";
  if (notice === "protocol") return "fleet.terminal.closed.protocol";
  if (notice === "taken") return "fleet.terminal.closed.taken";
  return "fleet.terminal.closed.ended";
}

function closedMessage(notice: string | null): string {
  return ft(closedKey(notice));
}

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

function faceFor(family: FontFamily, size: number, cjk: string, only: boolean, spacing: TerminalSpacing): TerminalFace {
  const font = fleetWebfont(cjk);
  const primary = only && font ? exclusiveCjkStack(font, "terminal") : fontStack(family);
  return { family: terminalFontFamily(primary, property => property === "--font-cjk" ? `"${font?.family ?? CJK_FALLBACK_UNSET_FAMILY}"` : readRootProperty(property)), size, ...spacing };
}

export function FleetTerminal({ paneId, scope, readOnly, zen, find, onOutputChange }: PaneContentProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const retained = useRef<RetainedTerminal | null>(null);
  const [geometry, setGeometry] = useState<Viewport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** True once this mount's connection closed: the surface then offers to reconnect in place. */
  const [closed, setClosed] = useState(false);
  /** Bumped by Reconnect, so the effect below releases the ended entry and builds a fresh one. */
  const [attempt, setAttempt] = useState(0);
  /** One-shot: the next connection carries the operator's explicit take-over intent. */
  const takeOverNext = useRef(false);
  /** Attached and answering: the input box may write. */
  const [ready, setReady] = useState(false);
  const composerShown = useSyncExternalStore(terminalComposerPreference.subscribe, terminalComposerPreference.snapshot, terminalComposerPreference.snapshot);
  useFleetLocale();
  const [copied, setCopied] = useState<string | null>(null);
  const [mouseReporting, setMouseReporting] = useState(false);
  const { prefs } = useDisplayPrefs();
  const key = paneScopeKey(scope, paneId);
  const cjk = useSyncExternalStore(fleetCjkFallback.subscribe, fleetCjkFallback.snapshot, fleetCjkFallback.snapshot);
  const only = useSyncExternalStore(fleetCjkFallback.subscribe, fleetCjkFallback.only, fleetCjkFallback.only);
  const spacing = useSyncExternalStore(terminalSpacingPreference.subscribe, terminalSpacingPreference.snapshot, terminalSpacingPreference.snapshot);
  const face = faceFor(prefs.fontFamily, prefs.fontSize, cjk, only, spacing);
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
        lineHeight: face.lineHeight,
        letterSpacing: face.letterSpacing,
        scrollback: 0,
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      container.append(element);
      terminal.open(element);
      // Declared before the link so its own close handler can mark it ended: the entry outlives this
      // component, and a returning mount has to know whether what it takes back is still connected.
      let self: RetainedTerminal | null = null;
      const takeover = takeOverNext.current;
      takeOverNext.current = false;
      const link = new TerminalLink(new WebSocket(terminalUrl(window.location.origin, paneId, scope, takeover)), {
        onOpen: () => {
          if (self !== null) self.connected = true;
          markLive(paneId, Date.now(), scope);
          self?.opened?.();
        },
        onOutput: (data) => {
          if (self !== null && !self.hasOutput) {
            self.hasOutput = true;
            self.answered?.();
          }
          terminal.write(data);
        },
        onNotice: (word) => setNotice(word),
        onClose: () => {
          if (self !== null) {
            self.ended = true;
            self.connected = false;
          }
          markDead(paneId, scope);
          setNotice((shown) => shown ?? "ended");
          setClosed(true);
          setReady(false);
        },
      });
      entry = { terminal, fit, element, link, ended: false, connected: false, hasOutput: false, opened: null, answered: null, face };
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
    // A retained entry that is still connected is not closed, whatever this mount last showed.
    if (!current.ended) setClosed(false);
    setReady(current.connected && current.hasOutput);
    current.answered = () => setReady(true);
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

    // COLLIE 1.18'S LIVENESS (lib/liveness.ts): a Pane is live while its last read succeeded, and
    // the mirror's read is what marks it. This surface reads no mirror, so without a word from here
    // the Pane would never be live and Collie would withhold its rename, close and focus rows as if
    // the screen were a saved copy. An open terminal stream IS this Pane answering, so it marks the
    // Pane live on open and well inside Collie's own cap while it stays open, and dead on close.
    const keepLive = (): void => {
      if (current.connected) markLive(paneId, Date.now(), scope);
    };
    keepLive();
    const liveTimer = setInterval(keepLive, 30_000);

    report();
    // The first viewport is held until the socket opens, so the number is only real from then on.
    current.opened = () => setGeometry(current.link.geometry());
    const observer = new ResizeObserver(() => report());
    observer.observe(container);
    current.terminal.focus();

    // The face may have changed under a retained terminal — the operator opened Settings between
    // two visits to this Pane, or moved a spacing step just now — and the emulator measures at
    // construction, so it has to be told. Options are set in place and the cell re-measured, so the
    // new cols×rows go out through the ordinary viewport report and the screen is kept.
    if (!sameFace(current.face, face)) {
      current.face = face;
      current.terminal.options.fontFamily = face.family;
      current.terminal.options.fontSize = face.size;
      current.terminal.options.lineHeight = face.lineHeight;
      current.terminal.options.letterSpacing = face.letterSpacing;
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
      clearInterval(liveTimer);
      parsed.dispose();
      document.fonts?.removeEventListener("loadingdone", settle);
      observer.disconnect();
      current.opened = null;
      current.answered = null;
      current.element.remove();
      retained.current = null;
      pool.put(key, current);
    };
    // `readOnly` is deliberately not a dependency: a device's write permission does not change
    // under a mounted terminal, and rebuilding one on a snapshot field would throw away the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paneId, scope, face.family, face.size, face.lineHeight, face.letterSpacing, onOutputChange, attempt]);

  // A fresh connection through the ordinary path: admission, resolution and the single-writer
  // refusal all apply again, so a terminal another browser holds still answers "busy".
  // Fleet's own send, never Collie's pipeline: the draft as a paste in bounded frames, then Enter.
  const sendDraft = useCallback(async (text: string): Promise<boolean> => {
    const current = retained.current;
    if (current === null) return false;
    return sendToTerminal(text, {
      bracketed: current.terminal.modes.bracketedPasteMode,
      write: (data) => current.link.type(data),
    });
  }, []);

  const reconnect = useCallback(() => {
    setNotice(null);
    setClosed(false);
    setAttempt((value) => value + 1);
  }, []);
  // Only from the busy notice, only on the operator's press: the browser holding it is told.
  const takeOver = useCallback(() => {
    takeOverNext.current = true;
    reconnect();
  }, [reconnect]);

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
        {readOnly ? null : (
          <ToggleButton
            pressed={composerShown}
            onPressedChange={terminalComposerPreference.set}
            label={ft("fleet.terminal.composer.toggle")}
            title={ft("fleet.terminal.composer.toggle")}
            icon={<TextCursorInput className="size-3.5" />}
            // Drawn at 20px so the row stays a status line, with the 44px floor bought as hit area.
            className="ml-auto h-5 size-5 before:absolute before:-inset-3 before:content-['']"
          />
        )}
      </div>
      </Collapse>
      <Collapse open={closed}>
        <Notice
          tone="caution"
          variant="box"
          announce="status"
          className="mx-3 my-1"
          action={
            <span className="flex items-center gap-2">
              {notice === "busy" ? (
                <Button size="sm" variant="outline" className={NOTICE_ACTION} onClick={takeOver} data-testid="fleet-terminal-take-over">
                  {ft("fleet.terminal.takeOver")}
                </Button>
              ) : null}
              <Button size="sm" variant="outline" className={NOTICE_ACTION} onClick={reconnect} data-testid="fleet-terminal-reconnect">
                {ft("fleet.terminal.reconnect")}
              </Button>
            </span>
          }
        >
          {closedMessage(notice)}
        </Notice>
      </Collapse>
      <div
        ref={host}
        // Match an overflowing mirror's native scrollbar reservation before xterm measures.
        className="min-h-0 min-w-0 w-full flex-1 px-2 overflow-hidden [scrollbar-gutter:stable]"
        data-testid="fleet-terminal-host"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
      {/* In flow, not over the terminal: the host shrinks and its observer refits the terminal. */}
      <Collapse open={composerShown && !readOnly && !zen}>
        <FleetTerminalComposer ready={ready} onSend={sendDraft} />
      </Collapse>
    </div>
  );
}
