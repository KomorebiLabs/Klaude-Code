import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { query, type AgenticLoopEvent, type AgenticLoopResult } from "../core/agenticLoop.js";
import {
  applyEvaluationRetentionPolicy,
  createEvaluationResult,
  getEvaluationRoot,
  R1_CORE_EVIDENCE_MATRIX,
  writeEvaluationArtifacts,
  type EvaluationStage,
  type GraderAssertion,
} from "../evaluation/index.js";
import type { HarnessTraceEventType, TraceSink } from "../observability/index.js";
import type { StreamEvent } from "../types/message.js";
import type { StreamRequestParams, StreamResult } from "../services/api/streaming.js";
import { clearMcpTools, registerMcpTools } from "../tools/index.js";
import type { Tool } from "../tools/Tool.js";
import { toolToApiParam } from "../tools/Tool.js";

const startedAtMs = Date.now();
const secretMarker = "sk-r1-e2e-must-not-enter-trace";
const resultMarker = "r1-probe-result-must-not-enter-trace";
let toolExecutionCount = 0;

interface CapturedTraceEvent {
  eventType: HarnessTraceEventType;
  payload: Record<string, unknown>;
  spanId?: string;
}

const traceEvents: CapturedTraceEvent[] = [];
const traceSink: TraceSink = {
  emit(eventType, payload, options) {
    traceEvents.push({ eventType, payload, spanId: options?.spanId });
  },
  async close() {},
  getStatus() {
    return { state: "active", droppedEvents: 0 };
  },
};

const probeTool: Tool = {
  name: "R1EvidenceProbe",
  description: "Deterministic read-only probe for the R1 release trial",
  inputSchema: {
    type: "object",
    properties: { marker: { type: "string" } },
    required: ["marker"],
    additionalProperties: false,
  },
  async call() {
    toolExecutionCount++;
    return { content: resultMarker };
  },
  isReadOnly: () => true,
  isEnabled: () => true,
  isConcurrencySafe: () => true,
};

let providerCallCount = 0;
let toolAdvertisedToProvider = false;
let toolResultReturnedToProvider = false;
async function* controlledProvider(params: StreamRequestParams): AsyncGenerator<StreamEvent, StreamResult> {
  providerCallCount++;
  if (providerCallCount === 1) {
    toolAdvertisedToProvider = params.tools?.some((tool) => tool.name === probeTool.name) === true;
    return {
      assistantMessage: {
        role: "assistant",
        content: [{ type: "tool_use", id: "r1-probe-use", name: probeTool.name, input: { marker: secretMarker } }],
      },
      usage: { input_tokens: 10, output_tokens: 4 },
      stopReason: "tool_use",
    };
  }

  const serializedMessages = JSON.stringify(params.messages);
  toolResultReturnedToProvider = serializedMessages.includes(resultMarker) && serializedMessages.includes("r1-probe-use");
  return {
    assistantMessage: { role: "assistant", content: [{ type: "text", text: "R1 controlled task completed" }] },
    usage: { input_tokens: 16, output_tokens: 5 },
    stopReason: "end_turn",
  };
}

async function runControlledTask(): Promise<{ events: AgenticLoopEvent[]; result: AgenticLoopResult }> {
  registerMcpTools([probeTool]);
  try {
    const loop = query({
      messages: [{ role: "user", content: "Run the deterministic R1 evidence probe." }],
      model: "fake-r1-provider",
      tools: [toolToApiParam(probeTool)],
      toolContext: { cwd: os.tmpdir() },
      maxTurns: 3,
      traceSink,
      streamMessageImpl: controlledProvider,
    });
    const events: AgenticLoopEvent[] = [];
    while (true) {
      const next = await loop.next();
      if (next.done) return { events, result: next.value };
      events.push(next.value);
    }
  } finally {
    clearMcpTools();
  }
}

function stageFor(invariantId: string): EvaluationStage {
  if (invariantId.startsWith("trace.")) return "trace";
  if (invariantId.startsWith("privacy.") || invariantId.startsWith("diagnostics.")) return "privacy";
  if (invariantId.startsWith("permission.") || invariantId.startsWith("tool.") || invariantId.startsWith("sandbox.") || invariantId.startsWith("mcp.")) return "permission";
  if (invariantId.startsWith("writer.")) return "writer";
  return "infrastructure";
}

async function matrixAssertions(): Promise<GraderAssertion[]> {
  const uniqueIds = new Set(R1_CORE_EVIDENCE_MATRIX.map((entry) => entry.invariantId));
  assert.equal(R1_CORE_EVIDENCE_MATRIX.length, 25, "R1 matrix must contain all 25 approved invariants");
  assert.equal(uniqueIds.size, R1_CORE_EVIDENCE_MATRIX.length, "R1 matrix invariant ids must be unique");

  return Promise.all(R1_CORE_EVIDENCE_MATRIX.map(async (entry) => {
    const evidenceFiles = entry.evidenceFile.split(",").map((item) => item.trim());
    const checks = await Promise.all(evidenceFiles.map(async (file) => {
      try {
        await fs.access(path.resolve(file));
        return true;
      } catch {
        return false;
      }
    }));
    return {
      invariantId: entry.invariantId,
      stage: stageFor(entry.invariantId),
      passed: entry.command.length > 0 && evidenceFiles.length > 0 && checks.every(Boolean),
      evidence: `${entry.command} | ${entry.evidenceFile}`,
    };
  }));
}

const controlled = await runControlledTask();
const eventTypes = traceEvents.map((event) => event.eventType);
const serializedTrace = JSON.stringify(traceEvents);
const toolTrace = traceEvents.filter((event) => event.payload.toolUseId === "r1-probe-use");
const finalMessage = controlled.result.state.messages.at(-1);
const finalResponsePresent = finalMessage?.role === "assistant" &&
  JSON.stringify(finalMessage.content).includes("R1 controlled task completed");
const controlledAssertions: GraderAssertion[] = [
  {
    invariantId: "release.controlled-model-tool-completion",
    stage: "infrastructure",
    passed: controlled.result.reason === "completed" && providerCallCount === 2 && toolAdvertisedToProvider &&
      toolResultReturnedToProvider && finalResponsePresent,
    evidence: "src/scripts/verify-r1-release.ts",
  },
  {
    invariantId: "release.controlled-tool-at-most-once",
    stage: "permission",
    passed: toolExecutionCount === 1 && controlled.events.filter((event) => event.type === "tool_use_done").length === 1,
    evidence: "src/scripts/verify-r1-release.ts",
  },
  {
    invariantId: "release.controlled-trace-lifecycle",
    stage: "trace",
    passed: JSON.stringify(eventTypes) === JSON.stringify([
      "model.requested",
      "model.completed",
      "permission.resolved",
      "tool.started",
      "tool.completed",
      "model.requested",
      "model.completed",
    ]) && new Set(toolTrace.map((event) => event.spanId)).size === 1,
    evidence: "src/scripts/verify-r1-release.ts",
  },
  {
    invariantId: "release.controlled-trace-privacy",
    stage: "privacy",
    passed: !serializedTrace.includes(secretMarker) && !serializedTrace.includes(resultMarker),
    evidence: "src/scripts/verify-r1-release.ts",
  },
];

const assertions = [...await matrixAssertions(), ...controlledAssertions];
const runId = `r1-release-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const result = createEvaluationResult({
  runId,
  trial: {
    trialId: `trial-${randomUUID().slice(0, 8)}`,
    task: { taskId: "r1-controlled-agentic-loop", suiteId: "klaude-r1-release", version: "1", fixtureId: "fake-provider-readonly-tool-v1", synthetic: true },
    harnessVersion: "0.1.0",
    commit: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 40) : "working-tree",
    modelProfile: "fake-provider",
    resourceConfig: { maxTurns: 3, timeoutMs: 30_000, concurrency: 1 },
  },
  assertions,
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAtMs,
  limitationCodes: [
    "single-controlled-trial",
    "deterministic-fake-provider",
    "no-real-network",
    "no-success-rate-inference",
    "no-cross-platform-sandbox-equivalence-claim",
  ],
});

const rootDir = process.env.EASY_AGENT_EVALUATION_ROOT
  ? path.resolve(process.env.EASY_AGENT_EVALUATION_ROOT)
  : await getEvaluationRoot(process.cwd());
await applyEvaluationRetentionPolicy(rootDir);
const paths = await writeEvaluationArtifacts(process.cwd(), result, { rootDir });
console.log(`R1 release evaluation outcome: ${result.outcome}`);
console.log(`R1 assertions: ${result.assertions.length}`);
console.log(`JSON: ${paths.resultPath}`);
console.log(`Markdown: ${paths.reportPath}`);
if (result.outcome !== "passed") process.exitCode = 1;
