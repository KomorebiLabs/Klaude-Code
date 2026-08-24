import { randomUUID } from "node:crypto";
import * as path from "node:path";
import {
  applyEvaluationRetentionPolicy,
  createEvaluationResult,
  gradeCoreFixture,
  getEvaluationRoot,
  writeEvaluationArtifacts,
  type CoreEvaluationFixture,
} from "../evaluation/index.js";

const startedAtMs = Date.now();
const fakeSecret = "sk-core-fixture-secret";
const fixture: CoreEvaluationFixture = {
  trace: {
    schemaVersions: [1, 1, 1],
    sequences: [1, 2, 3],
    lifecycle: ["query.started", "model.requested", "query.finished"],
    serialized: "synthetic allowlisted trace fixture",
  },
  permission: { decision: "deny", toolExecutionCount: 0 },
  writer: { baselineOutcome: "completed", degradedOutcome: "completed", closeDurationMs: 20, closeBudgetMs: 250 },
  fakeSecret,
};
const assertions = gradeCoreFixture(fixture);
const runId = `core-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const result = createEvaluationResult({
  runId,
  trial: {
    trialId: `trial-${randomUUID().slice(0, 8)}`,
    task: { taskId: "r1-core-invariants", suiteId: "klaude-core", version: "1", fixtureId: "synthetic-r1-core-v1", synthetic: true },
    harnessVersion: "0.1.0",
    commit: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 40) : "working-tree",
    modelProfile: "fake-provider",
    resourceConfig: { maxTurns: 1, timeoutMs: 250, concurrency: 2 },
  },
  assertions,
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAtMs,
  limitationCodes: ["synthetic-fixtures-only", "no-real-network", "no-production-trace-replay"],
});
const rootDir = process.env.EASY_AGENT_EVALUATION_ROOT
  ? path.resolve(process.env.EASY_AGENT_EVALUATION_ROOT)
  : await getEvaluationRoot(process.cwd());
await applyEvaluationRetentionPolicy(rootDir);
const paths = await writeEvaluationArtifacts(process.cwd(), result, { rootDir });
console.log(`Evaluation outcome: ${result.outcome}`);
console.log(`JSON: ${paths.resultPath}`);
console.log(`Markdown: ${paths.reportPath}`);
if (result.outcome !== "passed") process.exitCode = 1;
