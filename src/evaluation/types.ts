export const EVALUATION_SCHEMA_VERSION = 1 as const;

export type EvaluationOutcome = "passed" | "failed" | "infra_error";
export type EvaluationStage = "trace" | "privacy" | "permission" | "writer" | "infrastructure";

export interface EvaluationTask {
  taskId: string;
  suiteId: string;
  version: string;
  fixtureId: string;
  synthetic: true;
}

export interface EvaluationTrial {
  trialId: string;
  task: EvaluationTask;
  harnessVersion: string;
  commit?: string;
  modelProfile?: string;
  traceId?: string;
  resourceConfig?: {
    maxTurns?: number;
    timeoutMs?: number;
    concurrency?: number;
  };
}

export interface GraderAssertion {
  invariantId: string;
  stage: EvaluationStage;
  passed: boolean;
  evidence: string;
}

export interface EvaluationResult {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  runId: string;
  trial: EvaluationTrial;
  outcome: EvaluationOutcome;
  assertions: GraderAssertion[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  limitationCodes?: string[];
}

export interface CoreEvaluationFixture {
  trace: {
    schemaVersions: number[];
    sequences: number[];
    lifecycle: string[];
    serialized: string;
  };
  permission: { decision: "allow" | "deny"; toolExecutionCount: number };
  writer: { baselineOutcome: string; degradedOutcome: string; closeDurationMs: number; closeBudgetMs: number };
  fakeSecret: string;
}
