import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  analyzeTraceArtifact,
  createProjectDiagnosticReportFromDir,
  formatDiagnosticReport,
  MAX_DIAGNOSTIC_EVALUATION_BYTES,
  readLatestEvaluationSummary,
  readLatestTraceArtifact,
  serializeDiagnosticReport,
} from "../diagnostics/index.js";
import type { HarnessTraceEvent, HarnessTraceEventType } from "../observability/index.js";
import { appendProjectDiagnosticSummary } from "../core/queryEngine/commands/diagnostics.js";

const secret = "sk-diagnostics-must-not-appear";
const absoluteMarker = path.join(os.tmpdir(), "private-diagnostics-project");

function traceEvent(
  sequence: number,
  eventType: HarnessTraceEventType,
  payload: Record<string, unknown> = {},
  spanId?: string,
): HarnessTraceEvent {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    traceId: "diagnostic-trace",
    sequence,
    timestamp: new Date(sequence * 1000).toISOString(),
    eventType,
    ...(spanId ? { spanId } : {}),
    payload,
  };
}

const recoveredTrace = [
  traceEvent(1, "query.started", { model: "fake-model", content: secret }),
  traceEvent(2, "model.requested", { turnId: 1 }, "model-1"),
  traceEvent(3, "retry.scheduled", { turnId: 1, errorCategory: "rate_limit", attempt: 1, delayMs: 25 }, "model-1"),
  traceEvent(4, "model.completed", { turnId: 1, stopReason: "tool_use" }, "model-1"),
  traceEvent(5, "permission.resolved", {
    toolName: "Write",
    toolUseId: "denied-1",
    decision: "deny",
    source: "user",
    input: { path: absoluteMarker, token: secret },
  }, secret),
  traceEvent(6, "query.finished", { reason: "completed" }),
];

const recovered = analyzeTraceArtifact({
  status: "available",
  reference: "recovered.jsonl",
  events: recoveredTrace,
  ignoredLineCount: 0,
});
assert.equal(recovered.summary.status, "degraded");
assert.equal(recovered.summary.retryCount, 1);
assert.equal(recovered.summary.permissionDenyCount, 1);
assert.deepEqual(recovered.summary.permissionDecisionSources, ["user"]);
assert.equal(recovered.summary.toolStartedCount, 0);
assert.equal(recovered.findings.some((finding) => finding.code === "retry.scheduled"), true);
assert.equal(recovered.findings.some((finding) =>
  finding.code === "permission.denied" && finding.summary.includes("did not start")), true);
assert.equal(JSON.stringify(recovered).includes(secret), false);

const failed = analyzeTraceArtifact({
  status: "available",
  reference: "failed.jsonl",
  events: [
    traceEvent(1, "query.started"),
    traceEvent(2, "model.requested", {}, "model-failed"),
    traceEvent(3, "model.failed", { errorCategory: "auth_error", errorSummary: secret }, "model-failed"),
    traceEvent(4, "query.failed", { errorCategory: "auth_error", error: secret }),
  ],
  ignoredLineCount: 0,
});
assert.equal(failed.summary.status, "failed");
assert.equal(failed.findings.some((finding) =>
  finding.code === "query.failed" && finding.recovery.includes("credential")), true);

const recoveredToolFailure = analyzeTraceArtifact({
  status: "available",
  reference: "tool-recovery.jsonl",
  events: [
    traceEvent(1, "query.started"),
    traceEvent(2, "stream.restarted", { reason: "reactive_compact" }),
    traceEvent(3, "permission.resolved", { toolName: "Read", toolUseId: "tool-1", decision: "allow" }, "tool-1"),
    traceEvent(4, "tool.started", { toolName: "Read", toolUseId: "tool-1" }, "tool-1"),
    traceEvent(5, "tool.failed", { toolName: "Read", toolUseId: "tool-1", errorSummary: secret }, "tool-1"),
    traceEvent(6, "query.finished", { reason: "completed" }),
  ],
  ignoredLineCount: 0,
});
assert.equal(recoveredToolFailure.summary.status, "degraded");
assert.equal(recoveredToolFailure.summary.restartCount, 1);
assert.equal(recoveredToolFailure.summary.toolFailedCount, 1);
assert.equal(recoveredToolFailure.findings.some((finding) => finding.code === "stream.restarted"), true);
assert.equal(recoveredToolFailure.findings.some((finding) => finding.code === "tool.execution-failed"), true);

const deniedExecutionViolation = analyzeTraceArtifact({
  status: "available",
  reference: "permission-violation.jsonl",
  events: [
    traceEvent(1, "permission.resolved", { toolName: "Write\nInjected", toolUseId: "denied-2", decision: "deny" }, "tool-2"),
    traceEvent(2, "tool.started", { toolName: "Write", toolUseId: "denied-2" }, "tool-2"),
    traceEvent(3, "query.finished"),
  ],
  ignoredLineCount: 0,
});
assert.equal(deniedExecutionViolation.summary.status, "failed");
assert.equal(deniedExecutionViolation.findings.some((finding) =>
  finding.code === "permission.deny-execution-violation" &&
  !finding.summary.includes("\n") && !finding.summary.includes("Injected")), true);

const aborted = analyzeTraceArtifact({
  status: "available",
  reference: "aborted.jsonl",
  events: [traceEvent(1, "query.started"), traceEvent(2, "query.aborted", { reason: "abort_signal" })],
  ignoredLineCount: 0,
});
assert.equal(aborted.summary.status, "degraded");
assert.equal(aborted.findings.some((finding) => finding.code === "query.aborted"), true);

const incomplete = analyzeTraceArtifact({
  status: "incomplete",
  reference: "partial.jsonl",
  events: [traceEvent(1, "query.started")],
  ignoredLineCount: 2,
});
assert.equal(incomplete.summary.status, "incomplete");
assert.equal(incomplete.findings.some((finding) => finding.code === "trace.invalid-lines-ignored"), true);
assert.equal(incomplete.findings.some((finding) => finding.code === "trace.terminal-event-missing"), true);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "klaude-diagnostics-"));
const projectDir = path.join(tempRoot, "project");
const traceDir = path.join(projectDir, "traces");
const evaluationDir = path.join(projectDir, "evaluations");
await fs.mkdir(traceDir, { recursive: true });
await fs.mkdir(evaluationDir, { recursive: true });

const olderTracePath = path.join(traceDir, "older.jsonl");
const latestTracePath = path.join(traceDir, "latest.jsonl");
await fs.writeFile(olderTracePath, `${JSON.stringify(traceEvent(1, "query.finished"))}\n`, "utf8");
await fs.writeFile(latestTracePath, [
  ...recoveredTrace.map((event) => JSON.stringify(event)),
  `{"schemaVersion":1,"eventType":"truncated","secret":"${secret}"`,
  "",
].join("\n"), "utf8");
await fs.utimes(olderTracePath, new Date(1_000), new Date(1_000));
await fs.utimes(latestTracePath, new Date(2_000), new Date(2_000));

const traceArtifact = await readLatestTraceArtifact(projectDir);
assert.equal(traceArtifact.reference, "latest.jsonl");
assert.equal(traceArtifact.status, "incomplete");
assert.equal(traceArtifact.events.length, recoveredTrace.length);
assert.equal(traceArtifact.ignoredLineCount, 1);

const olderRun = path.join(evaluationDir, "older-run");
const latestRun = path.join(evaluationDir, "latest-run");
await fs.mkdir(olderRun);
await fs.mkdir(latestRun);
await fs.writeFile(path.join(olderRun, "result.json"), JSON.stringify({ schemaVersion: 1, outcome: "passed", assertions: [] }));
await fs.writeFile(path.join(latestRun, "result.json"), JSON.stringify({
  schemaVersion: 1,
  outcome: "failed",
  assertions: [
    { invariantId: "diagnostics.safe-output", stage: "privacy", passed: false, evidence: `${absoluteMarker} ${secret}` },
    { invariantId: "diagnostics.failure-isolation", stage: "infrastructure", passed: true, evidence: "fixture" },
  ],
  limitationCodes: ["single-controlled-trial", secret],
  unsafe: { prompt: secret, cwd: absoluteMarker },
}));
await fs.utimes(path.join(olderRun, "result.json"), new Date(1_000), new Date(1_000));
await fs.utimes(path.join(latestRun, "result.json"), new Date(2_000), new Date(2_000));

const evaluation = await readLatestEvaluationSummary(projectDir);
assert.equal(evaluation.reference, "latest-run");
assert.equal(evaluation.outcome, "failed");
assert.deepEqual(evaluation.failedInvariantIds, ["diagnostics.safe-output"]);

const report = await createProjectDiagnosticReportFromDir(projectDir);
const text = formatDiagnosticReport(report);
const json = serializeDiagnosticReport(report);
assert.equal(report.status, "failed");
assert.equal(report.findings.some((finding) => finding.code === "evaluation.failed"), true);
for (const output of [text, json]) {
  assert.equal(output.includes(secret), false);
  assert.equal(output.includes(absoluteMarker), false);
  assert.equal(output.includes("unsafe"), false);
  assert.equal(output.includes("latest.jsonl"), true);
  assert.equal(output.includes("latest-run"), true);
}

const emptyProject = path.join(tempRoot, "empty-project");
const emptyReport = await createProjectDiagnosticReportFromDir(emptyProject);
assert.equal(emptyReport.status, "unavailable");
assert.equal(emptyReport.trace.status, "unavailable");
assert.equal(emptyReport.evaluation.status, "unavailable");
assert.doesNotThrow(() => formatDiagnosticReport(emptyReport));

const evaluationOnlyProject = path.join(tempRoot, "evaluation-only");
const evaluationOnlyRun = path.join(evaluationOnlyProject, "evaluations", "passing-run");
await fs.mkdir(evaluationOnlyRun, { recursive: true });
await fs.writeFile(path.join(evaluationOnlyRun, "result.json"), JSON.stringify({
  schemaVersion: 1,
  outcome: "passed",
  assertions: [],
}));
const evaluationOnlyReport = await createProjectDiagnosticReportFromDir(evaluationOnlyProject);
assert.equal(evaluationOnlyReport.status, "incomplete");

const oversizedEvaluationProject = path.join(tempRoot, "oversized-evaluation");
const oversizedRun = path.join(oversizedEvaluationProject, "evaluations", "oversized-run");
await fs.mkdir(oversizedRun, { recursive: true });
await fs.writeFile(path.join(oversizedRun, "result.json"), Buffer.alloc(MAX_DIAGNOSTIC_EVALUATION_BYTES + 1, 0x20));
const oversizedReport = await createProjectDiagnosticReportFromDir(oversizedEvaluationProject);
assert.equal(oversizedReport.evaluation.status, "incomplete");
assert.equal(oversizedReport.findings.some((finding) => finding.code === "evaluation.artifact-incomplete"), true);

const fallbackLines = ["Doctor environment checks passed"];
await appendProjectDiagnosticSummary(fallbackLines, tempRoot, async () => {
  throw new Error(`artifact read failed ${secret}`);
});
assert.equal(fallbackLines[0], "Doctor environment checks passed");
assert.equal(fallbackLines.join("\n").includes("Overall: unavailable"), true);
assert.equal(fallbackLines.join("\n").includes(secret), false);

const linkedTrace = path.join(traceDir, "linked.jsonl");
try {
  await fs.symlink(latestTracePath, linkedTrace, "file");
  await fs.utimes(linkedTrace, new Date(3_000), new Date(3_000));
  const afterLink = await readLatestTraceArtifact(projectDir);
  assert.equal(afterLink.reference, "latest.jsonl");
} catch (error: unknown) {
  if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
}

const unsafeNameProject = path.join(tempRoot, "unsafe-name-project");
const unsafeTraceDir = path.join(unsafeNameProject, "traces");
await fs.mkdir(unsafeTraceDir, { recursive: true });
await fs.writeFile(
  path.join(unsafeTraceDir, `${secret}.jsonl`),
  `${JSON.stringify(traceEvent(1, "query.finished"))}\n`,
);
const unsafeNameArtifact = await readLatestTraceArtifact(unsafeNameProject);
assert.equal(unsafeNameArtifact.reference?.includes(secret), false);

await fs.rm(tempRoot, { recursive: true, force: true });
console.log("developer diagnostics analysis/artifact/privacy tests passed");
