import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  createSafeMessage,
  createTraceWriter,
  createTraceTimeline,
  formatTraceTimeline,
  inspectTraceFile,
  applyTraceRetentionPolicy,
  createQueryAbortedPayload,
  createQueryFailedPayload,
  createQueryFinishedPayload,
  createQueryStartedPayload,
  getTracePath,
  readTraceEvents,
  redactForTrace,
  summarizeToolInput,
  summarizeToolResult,
  type HarnessTraceEventType,
  type HarnessTraceEvent,
  type TraceSink,
} from "../observability/index.js";
import { query, runTools, type AgenticLoopEvent, type AgenticLoopResult } from "../core/agenticLoop.js";
import type { StreamEvent } from "../types/message.js";
import type { StreamRequestParams, StreamResult } from "../services/api/streaming.js";
import { configureSessionPersistence } from "../session/storage.js";
import { clearMcpTools, registerMcpTools } from "../tools/index.js";

const secret = "sk-test-very-secret";
const redacted = redactForTrace({
  apiKey: secret,
  authorization: "Bearer abcdef",
  nested: { password: "hunter2" },
  note: `failed with ${secret}`,
});
assert.equal(JSON.stringify(redacted).includes(secret), false);
assert.equal(JSON.stringify(redacted).includes("abcdef"), false);
assert.equal(JSON.stringify(redacted).includes("hunter2"), false);

for (const unsafeMessage of [
  "password=hunter2",
  "apiKey: abc123",
  "Authorization: Basic abc123",
  "Authorization=Basic abc123",
  'Authorization: Digest username="u", response="abc123"',
  'Authorization: OAuth oauth_token="tok123", oauth_signature="sig456"',
  "env=supersecret",
  '{"apiKey":"abc123","password":"hunter2","token":"ghp_secret"}',
  '{"Authorization":"Basic abc123"}',
  '{"password":"abc\\"def","token":"tok"}',
  '{\\"apiKey\\":\\"abc123\\",\\"password\\":\\"hunter2\\",\\"token\\":\\"ghp_secret\\"}',
  '{\\"Authorization\\":\\"Basic abc123\\"}',
  "private key: abc123",
]) {
  const safeMessage = createSafeMessage(unsafeMessage);
  assert.equal(safeMessage.includes("hunter2"), false);
  assert.equal(safeMessage.includes("abc123"), false);
  assert.equal(safeMessage.includes("ghp_secret"), false);
  assert.equal(safeMessage.includes("supersecret"), false);
}

const circularInput: Record<string, unknown> = { apiKey: secret, count: 1n };
circularInput.self = circularInput;
const circularRedacted = redactForTrace(circularInput);
const circularJson = JSON.stringify(circularRedacted);
assert.equal(circularJson.includes(secret), false);
assert.equal(circularJson.includes("[Circular]"), true);
assert.doesNotThrow(() => summarizeToolInput(circularInput));

const circularArray: unknown[] = [];
circularArray.push(circularArray);
assert.deepEqual(redactForTrace(circularArray), ["[Circular]"]);

const circularSummary = summarizeToolInput(circularInput);
assert.deepEqual(circularSummary.fieldNames, ["apiKey", "count", "self"]);
assert.equal(typeof circularSummary.serializedLength, "number");
assert.equal(circularSummary.contentOmitted, true);

const resultText = `tool output included ${secret}`;
const resultSummary = summarizeToolResult({ outcome: "success", text: resultText, truncated: true });
assert.equal(resultSummary.textLength, resultText.length);
assert.equal(resultSummary.contentOmitted, true);
assert.equal(resultSummary.truncated, true);
assert.equal("text" in resultSummary, false);
assert.equal(JSON.stringify(resultSummary).includes(secret), false);

const summary = summarizeToolInput({ command: "npm test", apiKey: secret, path: "src/x.ts" });
assert.deepEqual(summary.fieldNames, ["apiKey", "command", "path"]);
assert.equal(summary.contentOmitted, true);
assert.equal("command" in summary, false);

assert.equal(createSafeMessage(`Authorization: Bearer abcdef ${"x".repeat(1_000)}`).includes("abcdef"), false);
assert.ok(createSafeMessage("x".repeat(1_000)).length <= 500);

const startedPayload = createQueryStartedPayload({
  model: "claude-test",
  permissionMode: "default",
  messageCount: 3,
  promptLength: 42,
  hasUserPrompt: true,
});
assert.deepEqual(startedPayload, {
  model: "claude-test",
  permissionMode: "default",
  messageCount: 3,
  promptLength: 42,
  hasUserPrompt: true,
  contentOmitted: true,
});

const finishedPayload = createQueryFinishedPayload({
  reason: "end_turn",
  messageCount: 4,
  usage: {
    input_tokens: 11,
    output_tokens: 7,
    cache_creation_input_tokens: 5,
    cache_read_input_tokens: 3,
  },
});
assert.deepEqual(finishedPayload, {
  reason: "end_turn",
  messageCount: 4,
  inputTokens: 11,
  outputTokens: 7,
  cacheCreationInputTokens: 5,
  cacheReadInputTokens: 3,
});

const failedPayload = createQueryFailedPayload(new Error("password=hunter2 Authorization: Bearer abcdef"));
assert.equal(JSON.stringify(failedPayload).includes("hunter2"), false);
assert.equal(JSON.stringify(failedPayload).includes("abcdef"), false);
assert.equal(failedPayload.errorCategory, "Error");

const abortedPayload = createQueryAbortedPayload();
assert.deepEqual(abortedPayload, { reason: "abort_signal" });

interface CapturedTraceEvent {
  eventType: HarnessTraceEventType;
  payload: Record<string, unknown>;
  spanId?: string;
}

function createMemoryTraceSink(events: CapturedTraceEvent[]): TraceSink {
  return {
    emit(eventType, payload, options) {
      events.push({ eventType, payload, spanId: options?.spanId });
    },
    async close() {},
    getStatus() {
      return { state: "active", droppedEvents: 0 };
    },
  };
}

const successfulResult: StreamResult = {
  assistantMessage: { role: "assistant", content: [{ type: "text", text: "model-secret-body" }] },
  usage: { input_tokens: 8, output_tokens: 3 },
  stopReason: "end_turn",
};

async function runMockLoop(options: {
  traceSink?: TraceSink;
  streamMessageImpl: (params: StreamRequestParams) => AsyncGenerator<StreamEvent, StreamResult>;
}) {
  const providerRequests: Array<Record<string, unknown>> = [];
  const loop = query({
    messages: [{ role: "user", content: "prompt-secret-body" }],
    systemPrompt: "system-secret-body",
    model: "mock-model",
    toolContext: { cwd: os.tmpdir() },
    maxTurns: 1,
    traceSink: options.traceSink,
    streamMessageImpl: (params) => {
      providerRequests.push({
        messages: params.messages,
        system: params.system,
        model: params.model,
        maxTokens: params.maxTokens,
        querySource: params.querySource,
      });
      return options.streamMessageImpl(params);
    },
  });
  const events: AgenticLoopEvent[] = [];
  let result: AgenticLoopResult | undefined;
  while (true) {
    const next = await loop.next();
    if (next.done) {
      result = next.value;
      break;
    }
    events.push(next.value);
  }
  return { events, result: result!, providerRequests };
}

async function* successfulStream(): AsyncGenerator<StreamEvent, StreamResult> {
  yield { type: "text", text: "model-secret-body" };
  return successfulResult;
}

const pairedTraceEvents: CapturedTraceEvent[] = [];
const withoutTrace = await runMockLoop({ streamMessageImpl: successfulStream });
const withTrace = await runMockLoop({
  traceSink: createMemoryTraceSink(pairedTraceEvents),
  streamMessageImpl: successfulStream,
});
const withThrowingModelTrace = await runMockLoop({
  traceSink: {
    emit() { throw new Error("model trace sink failed"); },
    async close() {},
    getStatus() { return { state: "degraded", reason: "write_failed", droppedEvents: 1 }; },
  },
  streamMessageImpl: successfulStream,
});
assert.deepEqual(withTrace.providerRequests, withoutTrace.providerRequests);
assert.deepEqual(withTrace.events, withoutTrace.events);
assert.deepEqual(withTrace.result, withoutTrace.result);
assert.deepEqual(withThrowingModelTrace, withoutTrace);
assert.deepEqual(pairedTraceEvents.map((event) => event.eventType), ["model.requested", "model.completed"]);
assert.equal(pairedTraceEvents[0]?.spanId, pairedTraceEvents[1]?.spanId);
assert.equal(JSON.stringify(pairedTraceEvents).includes("prompt-secret-body"), false);
assert.equal(JSON.stringify(pairedTraceEvents).includes("system-secret-body"), false);
assert.equal(JSON.stringify(pairedTraceEvents).includes("model-secret-body"), false);

const retryTraceEvents: CapturedTraceEvent[] = [];
async function* retryThenSuccess(): AsyncGenerator<StreamEvent, StreamResult> {
  yield {
    type: "retry",
    attempt: 1,
    maxRetries: 3,
    delayMs: 25,
    errorMessage: "Authorization: Bearer fake-token",
    category: "rate_limit",
  };
  return successfulResult;
}
const retried = await runMockLoop({
  traceSink: createMemoryTraceSink(retryTraceEvents),
  streamMessageImpl: retryThenSuccess,
});
assert.deepEqual(retryTraceEvents.map((event) => event.eventType), [
  "model.requested",
  "retry.scheduled",
  "model.completed",
]);
assert.deepEqual(retryTraceEvents[1]?.payload, {
  turnId: 1,
  attempt: 1,
  nextAttempt: 2,
  maxRetries: 3,
  delayMs: 25,
  errorCategory: "rate_limit",
});
assert.equal(JSON.stringify(retryTraceEvents).includes("fake-token"), false);
assert.equal(retried.events.filter((event) => event.type === "api_retry").length, 1);

const restartTraceEvents: CapturedTraceEvent[] = [];
let restartCall = 0;
async function* maxTokensThenSuccess(): AsyncGenerator<StreamEvent, StreamResult> {
  restartCall++;
  if (restartCall === 1) {
    return { ...successfulResult, stopReason: "max_tokens" };
  }
  return successfulResult;
}
const restarted = await runMockLoop({
  traceSink: createMemoryTraceSink(restartTraceEvents),
  streamMessageImpl: maxTokensThenSuccess,
});
assert.deepEqual(restartTraceEvents.map((event) => event.eventType), [
  "model.requested",
  "model.completed",
  "stream.restarted",
  "model.requested",
  "model.completed",
]);
assert.notEqual(restartTraceEvents[0]?.spanId, restartTraceEvents[3]?.spanId);
assert.equal(restartTraceEvents[2]?.payload.reason, "max_tokens_escalation");
assert.equal(restarted.events.filter((event) => event.type === "stream_restart").length, 1);

const failedTraceEvents: CapturedTraceEvent[] = [];
async function* partialOutputThenFailure(): AsyncGenerator<StreamEvent, StreamResult> {
  yield { type: "text", text: "partial-secret-body" };
  yield {
    type: "error",
    error: new Error("Authorization: Bearer fake-token"),
    category: "auth_error",
  };
  return successfulResult;
}
const failed = await runMockLoop({
  traceSink: createMemoryTraceSink(failedTraceEvents),
  streamMessageImpl: partialOutputThenFailure,
});
assert.deepEqual(failedTraceEvents.map((event) => event.eventType), ["model.requested", "model.failed"]);
assert.equal(failedTraceEvents.some((event) => event.eventType === "retry.scheduled"), false);
assert.equal(failedTraceEvents.some((event) => event.eventType === "model.completed"), false);
assert.equal(failed.result.reason, "model_error");
assert.equal(JSON.stringify(failedTraceEvents).includes("fake-token"), false);
assert.equal(JSON.stringify(failedTraceEvents).includes("partial-secret-body"), false);

const abortedTraceEvents: CapturedTraceEvent[] = [];
async function* abortedStream(): AsyncGenerator<StreamEvent, StreamResult> {
  yield {
    type: "error",
    error: new Error("request aborted with password=hunter2"),
    category: "aborted",
  };
  return successfulResult;
}
await runMockLoop({
  traceSink: createMemoryTraceSink(abortedTraceEvents),
  streamMessageImpl: abortedStream,
});
assert.deepEqual(abortedTraceEvents.map((event) => event.eventType), ["model.requested", "model.failed"]);
assert.equal(abortedTraceEvents[1]?.payload.outcome, "aborted");
assert.equal(JSON.stringify(abortedTraceEvents).includes("hunter2"), false);

let successfulToolCalls = 0;
let deniedToolCalls = 0;
const probeTools = [
  {
    name: "TraceProbeSuccess",
    description: "trace success probe",
    inputSchema: { type: "object" as const, properties: {}, additionalProperties: true },
    async call() {
      successfulToolCalls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { content: "tool-result-secret" };
    },
    isReadOnly: () => true,
    isEnabled: () => true,
    isConcurrencySafe: () => true,
  },
  {
    name: "TraceProbeFailure",
    description: "trace failure probe",
    inputSchema: { type: "object" as const, properties: {}, additionalProperties: true },
    async call() {
      return { content: "failed with password=hunter2", isError: true };
    },
    isReadOnly: () => true,
    isEnabled: () => true,
    isConcurrencySafe: () => true,
  },
  {
    name: "TraceProbeAsk",
    description: "trace permission probe",
    inputSchema: { type: "object" as const, properties: {}, additionalProperties: true },
    async call() {
      deniedToolCalls++;
      return { content: "must-not-run" };
    },
    isReadOnly: () => false,
    isEnabled: () => true,
    isConcurrencySafe: () => false,
  },
];

registerMcpTools(probeTools);
try {
  const successBlock = [{
    type: "tool_use" as const,
    id: "tool-success",
    name: "TraceProbeSuccess",
    input: { command: "secret-command", token: "fake-token" },
  }];
  const withoutToolTrace = await runTools(successBlock, { cwd: os.tmpdir() });
  const successToolTrace: CapturedTraceEvent[] = [];
  const withToolTrace = await runTools(successBlock, { cwd: os.tmpdir() }, {
    traceSink: createMemoryTraceSink(successToolTrace),
  });
  assert.deepEqual(withToolTrace, withoutToolTrace);
  assert.deepEqual(successToolTrace.map((event) => event.eventType), [
    "permission.resolved",
    "tool.started",
    "tool.completed",
  ]);
  assert.equal(new Set(successToolTrace.map((event) => event.spanId)).size, 1);
  assert.equal(JSON.stringify(successToolTrace).includes("secret-command"), false);
  assert.equal(JSON.stringify(successToolTrace).includes("fake-token"), false);
  assert.equal(JSON.stringify(successToolTrace).includes("tool-result-secret"), false);

  const failureToolTrace: CapturedTraceEvent[] = [];
  await runTools([{
    type: "tool_use",
    id: "tool-failure",
    name: "TraceProbeFailure",
    input: { password: "hunter2" },
  }], { cwd: os.tmpdir() }, { traceSink: createMemoryTraceSink(failureToolTrace) });
  assert.deepEqual(failureToolTrace.map((event) => event.eventType), [
    "permission.resolved",
    "tool.started",
    "tool.failed",
  ]);
  assert.equal(failureToolTrace.some((event) => event.eventType === "tool.completed"), false);
  assert.equal(JSON.stringify(failureToolTrace).includes("hunter2"), false);

  const deniedToolTrace: CapturedTraceEvent[] = [];
  await runTools([{
    type: "tool_use",
    id: "tool-denied",
    name: "TraceProbeAsk",
    input: { path: "private-file", apiKey: "fake-token" },
  }], { cwd: os.tmpdir() }, {
    traceSink: createMemoryTraceSink(deniedToolTrace),
    onPermissionRequest: async () => "deny",
  });
  assert.equal(deniedToolCalls, 0);
  assert.deepEqual(deniedToolTrace.map((event) => event.eventType), [
    "permission.requested",
    "permission.resolved",
  ]);
  assert.equal(deniedToolTrace[1]?.payload.source, "user");
  assert.equal(deniedToolTrace[1]?.payload.decision, "deny");
  assert.equal(JSON.stringify(deniedToolTrace).includes("private-file"), false);
  assert.equal(JSON.stringify(deniedToolTrace).includes("fake-token"), false);

  const concurrentToolTrace: CapturedTraceEvent[] = [];
  await runTools([
    { type: "tool_use", id: "parallel-a", name: "TraceProbeSuccess", input: {} },
    { type: "tool_use", id: "parallel-b", name: "TraceProbeSuccess", input: {} },
  ], { cwd: os.tmpdir() }, { traceSink: createMemoryTraceSink(concurrentToolTrace) });
  const parallelA = concurrentToolTrace.filter((event) => event.payload.toolUseId === "parallel-a");
  const parallelB = concurrentToolTrace.filter((event) => event.payload.toolUseId === "parallel-b");
  assert.equal(new Set(parallelA.map((event) => event.spanId)).size, 1);
  assert.equal(new Set(parallelB.map((event) => event.spanId)).size, 1);
  assert.notEqual(parallelA[0]?.spanId, parallelB[0]?.spanId);
  assert.deepEqual(parallelA.map((event) => event.eventType), [
    "permission.resolved", "tool.started", "tool.completed",
  ]);
  assert.deepEqual(parallelB.map((event) => event.eventType), [
    "permission.resolved", "tool.started", "tool.completed",
  ]);

  const throwingTraceSink: TraceSink = {
    emit() { throw new Error("trace sink failed"); },
    async close() {},
    getStatus() { return { state: "degraded", reason: "write_failed", droppedEvents: 1 }; },
  };
  const withThrowingTrace = await runTools(successBlock, { cwd: os.tmpdir() }, { traceSink: throwingTraceSink });
  assert.deepEqual(withThrowingTrace, withoutToolTrace);
} finally {
  clearMcpTools();
}

assert.ok(successfulToolCalls >= 5);

const inspectorFixture: HarnessTraceEvent[] = [
  {
    schemaVersion: 1,
    eventId: "event-2",
    traceId: "inspector-trace",
    sequence: 2,
    timestamp: new Date(0).toISOString(),
    eventType: "tool.completed",
    spanId: "span-tool",
    payload: { toolName: "Read", toolUseId: "tool-1", outcome: "success", content: "file-secret" },
  },
  {
    schemaVersion: 1,
    eventId: "event-1",
    traceId: "inspector-trace",
    sequence: 1,
    timestamp: new Date(0).toISOString(),
    eventType: "permission.resolved",
    spanId: "span-tool",
    payload: { toolName: "Read", toolUseId: "tool-1", decision: "allow", source: "permission_engine", command: "secret-command" },
  },
];
const inspectorTimeline = createTraceTimeline(inspectorFixture);
assert.deepEqual(inspectorTimeline.map((entry) => entry.sequence), [1, 2]);
const inspectorOutput = formatTraceTimeline(inspectorTimeline);
assert.equal(inspectorOutput.includes("permission.resolved"), true);
assert.equal(inspectorOutput.includes("tool.completed"), true);
assert.equal(inspectorOutput.includes("file-secret"), false);
assert.equal(inspectorOutput.includes("secret-command"), false);

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "easy-agent-trace-test-"));
const traceCwd = path.join(storageRoot, "project");
await fs.mkdir(traceCwd, { recursive: true });
const traceId = "trace-test";

configureSessionPersistence(true);
const tracePath = await getTracePath(traceCwd, traceId);
await fs.rm(tracePath, { force: true });
const traversalPath = await getTracePath(traceCwd, "../escape");
assert.equal(path.dirname(traversalPath), path.dirname(tracePath));
const writer = await createTraceWriter(traceCwd, traceId);
writer.emit("query.started", { model: "test-model" });
writer.emit("query.finished", { outcome: "success" });
await writer.close();
assert.equal((await fs.readFile(tracePath, "utf8")).trim().split("\n").length, 2);
const events = await readTraceEvents(tracePath);
assert.deepEqual(events.map((event) => event.eventType), ["query.started", "query.finished"]);

for (const terminalEvent of ["query.failed", "query.aborted"] as const) {
  const terminalTraceId = `trace-${terminalEvent.replace(".", "-")}`;
  const terminalWriter = await createTraceWriter(traceCwd, terminalTraceId);
  terminalWriter.emit("query.started", { content: "password=hunter2" });
  terminalWriter.emit(terminalEvent, { reason: terminalEvent });
  await terminalWriter.close();
  const terminalEvents = await readTraceEvents(await getTracePath(traceCwd, terminalTraceId));
  assert.deepEqual(terminalEvents.map((event) => event.eventType), ["query.started", terminalEvent]);
  assert.equal(JSON.stringify(terminalEvents).includes("hunter2"), false);
}

await fs.appendFile(tracePath, '{"schemaVersion":1,"eventType":"truncated"\n', "utf8");
assert.equal((await readTraceEvents(tracePath)).length, 2);

await fs.appendFile(
  tracePath,
  `${JSON.stringify({
    schemaVersion: 1,
    eventId: "unknown-event",
    traceId,
    sequence: 99,
    timestamp: new Date().toISOString(),
    eventType: "future.unknown",
    payload: { outcome: "unknown", content: "inspector-secret-body" },
  })}\n`,
  "utf8",
);
const fileTimeline = await inspectTraceFile(tracePath);
assert.equal(fileTimeline.some((entry) => entry.eventType === "future.unknown"), true);
assert.equal(formatTraceTimeline(fileTimeline).includes("inspector-secret-body"), false);
await fs.appendFile(
  tracePath,
  `${JSON.stringify({
    schemaVersion: 2,
    eventId: "future-event",
    traceId,
    sequence: 3,
    timestamp: new Date().toISOString(),
    eventType: "query.finished",
    payload: {},
  })}\n`,
  "utf8",
);
assert.equal((await readTraceEvents(tracePath)).length, 3);

configureSessionPersistence(false);
const independentTraceId = "trace-session-independent";
const independentWriter = await createTraceWriter(traceCwd, independentTraceId);
independentWriter.emit("query.started", {});
await independentWriter.close();
await assert.doesNotReject(fs.access(await getTracePath(traceCwd, independentTraceId)));
assert.equal(independentWriter.getStatus().state, "active");
configureSessionPersistence(true);

const disabledTraceId = "trace-explicitly-disabled";
const disabledWriter = await createTraceWriter(traceCwd, disabledTraceId, { enabled: false });
disabledWriter.emit("query.started", {});
await disabledWriter.close();
assert.deepEqual(disabledWriter.getStatus(), {
  state: "disabled",
  reason: "explicitly_disabled",
  droppedEvents: 0,
});
await assert.rejects(fs.access(await getTracePath(traceCwd, disabledTraceId)));

const hangingWriter = await createTraceWriter(traceCwd, "trace-close-timeout", {
  closeTimeoutMs: 20,
  appendFile: async () => new Promise<void>(() => {}),
});
hangingWriter.emit("query.started", {});
const closeStartedAt = Date.now();
await hangingWriter.close();
assert.ok(Date.now() - closeStartedAt < 250);
assert.deepEqual(hangingWriter.getStatus(), {
  state: "degraded",
  reason: "close_timeout",
  droppedEvents: 1,
});

const writeFailureWriter = await createTraceWriter(traceCwd, "trace-write-failure", {
  appendFile: async () => {
    throw new Error("password=hunter2");
  },
});
writeFailureWriter.emit("query.started", {});
await writeFailureWriter.close();
assert.deepEqual(writeFailureWriter.getStatus(), {
  state: "degraded",
  reason: "write_failed",
  droppedEvents: 1,
});
assert.equal(JSON.stringify(writeFailureWriter.getStatus()).includes("hunter2"), false);

const failingCwd = path.join(storageRoot, "failing-project");
const failingWriter = await createTraceWriter(failingCwd, "trace-failure");
const failingTracePath = await getTracePath(failingCwd, "trace-failure");
await fs.rm(path.dirname(failingTracePath), { recursive: true, force: true });
assert.doesNotThrow(() => failingWriter.emit("query.started", { apiKey: "secret" }));
await assert.doesNotReject(() => failingWriter.close());

const retentionCwd = path.join(storageRoot, "retention-project");
const retainedTracePath = await getTracePath(retentionCwd, "retained");
const traceDir = path.dirname(retainedTracePath);
await fs.mkdir(traceDir, { recursive: true });
const oldPath = path.join(traceDir, "old.jsonl");
const quotaOldestPath = path.join(traceDir, "quota-oldest.jsonl");
const newestPath = path.join(traceDir, "newest.jsonl");
const outsidePath = path.join(path.dirname(traceDir), "outside.jsonl");
await fs.writeFile(oldPath, "old");
await fs.writeFile(quotaOldestPath, "a".repeat(20));
await fs.writeFile(newestPath, "b".repeat(20));
await fs.writeFile(outsidePath, "outside");
const nowMs = Date.now();
await fs.utimes(oldPath, new Date(nowMs - 20 * 24 * 60 * 60 * 1000), new Date(nowMs - 20 * 24 * 60 * 60 * 1000));
await fs.utimes(quotaOldestPath, new Date(nowMs - 2_000), new Date(nowMs - 2_000));
await fs.utimes(newestPath, new Date(nowMs - 1_000), new Date(nowMs - 1_000));
const retention = await applyTraceRetentionPolicy(retentionCwd, {
  maxAgeDays: 10,
  maxBytes: 25,
  nowMs,
});
assert.equal(retention.deletedByAge, 1);
assert.equal(retention.deletedByQuota, 1);
assert.equal(retention.failures, 0);
await assert.rejects(fs.access(oldPath));
await assert.rejects(fs.access(quotaOldestPath));
await assert.doesNotReject(fs.access(newestPath));
await assert.doesNotReject(fs.access(outsidePath));

const unsafeCwd = path.join(storageRoot, "unsafe-retention-project");
const unsafeTracePath = await getTracePath(unsafeCwd, "unsafe");
const unsafeTraceDir = path.dirname(unsafeTracePath);
const externalTraceDir = path.join(storageRoot, "external-traces");
await fs.mkdir(path.dirname(unsafeTraceDir), { recursive: true });
await fs.mkdir(externalTraceDir, { recursive: true });
await fs.writeFile(path.join(externalTraceDir, "must-survive.jsonl"), "external");
try {
  await fs.symlink(externalTraceDir, unsafeTraceDir, process.platform === "win32" ? "junction" : "dir");
  const unsafeRetention = await applyTraceRetentionPolicy(unsafeCwd, { maxAgeDays: 0, maxBytes: 0 });
  assert.equal(unsafeRetention.skippedUnsafeRoot, true);
  await assert.doesNotReject(fs.access(path.join(externalTraceDir, "must-survive.jsonl")));
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code !== "EPERM" && code !== "EACCES") throw error;
}

await fs.rm(storageRoot, { recursive: true, force: true });
console.log("trace DTO/redaction/storage/retention tests passed");
