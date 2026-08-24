import { getSessionPaths } from "../session/storage.js";
import { readLatestEvaluationSummary, readLatestTraceArtifact } from "./artifactReader.js";
import { analyzeTraceArtifact } from "./traceAnalysis.js";
import {
  DIAGNOSTIC_SCHEMA_VERSION,
  type DiagnosticFinding,
  type DiagnosticReport,
  type DiagnosticStatus,
  type EvaluationDiagnosticSummary,
} from "./types.js";

function evaluationFindings(summary: EvaluationDiagnosticSummary): DiagnosticFinding[] {
  if (summary.status === "incomplete" && summary.reference) {
    return [{
      code: "evaluation.artifact-incomplete",
      severity: "warning",
      stage: "evaluation",
      summary: "The latest Evaluation artifact is malformed or exceeds the diagnostic read budget.",
      recovery: "Regenerate the Evaluation artifact with verify:core before relying on its result.",
      evidence: { source: "evaluation", reference: summary.reference },
    }];
  }
  if (summary.status !== "failed" || !summary.reference) return [];
  return [{
    code: "evaluation.failed",
    severity: "error",
    stage: "evaluation",
    summary: `${summary.failedInvariantIds.length} evaluation invariant(s) failed.`,
    recovery: "Open the cited Evaluation report and fix the failed invariants before relying on this build.",
    evidence: {
      source: "evaluation",
      reference: summary.reference,
      invariantIds: summary.failedInvariantIds,
    },
  }];
}

function overallStatus(statuses: DiagnosticStatus[]): DiagnosticStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("incomplete")) return "incomplete";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.every((status) => status === "unavailable")) return "unavailable";
  if (statuses.includes("unavailable")) return "incomplete";
  return "healthy";
}

export async function createProjectDiagnosticReportFromDir(projectDir: string): Promise<DiagnosticReport> {
  const [traceArtifact, evaluation] = await Promise.all([
    readLatestTraceArtifact(projectDir),
    readLatestEvaluationSummary(projectDir),
  ]);
  const trace = analyzeTraceArtifact(traceArtifact);
  const findings = [...trace.findings, ...evaluationFindings(evaluation)];
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    status: overallStatus([trace.summary.status, evaluation.status]),
    trace: trace.summary,
    evaluation,
    findings,
    evidenceGaps: ["context_provenance", "memory_lifecycle", "subagent_lifecycle"],
  };
}

export async function createProjectDiagnosticReport(cwd: string): Promise<DiagnosticReport> {
  const { projectDir } = await getSessionPaths(cwd, "diagnostics");
  return createProjectDiagnosticReportFromDir(projectDir);
}
