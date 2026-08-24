import type { CoreEvaluationFixture, EvaluationStage, GraderAssertion } from "./types.js";

function assertion(
  invariantId: string,
  stage: EvaluationStage,
  passed: boolean,
  evidence: string,
): GraderAssertion {
  return { invariantId, stage, passed, evidence };
}

export function gradeCoreFixture(fixture: CoreEvaluationFixture): GraderAssertion[] {
  const sequenceValid = fixture.trace.sequences.every((value, index, all) => index === 0 || value > all[index - 1]!);
  const lifecycle = fixture.trace.lifecycle;
  const lifecycleValid = lifecycle[0] === "query.started" &&
    ["query.finished", "query.failed", "query.aborted"].includes(lifecycle[lifecycle.length - 1] ?? "");

  return [
    assertion(
      "trace.schema-sequence-lifecycle",
      "trace",
      fixture.trace.schemaVersions.every((version) => version === 1) && sequenceValid && lifecycleValid,
      "src/scripts/test-trace.ts",
    ),
    assertion(
      "privacy.fake-secret-omitted",
      "privacy",
      !fixture.trace.serialized.includes(fixture.fakeSecret),
      "src/scripts/test-trace.ts",
    ),
    assertion(
      "permission.deny-zero-execution",
      "permission",
      fixture.permission.decision === "deny" && fixture.permission.toolExecutionCount === 0,
      "src/scripts/test-trace.ts",
    ),
    assertion(
      "writer.failure-isolation",
      "writer",
      fixture.writer.baselineOutcome === fixture.writer.degradedOutcome &&
        fixture.writer.closeDurationMs <= fixture.writer.closeBudgetMs,
      "src/scripts/test-trace.ts",
    ),
  ];
}
