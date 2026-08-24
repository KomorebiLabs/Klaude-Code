import type { ToolResult } from "../tools/Tool.js";
import { summarizeToolInput, summarizeToolResult } from "./redaction.js";

export type PermissionDecisionSource =
  | "permission_engine"
  | "pre_tool_hook"
  | "user"
  | "headless"
  | "default_deny";

export function createPermissionRequestedPayload(input: {
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    input: summarizeToolInput(input.toolInput),
  };
}

export function createPermissionResolvedPayload(input: {
  toolName: string;
  toolUseId: string;
  decision: "allow" | "deny";
  source: PermissionDecisionSource;
  prompted: boolean;
}): Record<string, unknown> {
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    decision: input.decision,
    source: input.source,
    prompted: input.prompted,
  };
}

export function createToolStartedPayload(input: {
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    input: summarizeToolInput(input.toolInput),
  };
}

function resultTextLength(result: ToolResult): number {
  if (typeof result.content === "string") return result.content.length;
  try {
    return JSON.stringify(result.content).length;
  } catch {
    return 0;
  }
}

export function createToolFinishedPayload(input: {
  toolName: string;
  toolUseId: string;
  result: ToolResult;
  durationMs: number;
}): Record<string, unknown> {
  const outcome = input.result.isError ? "tool_error" : "success";
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    result: {
      outcome,
      textLength: resultTextLength(input.result),
      truncated: false,
      contentOmitted: true,
    },
    durationMs: Math.max(0, Math.round(input.durationMs)),
  };
}

export function createToolExceptionPayload(input: {
  toolName: string;
  toolUseId: string;
  error: unknown;
  durationMs: number;
}): Record<string, unknown> {
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    result: summarizeToolResult({ outcome: "tool_error" }),
    errorCategory: input.error instanceof Error ? input.error.name : "unknown",
    errorSummary: "Tool execution failed.",
    durationMs: Math.max(0, Math.round(input.durationMs)),
    contentOmitted: true,
  };
}
