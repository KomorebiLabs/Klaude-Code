/** Request-scoped Abort/timeout ownership for model and summary calls. */

export type RequestAbortCause = "none" | "user_abort" | "timeout";

export const DEFAULT_MODEL_TIMEOUT_MS = 600_000;

export class RequestTimeoutError extends Error {
  constructor() {
    super("Model request timed out.");
    this.name = "RequestTimeoutError";
  }
}

export class RequestAbortedError extends Error {
  constructor() {
    super("Request was aborted.");
    this.name = "AbortError";
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RequestAbortedError();
}

export function getModelTimeoutMs(): number {
  const parsed = Number(process.env.EASY_AGENT_MODEL_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MODEL_TIMEOUT_MS;
}

export interface RequestLifecycle {
  signal: AbortSignal;
  getCause(): RequestAbortCause;
  normalizeError(error: unknown): unknown;
  dispose(): void;
}

export function createRequestLifecycle(options: {
  parentSignal?: AbortSignal;
  timeoutMs?: number;
} = {}): RequestLifecycle {
  const controller = new AbortController();
  const parentSignal = options.parentSignal;
  const timeoutMs = options.timeoutMs ?? getModelTimeoutMs();
  let cause: RequestAbortCause = "none";
  let disposed = false;

  const abortFromParent = () => {
    if (cause !== "none" || disposed) return;
    cause = "user_abort";
    controller.abort(new RequestAbortedError());
  };

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timer = cause === "none"
    ? setTimeout(() => {
        if (cause !== "none" || disposed) return;
        cause = "timeout";
        controller.abort(new RequestTimeoutError());
      }, timeoutMs)
    : undefined;

  return {
    signal: controller.signal,
    getCause: () => cause,
    normalizeError(error: unknown): unknown {
      if (cause === "timeout") return new RequestTimeoutError();
      if (cause === "user_abort") return new RequestAbortedError();
      return error;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (timer) clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}
