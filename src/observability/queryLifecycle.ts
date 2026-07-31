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

export function createQueryFailedPayload(error: unknown): Record<string, unknown> {
  return {
    errorCategory: error instanceof Error ? error.name : typeof error,
    error: createSafeMessage(error),
  };
}

export function createQueryAbortedPayload(): Record<string, unknown> {
  return {
    reason: "abort_signal",
  };
}
