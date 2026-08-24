/**
 * API retry core — exponential backoff + jitter, with a foreground/background
 * 529 split.
 *
 * Reference: claude-code-source-code/src/services/api/withRetry.ts
 *
 * The source `withRetry` is ~800 lines, but most of it serves features Easy
 * Agent does not have: Bedrock/Vertex/OAuth token refresh, fast mode, the
 * persistent/unattended keep-alive path, fallbackModel downgrade, and the
 * subscriber-tier gates. Stripped of all that, the real kernel is small:
 *
 *   1. decide whether an error is retryable (delegated to errors.ts),
 *   2. wait an exponentially-growing, jittered delay (honoring Retry-After),
 *   3. give up after N attempts.
 *
 * On top of that sits the one genuinely interesting policy decision: during a
 * capacity cascade, foreground requests (a user is waiting) retry on 529 while
 * background requests (a summary, a title — nobody is waiting) fail
 * immediately, so we don't amplify load 3-10× through the gateway.
 */

import {
  classifyAPIError,
  classifyHarnessError,
  getRetryAfterMs,
  is529Error,
} from "./errors.js";

/**
 * Where a query originated. Source keys a 13-entry whitelist
 * (FOREGROUND_529_RETRY_SOURCES) off this; the teaching version collapses it
 * to two buckets — that is all the policy actually needs.
 */
export type QuerySource = "foreground" | "background";

export const DEFAULT_MAX_RETRIES = 10;
export const BASE_DELAY_MS = 500;
export const MAX_DELAY_MS = 32_000;
export const MAX_529_RETRIES = 3;
/** Preserves the legacy ten-retry worst-case backoff envelope (199,375 ms). */
export const DEFAULT_RETRY_DELAY_BUDGET_MS = 200_000;

export type RetryStopReason =
  | "scheduled"
  | "background_overload"
  | "overload_limit"
  | "non_retryable"
  | "attempts_exhausted"
  | "delay_budget_exhausted";

/**
 * Max retry attempts, overridable via env for tests / unusual environments.
 * EASY_AGENT_MAX_RETRIES is the project name; CLAUDE_CODE_MAX_RETRIES is
 * honored too for parity with source.
 */
export function getMaxRetries(): number {
  const raw =
    process.env.EASY_AGENT_MAX_RETRIES ?? process.env.CLAUDE_CODE_MAX_RETRIES;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_MAX_RETRIES;
}

/**
 * Exponential backoff with jitter. `attempt` is 1-based.
 *
 *   delay = min(BASE * 2^(attempt-1), MAX) + random(0, 25% of that)
 *
 * If the server sent a `Retry-After`, obey it verbatim (it is a directive and
 * intentionally bypasses the local ceiling). The jitter is what avoids the
 * thundering-herd: without it, every throttled client retries in lockstep and
 * re-stampedes the server at exactly the same instants.
 */
export function getRetryDelay(
  attempt: number,
  retryAfterMs?: number | null,
  maxDelayMs = MAX_DELAY_MS,
): number {
  if (retryAfterMs !== null && retryAfterMs !== undefined && retryAfterMs > 0) {
    return retryAfterMs;
  }
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), maxDelayMs);
  const jitter = Math.random() * 0.25 * base;
  return Math.round(base + jitter);
}

/**
 * On a 529 (capacity overload), should we retry? Foreground sources retry
 * (the user is blocking on the result); background sources bail immediately to
 * avoid amplifying a capacity cascade. `undefined` defaults to foreground —
 * conservative for untagged call paths, matching source.
 */
export function shouldRetry529(source: QuerySource | undefined): boolean {
  return source === undefined || source === "foreground";
}

/**
 * Decide whether the loop should retry `error` on this `attempt`, and how long
 * to wait. Pure — does no sleeping or logging — so both the streaming path
 * (which yields a notice while waiting) and the non-streaming path can share
 * the policy.
 */
export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  /** 1-based count of 529s seen so far (caller threads this back in). */
  consecutive529: number;
  reason: RetryStopReason;
  attempt: number;
  maxAttempts: number;
  spentDelayMs: number;
  remainingDelayMs: number;
}

export function decideRetry(
  error: unknown,
  attempt: number,
  options: {
    maxRetries: number;
    querySource?: QuerySource;
    consecutive529?: number;
    maxTotalDelayMs?: number;
    spentDelayMs?: number;
  },
): RetryDecision {
  const consecutive529Prev = options.consecutive529 ?? 0;
  const maxAttempts = Math.max(1, Math.floor(options.maxRetries) + 1);
  const maxTotalDelayMs = Math.max(
    0,
    options.maxTotalDelayMs ?? DEFAULT_RETRY_DELAY_BUDGET_MS,
  );
  const spentDelayMs = Math.min(
    maxTotalDelayMs,
    Math.max(0, options.spentDelayMs ?? 0),
  );
  const remainingDelayMs = maxTotalDelayMs - spentDelayMs;
  const stop = (
    reason: Exclude<RetryStopReason, "scheduled">,
    consecutive529: number,
  ): RetryDecision => ({
    retry: false,
    delayMs: 0,
    consecutive529,
    reason,
    attempt,
    maxAttempts,
    spentDelayMs,
    remainingDelayMs,
  });

  // Background sources drop 529 immediately — no amplification.
  if (is529Error(error) && !shouldRetry529(options.querySource)) {
    return stop("background_overload", consecutive529Prev);
  }

  const consecutive529 = is529Error(error)
    ? consecutive529Prev + 1
    : consecutive529Prev;

  // Even foreground gives up on a sustained 529 storm.
  if (is529Error(error) && consecutive529 >= MAX_529_RETRIES) {
    return stop("overload_limit", consecutive529);
  }

  if (!classifyHarnessError(error).retryable) {
    return stop("non_retryable", consecutive529);
  }

  if (attempt >= maxAttempts) {
    return stop("attempts_exhausted", consecutive529);
  }

  const delayMs = getRetryDelay(attempt, getRetryAfterMs(error));
  if (delayMs > remainingDelayMs) {
    return stop("delay_budget_exhausted", consecutive529);
  }
  return {
    retry: true,
    delayMs,
    consecutive529,
    reason: "scheduled",
    attempt,
    maxAttempts,
    spentDelayMs,
    remainingDelayMs: remainingDelayMs - delayMs,
  };
}

/** A stream attempt is replay-safe only before any user-visible output. */
export function shouldReplayStreamAttempt(
  decision: RetryDecision,
  hasYieldedContent: boolean,
): boolean {
  return decision.retry && !hasYieldedContent;
}

/**
 * Sleep that also resolves early if the abort signal fires, so an in-flight
 * retry wait can be interrupted promptly.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

/**
 * Non-streaming retry wrapper for single-shot calls (e.g. compaction's
 * summarize request). The streaming path can't use this — it needs to yield a
 * notice while waiting — so it shares `decideRetry`/`sleep` directly instead.
 */
export async function callWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxRetries?: number;
    querySource?: QuerySource;
    signal?: AbortSignal;
    maxTotalDelayMs?: number;
    onRetry?: (info: {
      attempt: number;
      delayMs: number;
      category: string;
      reason: RetryStopReason;
      spentDelayMs: number;
      remainingDelayMs: number;
    }) => void;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? getMaxRetries();
  let consecutive529 = 0;
  let spentDelayMs = 0;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    if (options.signal?.aborted) {
      throw new Error("Request was aborted.");
    }
    try {
      return await operation(attempt);
    } catch (error) {
      const decision = decideRetry(error, attempt, {
        maxRetries,
        querySource: options.querySource,
        consecutive529,
        maxTotalDelayMs: options.maxTotalDelayMs,
        spentDelayMs,
      });
      consecutive529 = decision.consecutive529;
      if (!decision.retry) {
        throw error;
      }
      options.onRetry?.({
        attempt,
        delayMs: decision.delayMs,
        category: classifyAPIError(error),
        reason: decision.reason,
        spentDelayMs,
        remainingDelayMs: decision.remainingDelayMs,
      });
      spentDelayMs += decision.delayMs;
      await sleep(decision.delayMs, options.signal);
    }
  }
}
