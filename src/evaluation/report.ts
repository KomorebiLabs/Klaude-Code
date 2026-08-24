import { createSafeMessage } from "../observability/redaction.js";
import { EVALUATION_SCHEMA_VERSION, type EvaluationResult, type EvaluationTrial, type GraderAssertion } from "./types.js";

function safe(value: string): string {
  return createSafeMessage(value).replace(/[\r\n|]/g, " ");
}

export function createEvaluationResult(input: {
  runId: string;
  trial: EvaluationTrial;
  assertions: GraderAssertion[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  limitationCodes?: string[];
}): EvaluationResult {
  if (input.trial.task.synthetic !== true) {
    throw new Error("Core evaluation only accepts explicitly synthetic tasks.");
  }
  const assertions = input.assertions.map((item) => ({
    invariantId: safe(item.invariantId),
    stage: item.stage,
    passed: item.passed,
    evidence: safe(item.evidence),
  }));
  const resourceConfig = input.trial.resourceConfig;
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId: safe(input.runId),
    trial: {
      trialId: safe(input.trial.trialId),
      harnessVersion: safe(input.trial.harnessVersion),
      task: {
        taskId: safe(input.trial.task.taskId),
        suiteId: safe(input.trial.task.suiteId),
        version: safe(input.trial.task.version),
        fixtureId: safe(input.trial.task.fixtureId),
        synthetic: true,
      },
      ...(input.trial.commit ? { commit: safe(input.trial.commit) } : {}),
      ...(input.trial.modelProfile ? { modelProfile: safe(input.trial.modelProfile) } : {}),
      ...(input.trial.traceId ? { traceId: safe(input.trial.traceId) } : {}),
      ...(resourceConfig ? {
        resourceConfig: {
          ...(typeof resourceConfig.maxTurns === "number" && Number.isFinite(resourceConfig.maxTurns) && resourceConfig.maxTurns >= 0 ? { maxTurns: resourceConfig.maxTurns } : {}),
          ...(typeof resourceConfig.timeoutMs === "number" && Number.isFinite(resourceConfig.timeoutMs) && resourceConfig.timeoutMs >= 0 ? { timeoutMs: resourceConfig.timeoutMs } : {}),
          ...(typeof resourceConfig.concurrency === "number" && Number.isFinite(resourceConfig.concurrency) && resourceConfig.concurrency >= 0 ? { concurrency: resourceConfig.concurrency } : {}),
        },
      } : {}),
    },
    outcome: assertions.every((item) => item.passed) ? "passed" : "failed",
    assertions,
    startedAt: safe(input.startedAt),
    finishedAt: safe(input.finishedAt),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    ...(input.limitationCodes ? { limitationCodes: input.limitationCodes.map(safe) } : {}),
  };
}

export function renderEvaluationMarkdown(result: EvaluationResult): string {
  const lines = [
    `# Evaluation Run ${safe(result.runId)}`,
    "",
    `- Outcome: **${result.outcome}**`,
    `- Suite: ${safe(result.trial.task.suiteId)}`,
    `- Task: ${safe(result.trial.task.taskId)}@${safe(result.trial.task.version)}`,
    `- Trial: ${safe(result.trial.trialId)}`,
    `- Duration: ${result.durationMs} ms`,
    "",
    "| Invariant | Stage | Result | Evidence |",
    "|---|---|---|---|",
    ...result.assertions.map((item) =>
      `| ${safe(item.invariantId)} | ${item.stage} | ${item.passed ? "PASS" : "FAIL"} | ${safe(item.evidence)} |`,
    ),
  ];
  if (result.limitationCodes?.length) {
    lines.push("", "## Limitations", "", ...result.limitationCodes.map((code) => `- ${safe(code)}`));
  }
  return `${lines.join("\n")}\n`;
}
