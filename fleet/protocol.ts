import net from "node:net";

import { jsonNumberField, jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonValue } from "../bridge/json.ts";

export type ControlOperation = "ensure" | "status" | "restart" | "stop";

export interface ControlRequest {
  readonly operation: ControlOperation;
  readonly generation: string;
}

export interface ChildStatus {
  readonly name: string;
  readonly pid: number | null;
  readonly running: boolean;
  readonly restarts: number;
  readonly nextRestartAt: number | null;
  /**
   * True for a child that ended by design rather than by failing.
   *
   * One child does that: a member's terminal service stands itself down when nobody has asked it for
   * anything, which is the capability working rather than breaking. Reported separately so a status
   * reader is not left deciding whether a device with no terminals is a device with a problem.
   */
  readonly idle?: boolean;
}

export interface ControlResponse {
  readonly status: "starting" | "running" | "replacing" | "restarting" | "stopping" | "invalid";
  readonly generation: string;
  readonly pid: number;
  readonly startedAt: number;
  readonly children: readonly ChildStatus[];
  readonly role?: "lead" | "peer";
  readonly message?: string;
}

export function parseControlRequest(source: string): ControlRequest | null {
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns a recursively JSON-shaped value; both fields are narrowed below.
    parsed = JSON.parse(source) as JsonValue;
  } catch {
    return null;
  }
  const value = jsonRecord(parsed);
  if (value === null || Object.keys(value).some((key) => key !== "operation" && key !== "generation")) return null;
  const operation = jsonStringField(value.operation);
  const generation = jsonStringField(value.generation);
  if (
    generation === null ||
    generation === "" ||
    (operation !== "ensure" && operation !== "status" && operation !== "restart" && operation !== "stop")
  ) {
    return null;
  }
  return { operation, generation };
}

function parseChild(value: JsonValue | undefined): ChildStatus | null {
  const child = jsonRecord(value);
  if (child === null) return null;
  const name = jsonStringField(child.name);
  const pid = child.pid === null ? null : jsonNumberField(child.pid);
  const restarts = jsonNumberField(child.restarts);
  const nextRestartAt = child.nextRestartAt === null ? null : jsonNumberField(child.nextRestartAt);
  if (
    name === null ||
    pid === null && child.pid !== null ||
    child.running !== true && child.running !== false ||
    restarts === null ||
    nextRestartAt === null && child.nextRestartAt !== null
  ) {
    return null;
  }
  return { name, pid, running: child.running, restarts, nextRestartAt };
}

export function parseControlResponse(source: string): ControlResponse | null {
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns a recursively JSON-shaped value; the response fields are narrowed
    // below before the control client acts on them.
    parsed = JSON.parse(source) as JsonValue;
  } catch {
    return null;
  }
  const value = jsonRecord(parsed);
  if (value === null || !Array.isArray(value.children)) return null;
  const status = jsonStringField(value.status);
  const generation = jsonStringField(value.generation);
  const pid = jsonNumberField(value.pid);
  const startedAt = jsonNumberField(value.startedAt);
  const message = value.message === undefined ? undefined : jsonStringField(value.message);
  const role = value.role === undefined ? undefined : jsonStringField(value.role);
  const children = value.children.map(parseChild);
  if (
    status === null ||
    !["starting", "running", "replacing", "restarting", "stopping", "invalid"].includes(status) ||
    generation === null ||
    pid === null ||
    startedAt === null ||
    message === null ||
    role === null ||
    role !== undefined && role !== "lead" && role !== "peer" ||
    children.some((child) => child === null)
  ) {
    return null;
  }
  const normalizedStatus: ControlResponse["status"] =
    status === "starting" ||
    status === "running" ||
    status === "replacing" ||
    status === "restarting" ||
    status === "stopping"
      ? status
      : "invalid";
  const normalizedChildren: ChildStatus[] = [];
  for (const child of children) if (child !== null) normalizedChildren.push(child);
  return {
    status: normalizedStatus,
    generation,
    pid,
    startedAt,
    children: normalizedChildren,
    role,
    message,
  };
}

export function isUnavailableControlError(error: Error): boolean {
  if (!("code" in error)) return false;
  return error.code === "ENOENT" || error.code === "ENOTSOCK" || error.code === "ECONNREFUSED" || error.code === "ECONNRESET";
}

export function sendControl(socketPath: string, request: ControlRequest, timeoutMs = 2_000): Promise<ControlResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.setEncoding("utf8");
    let settled = false;
    let buffer = "";
    const finish = (error: Error | null, value: ControlResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error !== null) reject(error);
      else if (value !== null) resolve(value);
      else reject(new Error("supervisor returned no response"));
    };
    const timer = setTimeout(
      () => finish(new Error(`supervisor control timed out after ${timeoutMs}ms`), null),
      timeoutMs,
    );
    socket.once("error", (error) => finish(error, null));
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 64 * 1024) {
        finish(new Error("supervisor returned an oversized response"), null);
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const parsed = parseControlResponse(buffer.slice(0, newline));
      finish(parsed === null ? new Error("supervisor returned an invalid response") : null, parsed);
    });
    socket.once("connect", () => socket.write(`${JSON.stringify(request)}\n`));
  });
}
