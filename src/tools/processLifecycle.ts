import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export const DEFAULT_PROCESS_TIMEOUT_MS = 120_000;
export const MIN_PROCESS_TIMEOUT_MS = 100;
export const MAX_PROCESS_TIMEOUT_MS = 600_000;
const DEFAULT_OUTPUT_LIMIT_CHARS = 30_000;
const DEFAULT_TERMINATION_GRACE_MS = 1_000;

export type ManagedProcessStatus =
  | "completed"
  | "spawn_error"
  | "timeout"
  | "aborted";

export type ProcessTermination = "not_required" | "confirmed" | "degraded";

export interface ManagedProcessOptions {
  executable: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  outputLimitChars?: number;
  terminationGraceMs?: number;
  abortSignal?: AbortSignal;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
}

export interface ManagedProcessResult {
  status: ManagedProcessStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  termination: ProcessTermination;
  errorMessage?: string;
}

export function normalizeToolTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_PROCESS_TIMEOUT_MS;
  }
  return Math.min(
    MAX_PROCESS_TIMEOUT_MS,
    Math.max(MIN_PROCESS_TIMEOUT_MS, Math.trunc(timeoutMs)),
  );
}

/** Retains a fixed prefix while accounting for discarded output. */
export class BoundedTextBuffer {
  private retained = "";
  private discardedChars = 0;

  constructor(private readonly maxChars: number) {}

  append(value: string): void {
    const available = Math.max(0, this.maxChars - this.retained.length);
    this.retained += value.slice(0, available);
    this.discardedChars += Math.max(0, value.length - available);
  }

  toString(): string {
    if (this.discardedChars === 0) return this.retained;
    return `${this.retained}\n...[truncated ${this.discardedChars} chars]`;
  }
}

function signalProcessTree(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const args = ["/PID", String(child.pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    const killer = spawn("taskkill.exe", args, {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", () => undefined);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process may have exited between the close check and signal.
    }
  }
}

export function runManagedProcess(
  options: ManagedProcessOptions,
): Promise<ManagedProcessResult> {
  const timeoutMs = normalizeToolTimeout(options.timeoutMs);
  const outputLimit = Math.max(1, Math.trunc(options.outputLimitChars ?? DEFAULT_OUTPUT_LIMIT_CHARS));
  const terminationGraceMs = Math.max(
    50,
    Math.trunc(options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS),
  );

  return new Promise((resolve) => {
    const stdout = new BoundedTextBuffer(outputLimit);
    const stderr = new BoundedTextBuffer(outputLimit);
    const child = spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      windowsHide: true,
    });

    let settled = false;
    let requestedStatus: "timeout" | "aborted" | null = null;
    let forceTimer: NodeJS.Timeout | undefined;
    let degradedTimer: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      clearTimeout(timeoutTimer);
      if (forceTimer) clearTimeout(forceTimer);
      if (degradedTimer) clearTimeout(degradedTimer);
      options.abortSignal?.removeEventListener("abort", onAbort);
    };

    const finish = (
      status: ManagedProcessStatus,
      exitCode: number | null,
      termination: ProcessTermination,
      errorMessage?: string,
    ): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        status,
        exitCode,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        termination,
        ...(errorMessage ? { errorMessage } : {}),
      });
    };

    const requestTermination = (status: "timeout" | "aborted"): void => {
      if (settled || requestedStatus) return;
      requestedStatus = status;
      signalProcessTree(child, process.platform === "win32" ? "SIGKILL" : "SIGTERM");
      forceTimer = setTimeout(() => signalProcessTree(child, "SIGKILL"), terminationGraceMs);
      degradedTimer = setTimeout(
        () => finish(status, child.exitCode, "degraded"),
        terminationGraceMs * 2,
      );
    };

    const onAbort = (): void => requestTermination("aborted");
    const timeoutTimer = setTimeout(() => requestTermination("timeout"), timeoutMs);

    options.abortSignal?.addEventListener("abort", onAbort, { once: true });
    if (options.abortSignal?.aborted) onAbort();

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout.append(text);
      options.onStdout?.(text);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr.append(text);
      options.onStderr?.(text);
    });
    child.on("error", (error) => {
      if (requestedStatus) return;
      finish("spawn_error", null, "not_required", error.message);
    });
    child.on("close", (code) => {
      if (requestedStatus) {
        finish(requestedStatus, code, "confirmed");
      } else {
        finish("completed", code, "not_required");
      }
    });
  });
}
