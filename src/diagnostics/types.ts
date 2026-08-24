export const DIAGNOSTIC_SCHEMA_VERSION = 1 as const;

export type DiagnosticStatus = "healthy" | "degraded" | "failed" | "incomplete" | "unavailable";
export type DiagnosticSeverity = "info" | "warning" | "error";
export type DiagnosticStage =
  | "trace"
  | "query"
  | "provider"
  | "retry"
  | "stream"
  | "permission"
  | "tool"
  | "context"
  | "memory"
  | "evaluation";

export interface DiagnosticEvidence {
  source: "trace" | "evaluation" | "memory";
  reference: string;
  sequences?: number[];
  spanIds?: string[];
  invariantIds?: string[];
}

export interface DiagnosticFinding {
  code: string;
  severity: DiagnosticSeverity;
  stage: DiagnosticStage;
  summary: string;
  recovery: string;
  evidence: DiagnosticEvidence;
}

export interface TraceDiagnosticSummary {
  status: DiagnosticStatus;
  reference?: string;
  eventCount: number;
  ignoredLineCount: number;
  terminalEvent?: "query.finished" | "query.failed" | "query.aborted";
  retryCount: number;
  restartCount: number;
  permissionAllowCount: number;
  permissionDenyCount: number;
  permissionDecisionSources: string[];
  toolStartedCount: number;
  toolCompletedCount: number;
  toolFailedCount: number;
  compactionCount: number;
  contextManifestCount: number;
  contextLoadedSourceCount: number;
  contextEstimatedTokens: number;
  contextCategories: string[];
}

export interface MemoryDiagnosticSummary {
  status: DiagnosticStatus;
  activeCount: number;
  staleCount: number;
  legacyCount: number;
  invalidCount: number;
}

export interface EvaluationDiagnosticSummary {
  status: DiagnosticStatus;
  reference?: string;
  outcome?: "passed" | "failed" | "infra_error";
  assertionCount: number;
  failedInvariantIds: string[];
  limitationCodes: string[];
}

export interface DiagnosticReport {
  schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
  status: DiagnosticStatus;
  trace: TraceDiagnosticSummary;
  evaluation: EvaluationDiagnosticSummary;
  memory: MemoryDiagnosticSummary;
  findings: DiagnosticFinding[];
  evidenceGaps: Array<"context_provenance" | "memory_lifecycle" | "subagent_lifecycle">;
}

export interface TraceArtifactReadResult {
  status: "available" | "incomplete" | "unavailable";
  reference?: string;
  events: import("../observability/types.js").HarnessTraceEvent[];
  ignoredLineCount: number;
}
