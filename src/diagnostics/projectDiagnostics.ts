import { getSessionPaths } from "../session/storage.js";
import { join } from "node:path";
import { readLatestEvaluationSummary, readLatestTraceArtifact } from "./artifactReader.js";
import { analyzeTraceArtifact } from "./traceAnalysis.js";
import {
  DIAGNOSTIC_SCHEMA_VERSION,
  type DiagnosticFinding,
  type DiagnosticReport,
  type DiagnosticStatus,
  type EvaluationDiagnosticSummary,
} from "./types.js";
import { summarizeMemoryDirectory } from "./memoryAnalysis.js";

function memoryFindings(memory: DiagnosticReport["memory"]): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (memory.staleCount > 0) {
    findings.push({
      code: "memory.stale",
      severity: "warning",
      stage: "memory",
      summary: `${memory.staleCount} memory file(s) are expired and excluded from the active index.`,
      recovery: "Review, refresh, or archive stale memories before relying on them.",
      evidence: { source: "memory", reference: "memory-manifest" },
    });
  }
  if (memory.legacyCount > 0) {
    findings.push({
      code: "memory.legacy-metadata",
      severity: "warning",
      stage: "memory",
      summary: `${memory.legacyCount} memory file(s) have unknown provenance and freshness.`,
      recovery: "Re-write legacy memories through MemoryWrite after verifying their current facts.",
      evidence: { source: "memory", reference: "memory-manifest" },
    });
  }
  if (memory.invalidCount > 0) {
    findings.push({
      code: "memory.invalid-metadata",
      severity: "warning",
      stage: "memory",
      summary: `${memory.invalidCount} memory file(s) could not be safely classified.`,
      recovery: "Inspect malformed or oversized memory metadata before using those files.",
      evidence: { source: "memory", reference: "memory-manifest" },
    });
  }
  return findings;
}

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
  const [traceArtifact, evaluation, memory] = await Promise.all([
    readLatestTraceArtifact(projectDir),
    readLatestEvaluationSummary(projectDir),
    summarizeMemoryDirectory(join(projectDir, "memory")),
  ]);
  const trace = analyzeTraceArtifact(traceArtifact);
  const findings = [...trace.findings, ...evaluationFindings(evaluation), ...memoryFindings(memory)];
  const evidenceGaps: DiagnosticReport["evidenceGaps"] = ["subagent_lifecycle"];
  if (trace.summary.contextManifestCount === 0) evidenceGaps.unshift("context_provenance");
  if (memory.status === "unavailable") evidenceGaps.splice(evidenceGaps.length - 1, 0, "memory_lifecycle");
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    status: overallStatus([trace.summary.status, evaluation.status, memory.status]),
    trace: trace.summary,
    evaluation,
    memory,
    findings,
    evidenceGaps,
  };
}

export async function createProjectDiagnosticReport(cwd: string): Promise<DiagnosticReport> {
  const { projectDir } = await getSessionPaths(cwd, "diagnostics");
  return createProjectDiagnosticReportFromDir(projectDir);
}
