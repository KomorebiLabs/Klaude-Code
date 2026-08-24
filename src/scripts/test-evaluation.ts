import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  applyEvaluationRetentionPolicy,
  createEvaluationResult,
  deleteEvaluationRun,
  gradeCoreFixture,
  renderEvaluationMarkdown,
  writeEvaluationArtifacts,
  type CoreEvaluationFixture,
  type EvaluationTrial,
} from "../evaluation/index.js";

const fakeSecret = "sk-evaluation-super-secret";
const fixture: CoreEvaluationFixture = {
  trace: {
    schemaVersions: [1, 1],
    sequences: [1, 2],
    lifecycle: ["query.started", "query.finished"],
    serialized: "query.started query.finished [REDACTED]",
  },
  permission: { decision: "deny", toolExecutionCount: 0 },
  writer: { baselineOutcome: "completed", degradedOutcome: "completed", closeDurationMs: 20, closeBudgetMs: 250 },
  fakeSecret,
};
const assertions = gradeCoreFixture(fixture);
assert.equal(assertions.length, 4);
assert.equal(assertions.every((item) => item.passed), true);

const trial: EvaluationTrial = {
  trialId: "trial-1",
  task: { taskId: "core-r1", suiteId: "r1-core", version: "1", fixtureId: "synthetic-core-v1", synthetic: true },
  harnessVersion: "0.1.0",
  modelProfile: `fake-profile password=${fakeSecret}`,
  resourceConfig: { maxTurns: 1, timeoutMs: 250, concurrency: 2 },
};
const result = createEvaluationResult({
  runId: "run-1",
  trial,
  assertions,
  startedAt: new Date(0).toISOString(),
  finishedAt: new Date(20).toISOString(),
  durationMs: 20,
  limitationCodes: [`no-real-network token=${fakeSecret}`],
});
assert.equal(result.outcome, "passed");
assert.equal(JSON.stringify(result).includes(fakeSecret), false);
assert.equal(renderEvaluationMarkdown(result).includes(fakeSecret), false);
assert.throws(() => createEvaluationResult({
  ...result,
  trial: { ...trial, task: { ...trial.task, synthetic: false } } as unknown as EvaluationTrial,
}));
const resultWithInjectedFields = createEvaluationResult({
  ...result,
  trial: {
    ...trial,
    injectedSecret: fakeSecret,
    resourceConfig: { ...trial.resourceConfig, injectedSecret: fakeSecret },
    task: { ...trial.task, injectedSecret: fakeSecret },
  } as EvaluationTrial,
});
assert.equal(JSON.stringify(resultWithInjectedFields).includes(fakeSecret), false);
const failingAssertions = gradeCoreFixture({
  ...fixture,
  trace: { ...fixture.trace, sequences: [2, 1] },
});
const failedResult = createEvaluationResult({
  ...result,
  runId: "failed-run",
  trial,
  assertions: failingAssertions,
});
const failedReport = renderEvaluationMarkdown(failedResult);
assert.equal(failedResult.outcome, "failed");
assert.equal(failedReport.includes("| trace | FAIL |"), true);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "easy-agent-evaluation-test-"));
const evaluationRoot = path.join(tempRoot, "evaluations");
const firstPaths = await writeEvaluationArtifacts(tempRoot, result, { rootDir: evaluationRoot });
assert.equal(JSON.parse(await fs.readFile(firstPaths.resultPath, "utf8")).outcome, "passed");
assert.equal((await fs.readFile(firstPaths.reportPath, "utf8")).includes("privacy.fake-secret-omitted"), true);
assert.equal((await fs.readFile(firstPaths.reportPath, "utf8")).includes(fakeSecret), false);

const second = createEvaluationResult({ ...result, runId: "run-2", trial: { ...trial, trialId: "trial-2" } });
const third = createEvaluationResult({ ...result, runId: "run-3", trial: { ...trial, trialId: "trial-3" } });
const secondPaths = await writeEvaluationArtifacts(tempRoot, second, { rootDir: evaluationRoot });
const thirdPaths = await writeEvaluationArtifacts(tempRoot, third, { rootDir: evaluationRoot });
const nowMs = Date.now();
await fs.utimes(firstPaths.runDir, new Date(nowMs - 40 * 86_400_000), new Date(nowMs - 40 * 86_400_000));
await fs.utimes(secondPaths.runDir, new Date(nowMs - 2_000), new Date(nowMs - 2_000));
await fs.utimes(thirdPaths.runDir, new Date(nowMs - 1_000), new Date(nowMs - 1_000));
const thirdBytes = (await fs.stat(thirdPaths.resultPath)).size + (await fs.stat(thirdPaths.reportPath)).size;
const retention = await applyEvaluationRetentionPolicy(evaluationRoot, { maxAgeDays: 30, maxBytes: thirdBytes, nowMs });
assert.equal(retention.deletedByAge, 1);
assert.equal(retention.deletedByQuota, 1);
assert.equal(retention.failures, 0);
await assert.rejects(fs.access(firstPaths.runDir));
await assert.rejects(fs.access(secondPaths.runDir));
await assert.doesNotReject(fs.access(thirdPaths.runDir));
assert.equal(await deleteEvaluationRun(evaluationRoot, "run-3"), true);
assert.equal(await deleteEvaluationRun(evaluationRoot, "run-3"), false);
await assert.rejects(() => writeEvaluationArtifacts(tempRoot, { ...result, runId: "../escape" }, { rootDir: evaluationRoot }));

const externalRoot = path.join(tempRoot, "external");
const linkedRoot = path.join(tempRoot, "linked", "evaluations");
await fs.mkdir(externalRoot, { recursive: true });
await fs.mkdir(path.dirname(linkedRoot), { recursive: true });
await fs.writeFile(path.join(externalRoot, "must-survive"), "safe");
try {
  await fs.symlink(externalRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
  const unsafeRetention = await applyEvaluationRetentionPolicy(linkedRoot, { maxAgeDays: 0, maxBytes: 0 });
  assert.equal(unsafeRetention.skippedUnsafeRoot, true);
  await assert.doesNotReject(fs.access(path.join(externalRoot, "must-survive")));
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code !== "EPERM" && code !== "EACCES") throw error;
}

const unownedRoot = path.join(tempRoot, "unowned", "evaluations");
await fs.mkdir(path.join(unownedRoot, "run-do-not-delete"), { recursive: true });
const unownedRetention = await applyEvaluationRetentionPolicy(unownedRoot, { maxAgeDays: 0, maxBytes: 0 });
assert.equal(unownedRetention.skippedUnsafeRoot, true);
await assert.doesNotReject(fs.access(path.join(unownedRoot, "run-do-not-delete")));

await fs.rm(tempRoot, { recursive: true, force: true });
console.log("evaluation contract/report/store/retention tests passed");
