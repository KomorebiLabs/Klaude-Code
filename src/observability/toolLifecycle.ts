import type {
  ToolExternalSource,
  ToolResult,
} from "../tools/Tool.js";
import { summarizeToolInput, summarizeToolResult } from "./redaction.js";
import type {
  PermissionOutcome,
  PermissionPolicySource,
  PermissionReasonCode,
  PermissionResolutionSource,
  ToolEntryPoint,
} from "../permissions/permissionContract.js";
import type { PermissionBehavior } from "../permissions/permissions.js";
import type { ExternalExecutionTraceSummary } from "./types.js";

export type PermissionDecisionSource =
  | "permission_engine"
  | "pre_tool_hook"
  | "user"
  | "headless"
  | "default_deny";

function createExternalSummary(
  source: ToolExternalSource | undefined,
  diagnostics?: ToolResult["diagnostics"],
): ExternalExecutionTraceSummary | undefined {
  if (!source) return undefined;
  return {
    kind: source.kind,
    sourceName: source.sourceName,
    operationName: source.operationName,
    ...(diagnostics?.termination
      ? { termination: diagnostics.termination }
      : {}),
    ...(diagnostics?.sandboxState
      ? { sandboxState: diagnostics.sandboxState }
      : {}),
  };
}

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
  entryPoint: ToolEntryPoint;
  policyDecision: PermissionBehavior;
  decisionSource: PermissionPolicySource;
  reasonCode: PermissionReasonCode;
  outcome: PermissionOutcome;
  resolutionSource: PermissionResolutionSource;
  executionAuthorized: boolean;
}): Record<string, unknown> {
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    decision: input.decision,
    source: input.source,
    entryPoint: input.entryPoint,
    policyDecision: input.policyDecision,
    decisionSource: input.decisionSource,
    reasonCode: input.reasonCode,
    outcome: input.outcome,
    resolutionSource: input.resolutionSource,
    prompted: input.prompted,
    executionAuthorized: input.executionAuthorized,
  };
}

export function createToolStartedPayload(input: {
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
  externalSource?: ToolExternalSource;
}): Record<string, unknown> {
  const external = createExternalSummary(input.externalSource);
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    input: summarizeToolInput(input.toolInput),
    ...(external ? { external } : {}),
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
  externalSource?: ToolExternalSource;
}): Record<string, unknown> {
  const outcome = input.result.isError ? "tool_error" : "success";
  const external = createExternalSummary(
    input.externalSource,
    input.result.diagnostics,
  );
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
    ...(external ? { external } : {}),
  };
}

export function createToolExceptionPayload(input: {
  toolName: string;
  toolUseId: string;
  error: unknown;
  durationMs: number;
  externalSource?: ToolExternalSource;
}): Record<string, unknown> {
  const external = createExternalSummary(input.externalSource);
  return {
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    result: summarizeToolResult({ outcome: "tool_error" }),
    errorCategory: input.error instanceof Error ? input.error.name : "unknown",
    errorSummary: "Tool execution failed.",
    durationMs: Math.max(0, Math.round(input.durationMs)),
    contentOmitted: true,
    ...(external ? { external } : {}),
  };
}
