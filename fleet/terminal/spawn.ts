/**
 * Starting one terminal server, and connecting the Gateway to it.
 *
 * This is the layer the unit tests deliberately stop at: it spawns a process and opens a socket, and
 * everything above it takes both as injected functions so the session set, the grace period and the
 * single-writer refusal can be driven exactly. What is testable here — which executables are needed,
 * what arguments they are given, and where the socket lives — is pure and is tested; what is not is
 * kept to as few lines as it can be.
 *
 * Three properties of the invocation are load-bearing, and each is one flag:
 *
 * The server binds a UNIX socket and never a port, so "a browser must not be able to reach a terminal
 * server directly" is true by construction rather than by a rule someone has to keep.
 *
 * It accepts exactly one client and exits when that client leaves. The Gateway is that client, so the
 * process's lifetime is the session's, and a Gateway that dies takes its terminal servers with it
 * instead of leaving them holding attachments to the operator's Panes.
 *
 * It runs the multiplexer's own attach command, which is what makes this a view of the Pane's real
 * terminal rather than a second shell beside it — and what makes the geometry it is given the Pane's
 * geometry, returned when the attachment ends.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Placement } from "./placement.ts";
import { authFrame, decodeServerFrame } from "./protocol.ts";
import type { ConnectUpstream, StartServer, TerminalServer, Upstream } from "./session.ts";

/** The terminal server, and the multiplexer command it runs. Both resolved once, at startup. */
export interface TerminalTools {
  readonly server: string;
  readonly attach: string;
}

export const TERMINAL_SERVER_NAME = "ttyd";
export const ATTACH_COMMAND_NAME = "herdr";

/** The websocket path and subprotocol the terminal server serves. Its own, not ours. */
export const SERVER_WS_PATH = "/ws";
export const SERVER_WS_PROTOCOL = "tty";

/**
 * Both executables, or nothing.
 *
 * Nothing is a complete answer: a deployment without them offers no terminals, which the route
 * already knows how to say. Half an answer would be a Gateway that admits an upgrade and then fails
 * at the spawn, after the browser has been told it has a terminal.
 */
export function findTerminalTools(which: (name: string) => string | null): TerminalTools | null {
  const server = which(TERMINAL_SERVER_NAME);
  const attach = which(ATTACH_COMMAND_NAME);
  if (server === null || attach === null) return null;
  return { server, attach };
}

/**
 * What the terminal server is run with, for exactly one terminal.
 *
 * `-i` a socket path rather than `-p` a port; `-o` and `-m 1` for the one client; `-W` because a
 * terminal nobody can type into is the mirror this surface exists beside. The terminal type is
 * stated rather than inherited, because the environment this process runs in is the plugin runtime's
 * and not a terminal at all.
 */
export function terminalServerArguments(
  tools: TerminalTools,
  socketPath: string,
  terminalId: string,
): readonly string[] {
  return [
    tools.server,
    "-i",
    socketPath,
    "-W",
    "-o",
    "-m",
    "1",
    "-T",
    "xterm-256color",
    tools.attach,
    "terminal",
    "attach",
    terminalId,
  ];
}

/** A spawned child, as little of one as this file needs. Bun's own shape, narrowed. */
export interface SpawnedChild {
  kill(signal?: number | NodeJS.Signals): void;
  readonly exited: Promise<number>;
}

export interface SpawnDeps {
  readonly tools: TerminalTools;
  /** Owner-only directory the sockets live in, created once and removed with the Gateway. */
  readonly socketDir: string;
  readonly spawn?: (command: readonly string[]) => SpawnedChild;
  /** Resolves when the socket exists, or rejects when it never appears. */
  readonly awaitSocket?: (socketPath: string) => Promise<void>;
  readonly log?: ((event: string, detail: Record<string, string | number>) => void) | undefined;
}

/** Where this Gateway's terminal sockets live. Owner-only, and removed when the Gateway stops. */
export async function makeSocketDirectory(): Promise<{ path: string; remove: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), "herdr-fleet-terminal-"));
  return { path, remove: () => rm(path, { recursive: true, force: true }) };
}

/**
 * A socket name that cannot be steered.
 *
 * The terminal id is resolved from a Pane by the side that owns it and never accepted from a
 * connection, but it still reaches a filesystem path here, so it is replaced rather than sanitised:
 * the name is a counter, and the id stays in the diagnostics where it belongs.
 */
function socketNameFor(sequence: number): string {
  return `t${sequence}.sock`;
}

const SOCKET_POLL_MS = 10;
const SOCKET_TIMEOUT_MS = 5_000;

async function defaultAwaitSocket(socketPath: string): Promise<void> {
  const deadline = Date.now() + SOCKET_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await Bun.file(socketPath).exists()) return;
    await Bun.sleep(SOCKET_POLL_MS);
  }
  throw new Error("the terminal server did not open its socket");
}

export function makeStartServer(deps: SpawnDeps): StartServer {
  let sequence = 0;
  const spawn =
    deps.spawn ??
    ((command: readonly string[]) =>
      Bun.spawn({
        cmd: [...command],
        // Nothing of the terminal reaches this process: output belongs to the socket, and the
        // server's own logging would otherwise land in the Gateway's diagnostics.
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      }));
  const awaitSocket = deps.awaitSocket ?? defaultAwaitSocket;

  return async (placement: Placement): Promise<TerminalServer> => {
    // A member's Pane is that member's to resolve and to serve. Reaching a spawn here would mean the
    // lead had produced a terminal id for a machine it does not own.
    if (placement.kind !== "local") throw new Error("this starter serves local terminals only");
    const terminalId = placement.terminalId;
    sequence += 1;
    const socketPath = join(deps.socketDir, socketNameFor(sequence));
    const child = spawn(terminalServerArguments(deps.tools, socketPath, terminalId));
    let stopped = false;
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      try {
        child.kill();
      } catch {
        // Already gone, which is the state `stop` is asking for.
      }
      void rm(socketPath, { force: true }).catch(() => {
        // A leftover socket in an owner-only directory that goes with the Gateway.
      });
    };
    try {
      await awaitSocket(socketPath);
    } catch (error) {
      stop();
      throw error;
    }
    // The Pane, not the terminal it resolved to: see the diagnostics boundary.
    deps.log?.("terminal.server-started", { pane: placement.paneId });
    return { endpoint: serverUrl(socketPath), stop };
  };
}

/** The WebSocket the Gateway opens to a terminal server, over its UNIX socket. */
export function serverUrl(socketPath: string): string {
  return `ws+unix://${socketPath}:${SERVER_WS_PATH}`;
}

/**
 * The Gateway's own client.
 *
 * The first frame is the terminal server's handshake: an empty credential — nothing authenticates on
 * a socket only this process can open — and the geometry, so the attachment starts at the size the
 * browser is drawing rather than at a default it would have to be corrected away from.
 */
/**
 * A frame as its own buffer.
 *
 * The socket wants a buffer it owns the whole of, and every frame here is a fresh small array
 * already; copying is cheaper than widening the framing functions' return types through the protocol
 * modules and their tests to say what this one call site needs.
 */
function wire(frame: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(frame.byteLength);
  new Uint8Array(copy).set(frame);
  return copy;
}

export function makeConnectUpstream(
  open: (url: string, protocol: string) => WebSocket = (url, protocol) => new WebSocket(url, protocol),
): ConnectUpstream {
  return async (server, geometry, handlers): Promise<Upstream> => {
    // One code path for both placements: a member's service speaks the terminal server's own wire,
    // so the only thing that differs between a local terminal and one across a link is the URL.
    const socket = open(server.endpoint, SERVER_WS_PROTOCOL);
    socket.binaryType = "arraybuffer";
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("the terminal server refused the connection")),
        { once: true },
      );
    });
    socket.send(wire(authFrame("", geometry)));
    socket.addEventListener("message", (event) => {
      const { data } = event;
      // Text frames are not part of this wire. Ignoring one is right: the server sends binary, and a
      // string here would be something new rather than something to guess at.
      if (!(data instanceof ArrayBuffer)) return;
      const frame = decodeServerFrame(new Uint8Array(data));
      if (frame.kind === "output") handlers.onOutput(frame.data);
    });
    socket.addEventListener("close", () => handlers.onClosed(), { once: true });
    socket.addEventListener("error", () => handlers.onClosed(), { once: true });
    return {
      send: (frame) => {
        try {
          socket.send(wire(frame));
        } catch {
          // A closed socket reports itself through `close`; a throw here would surface as a failed
          // keystroke instead of a closed terminal.
        }
      },
      close: () => socket.close(),
    };
  };
}
