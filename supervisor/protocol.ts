import net from "node:net";

export type ControlOperation = "ensure" | "status" | "restart" | "stop";

export interface ControlRequest {
  operation: ControlOperation;
  generation: string;
}

export interface ChildStatus {
  name: string;
  pid: number | null;
  running: boolean;
  restarts: number;
  nextRestartAt: number | null;
}

export interface ControlResponse {
  status: "running" | "replacing" | "restarting" | "stopping" | "invalid";
  generation: string;
  pid: number;
  startedAt: number;
  children: ChildStatus[];
  message?: string;
}

export function isUnavailableControlError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTSOCK" || code === "ECONNREFUSED" || code === "ECONNRESET";
}

export function sendControl(
  socketPath: string,
  request: ControlRequest,
  timeoutMs = 2_000,
): Promise<ControlResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.setEncoding("utf8");
    let settled = false;
    let buffer = "";
    const finish = (error?: Error, value?: ControlResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(
      () => finish(new Error(`supervisor control timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    socket.once("error", (error) => finish(error));
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 64 * 1024) {
        finish(new Error("supervisor returned an oversized response"));
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      try {
        const parsed = JSON.parse(buffer.slice(0, newline)) as ControlResponse;
        if (!parsed || typeof parsed.status !== "string" || typeof parsed.generation !== "string") {
          throw new Error("invalid response shape");
        }
        finish(undefined, parsed);
      } catch (error) {
        finish(new Error(`invalid supervisor response: ${(error as Error).message}`));
      }
    });
    socket.once("connect", () => socket.write(`${JSON.stringify(request)}\n`));
  });
}
