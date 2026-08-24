import { createSafeDiagnosticMessage } from "../observability/redaction.js";
import type { HarnessTraceEvent } from "../observability/types.js";
import type {
  DiagnosticFinding,
  DiagnosticStatus,
  TraceArtifactReadResult,
  TraceDiagnosticSummary,
} from "./types.js";

const TERMINAL_EVENTS = new Set(["query.finished", "query.failed", "query.aborted"]);

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  const redacted = createSafeDiagnosticMessage(value);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(redacted) ? redacted : fallback;
}

function evidenceFor(event: HarnessTraceEvent, reference: string) {
  return {
    source: "trace" as const,
    reference,
    sequences: [event.sequence],
    ...(event.spanId ? { spanIds: [safeLabel(event.spanId, "unknown-span")] } : {}),
  };
}

function recoveryForCategory(category: string): string {
  if (category === "auth_error") return "Check the active model profile and credential source, then retry.";
  if (category === "model_not_found") return "Select an available model or correct the active model profile.";
  if (category === "provider_protocol") return "Check the provider protocol/profile mapping before retrying.";
  if (["rate_limit", "server_error", "server_overload", "connection_error", "api_timeout"].includes(category)) {
    return "Retry after the provider recovers; inspect the retry budget if failures continue.";
  }
  return "Inspect the cited trace stage and provider configuration before retrying.";
}

export function analyzeTraceArtifact(input: TraceArtifactReadResult): {
  summary: TraceDiagnosticSummary;
  findings: DiagnosticFinding[];
} {
  const reference = safeLabel(input.reference, "trace-unavailable");
  const events = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const findings: DiagnosticFinding[] = [];
  const terminal = [...events].reverse().find((event) => TERMINAL_EVENTS.has(event.eventType));
  const retries = events.filter((event) => event.eventType === "retry.scheduled");
  const restarts = events.filter((event) => event.eventType === "stream.restarted");
  const permissionAllows = events.filter((event) => event.eventType === "permission.resolved" && event.payload.decision === "allow");
  const permissionDenies = events.filter((event) => event.eventType === "permission.resolved" && event.payload.decision === "deny");
  const toolStarted = events.filter((event) => event.eventType === "tool.started");
  const toolCompleted = events.filter((event) => event.eventType === "tool.completed");
  const toolFailed = events.filter((event) => event.eventType === "tool.failed");
  const compactions = events.filter((event) => event.eventType === "context.compacted");
  const contextManifests = events.filter((event) => event.eventType === "context.assembled");
  const latestContextManifest = contextManifests.at(-1);
  const contextCategories = Array.isArray(latestContextManifest?.payload.categories)
    ? latestContextManifest.payload.categories
        .map((entry) =>
          entry && typeof entry === "object"
            ? safeLabel((entry as Record<string, unknown>).category, "unknown")
            : "unknown",
        )
        .filter((value, index, values) => value !== "unknown" && values.indexOf(value) === index)
    : [];
  const traceDegraded = events.filter((event) => event.eventType === "trace.degraded");

  if (input.status === "unavailable" || events.length === 0) {
    const incomplete = input.status === "incomplete";
    return {
      summary: {
        status: incomplete ? "incomplete" : "unavailable",
        ...(input.reference ? { reference: input.reference } : {}),
        eventCount: 0,
        ignoredLineCount: input.ignoredLineCount,
        retryCount: 0,
        restartCount: 0,
        permissionAllowCount: 0,
        permissionDenyCount: 0,
        permissionDecisionSources: [],
        toolStartedCount: 0,
        toolCompletedCount: 0,
        toolFailedCount: 0,
        compactionCount: 0,
        contextManifestCount: 0,
        contextLoadedSourceCount: 0,
        contextEstimatedTokens: 0,
        contextCategories: [],
      },
      findings: incomplete ? [{
        code: "trace.artifact-incomplete",
        severity: "warning",
        stage: "trace",
        summary: "The trace artifact exceeded the diagnostic read budget or contained no complete readable event.",
        recovery: "Use a smaller retained trace or reproduce the task before making a lifecycle claim.",
        evidence: { source: "trace", reference },
      }] : findings,
    };
  }

  if (input.ignoredLineCount > 0) {
    findings.push({
      code: "trace.invalid-lines-ignored",
      severity: "warning",
      stage: "trace",
      summary: `${input.ignoredLineCount} malformed or truncated trace line(s) were ignored.`,
      recovery: "Use the readable events, but reproduce the task before making a complete lifecycle claim.",
      evidence: { source: "trace", reference },
    });
  }

  if (!terminal) {
    findings.push({
      code: "trace.terminal-event-missing",
      severity: "warning",
      stage: "query",
      summary: "No query terminal event is available in the latest trace.",
      recovery: "Check whether the process ended before trace close, then reproduce the task if needed.",
      evidence: { source: "trace", reference },
    });
  }

  if (retries.length > 0) {
    const categories = [...new Set(retries.map((event) => safeLabel(event.payload.errorCategory, "unknown")))];
    findings.push({
      code: "retry.scheduled",
      severity: "info",
      stage: "retry",
      summary: `${retries.length} model retry attempt(s) were scheduled (${categories.join(", ")}).`,
      recovery: terminal?.eventType === "query.finished"
        ? "No action is required; the retry path recovered."
        : "Check provider health and the remaining retry budget before rerunning.",
      evidence: {
        source: "trace",
        reference,
        sequences: retries.map((event) => event.sequence),
      },
    });
  }

  if (restarts.length > 0) {
    const reasons = [...new Set(restarts.map((event) => safeLabel(event.payload.reason, "unknown")))];
    findings.push({
      code: "stream.restarted",
      severity: "info",
      stage: "stream",
      summary: `${restarts.length} stream restart(s) occurred (${reasons.join(", ")}).`,
      recovery: terminal?.eventType === "query.finished"
        ? "No action is required; the bounded recovery path completed."
        : "Inspect context pressure and the final model failure before retrying.",
      evidence: { source: "trace", reference, sequences: restarts.map((event) => event.sequence) },
    });
  }

  for (const denied of permissionDenies) {
    const toolUseId = safeLabel(denied.payload.toolUseId, "unknown-tool-use");
    const toolName = safeLabel(denied.payload.toolName, "unknown-tool");
    const decisionSource = safeLabel(
      denied.payload.source ?? denied.payload.decisionSource ?? denied.payload.resolutionSource,
      "unknown-source",
    );
    const executionStarted = toolStarted.some((event) => event.payload.toolUseId === denied.payload.toolUseId);
    findings.push({
      code: executionStarted ? "permission.deny-execution-violation" : "permission.denied",
      severity: executionStarted ? "error" : "warning",
      stage: "permission",
      summary: executionStarted
        ? `Trace contains both deny and tool start events for ${toolName} (${toolUseId}).`
        : `Tool ${toolName} was denied by ${decisionSource} and did not start (${toolUseId}).`,
      recovery: executionStarted
        ? "Stop and inspect the permission contract before running another tool."
        : "Review the decision source or choose an allowed alternative; deny cannot be bypassed.",
      evidence: evidenceFor(denied, reference),
    });
  }

  for (const failed of toolFailed) {
    findings.push({
      code: "tool.execution-failed",
      severity: "warning",
      stage: "tool",
      summary: `Tool ${safeLabel(failed.payload.toolName, "unknown-tool")} failed during execution.`,
      recovery: "Inspect the tool category and safe lifecycle metadata, then retry only if the action is reversible.",
      evidence: evidenceFor(failed, reference),
    });
  }

  for (const degraded of traceDegraded) {
    findings.push({
      code: "trace.writer-degraded",
      severity: "warning",
      stage: "trace",
      summary: "Trace persistence degraded; some diagnostic evidence may be missing.",
      recovery: "Check the trace directory, quota, and writer status before relying on this artifact.",
      evidence: evidenceFor(degraded, reference),
    });
  }

  const modelFailure = [...events].reverse().find((event) => event.eventType === "model.failed");
  if (terminal?.eventType === "query.failed") {
    const category = safeLabel(terminal.payload.errorCategory ?? modelFailure?.payload.errorCategory, "unknown");
    findings.push({
      code: "query.failed",
      severity: "error",
      stage: "query",
      summary: `The query failed in the model path (${category}).`,
      recovery: recoveryForCategory(category),
      evidence: evidenceFor(terminal, reference),
    });
  } else if (terminal?.eventType === "query.aborted") {
    findings.push({
      code: "query.aborted",
      severity: "info",
      stage: "query",
      summary: "The query was cancelled before normal completion.",
      recovery: "Start a new query when ready; confirm no external action remained active.",
      evidence: evidenceFor(terminal, reference),
    });
  }

  let status: DiagnosticStatus = "healthy";
  if (terminal?.eventType === "query.failed" || findings.some((finding) => finding.severity === "error")) status = "failed";
  else if (input.status === "incomplete" || !terminal) status = "incomplete";
  else if (terminal.eventType === "query.aborted") status = "degraded";
  else if (findings.some((finding) => finding.severity === "warning") || traceDegraded.length > 0) status = "degraded";

  return {
    summary: {
      status,
      reference,
      eventCount: events.length,
      ignoredLineCount: input.ignoredLineCount,
      ...(terminal ? { terminalEvent: terminal.eventType as TraceDiagnosticSummary["terminalEvent"] } : {}),
      retryCount: retries.length,
      restartCount: restarts.length,
      permissionAllowCount: permissionAllows.length,
      permissionDenyCount: permissionDenies.length,
      permissionDecisionSources: [...new Set([...permissionAllows, ...permissionDenies].map((event) =>
        safeLabel(event.payload.source ?? event.payload.decisionSource ?? event.payload.resolutionSource, "unknown-source"),
      ))],
      toolStartedCount: toolStarted.length,
      toolCompletedCount: toolCompleted.length,
      toolFailedCount: toolFailed.length,
      compactionCount: compactions.length,
      contextManifestCount: contextManifests.length,
      contextLoadedSourceCount: safeCount(latestContextManifest?.payload.loadedSourceCount),
      contextEstimatedTokens: safeCount(latestContextManifest?.payload.loadedEstimatedTokens),
      contextCategories,
    },
    findings,
  };
}
