import type { Usage } from "../types/message.js";

export interface ModelRequestPayloadInput {
  model: string;
  turnId: number;
  messageCount: number;
  toolCount: number;
  maxTokensOverridden: boolean;
}

export function createModelRequestedPayload(input: ModelRequestPayloadInput): Record<string, unknown> {
  return {
    model: input.model,
    turnId: input.turnId,
    apiAttempt: 1,
    messageCount: input.messageCount,
    toolCount: input.toolCount,
    maxTokensOverridden: input.maxTokensOverridden,
    contentOmitted: true,
  };
}

export function createModelCompletedPayload(input: {
  turnId: number;
  stopReason: string;
  usage: Usage;
  blockTypes: string[];
  durationMs: number;
}): Record<string, unknown> {
  const blockCounts = input.blockTypes.reduce<Record<string, number>>((counts, type) => {
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});
  return {
    turnId: input.turnId,
    stopReason: input.stopReason,
    inputTokens: input.usage.input_tokens,
    outputTokens: input.usage.output_tokens,
    cacheCreationInputTokens: input.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: input.usage.cache_read_input_tokens ?? 0,
    blockCount: input.blockTypes.length,
    blockCounts,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    contentOmitted: true,
  };
}

export function createModelFailedPayload(input: {
  turnId: number;
  error: unknown;
  errorCategory?: string;
  durationMs: number;
}): Record<string, unknown> {
  const aborted = input.errorCategory === "aborted";
  const errorCategory = input.errorCategory ?? (input.error instanceof Error ? input.error.name : "unknown");
  return {
    turnId: input.turnId,
    outcome: aborted ? "aborted" : "failure",
    errorCategory,
    errorSummary: aborted ? "Model request aborted." : `Model request failed (${errorCategory}).`,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    contentOmitted: true,
  };
}

export function createRetryScheduledPayload(input: {
  turnId: number;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  errorCategory: string;
}): Record<string, unknown> {
  return {
    turnId: input.turnId,
    attempt: input.attempt,
    nextAttempt: input.attempt + 1,
    maxRetries: input.maxRetries,
    delayMs: input.delayMs,
    errorCategory: input.errorCategory,
  };
}

export function createStreamRestartedPayload(input: {
  turnId: number;
  reason: "max_tokens_escalation" | "reactive_compact";
}): Record<string, unknown> {
  return { turnId: input.turnId, reason: input.reason };
}
