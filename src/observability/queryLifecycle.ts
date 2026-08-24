import type { Usage } from "../types/message.js";
import { createSafeMessage } from "./redaction.js";

export interface QueryStartedPayloadInput {
  model: string;
  permissionMode: string;
  messageCount: number;
  promptLength: number;
  hasUserPrompt: boolean;
}

export interface QueryFinishedPayloadInput {
  reason?: string;
  messageCount: number;
  usage: Usage;
}

export function createQueryStartedPayload(input: QueryStartedPayloadInput): Record<string, unknown> {
  return {
    model: input.model,
    permissionMode: input.permissionMode,
    messageCount: input.messageCount,
    promptLength: input.promptLength,
    hasUserPrompt: input.hasUserPrompt,
    contentOmitted: true,
  };
}

export function createQueryFinishedPayload(input: QueryFinishedPayloadInput): Record<string, unknown> {
  return {
    ...(input.reason ? { reason: input.reason } : {}),
    messageCount: input.messageCount,
    inputTokens: input.usage.input_tokens,
    outputTokens: input.usage.output_tokens,
    cacheCreationInputTokens: input.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: input.usage.cache_read_input_tokens ?? 0,
  };
}

export function getQueryTerminalEventType(
  reason: string,
): "query.finished" | "query.aborted" | "query.failed" {
  if (reason === "aborted") return "query.aborted";
  if (reason === "timeout" || reason === "model_error") return "query.failed";
  return "query.finished";
}

export function createQueryFailedPayload(
  error: unknown,
  context?: {
    reason?: "timeout" | "model_error";
    errorCategory?: "api_timeout" | "model_error";
  },
): Record<string, unknown> {
  const reason = context?.reason === "timeout" || context?.reason === "model_error"
    ? context.reason
    : undefined;
  const contextualCategory = context?.errorCategory === "api_timeout" || context?.errorCategory === "model_error"
    ? context.errorCategory
    : undefined;
  const errorCategory = contextualCategory ?? (error instanceof Error ? error.name : typeof error);
  return {
    ...(reason ? { reason } : {}),
    errorCategory,
    error: reason
      ? `Query failed (${errorCategory}).`
      : createSafeMessage(error),
  };
}

export function createQueryAbortedPayload(): Record<string, unknown> {
  return {
    reason: "abort_signal",
  };
}
