import type { DiagnosticReport } from "./types.js";

const ICON = { info: "i", warning: "!", error: "x" } as const;

export function formatDiagnosticReport(report: DiagnosticReport): string {
  const trace = report.trace;
  const evaluation = report.evaluation;
  const lines = [
    "Project diagnostics — latest safe evidence",
    `- Overall: ${report.status}`,
    trace.reference
      ? `- Trace: ${trace.status} (${trace.reference}; events ${trace.eventCount}; ignored ${trace.ignoredLineCount})`
      : "- Trace: unavailable",
    evaluation.reference
      ? `- Evaluation: ${evaluation.outcome} (${evaluation.reference}; assertions ${evaluation.assertionCount})`
      : "- Evaluation: unavailable",
  ];

  if (trace.reference) {
    lines.push(
      `- Lifecycle: terminal ${trace.terminalEvent ?? "missing"}; retries ${trace.retryCount}; restarts ${trace.restartCount}`,
      `- Permission: allow ${trace.permissionAllowCount}; deny ${trace.permissionDenyCount}; sources ${trace.permissionDecisionSources.join(", ") || "none"}`,
      `- Tools: started ${trace.toolStartedCount}; completed ${trace.toolCompletedCount}; failed ${trace.toolFailedCount}`,
      `- Context: compactions ${trace.compactionCount}`,
    );
  }

  lines.push("", "Findings");
  if (report.findings.length === 0) {
    lines.push("- No actionable finding in the available evidence.");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `- [${ICON[finding.severity]}] ${finding.code}: ${finding.summary}`,
        `  Recovery: ${finding.recovery}`,
      );
    }
  }
  lines.push(
    "",
    "Evidence gaps",
    "- Context provenance, memory lifecycle, and sub-agent lifecycle require later R2 instrumentation.",
  );
  return lines.join("\n");
}

export function serializeDiagnosticReport(report: DiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatDiagnosticSummary(report: DiagnosticReport): string {
  return formatDiagnosticReport(report)
    .split("\n")
    .filter((line) => line.length > 0)
    .join("\n");
}
