#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { APIConnectionError } from "@anthropic-ai/sdk";
import {
  DEFAULT_MODEL_TIMEOUT_MS,
  RequestTimeoutError,
  createRequestLifecycle,
  getModelTimeoutMs,
} from "../services/api/requestLifecycle.js";
import { classifyAPIError } from "../services/api/errors.js";
import { callWithRetry } from "../services/api/withRetry.js";
import {
  streamMessage,
  type StreamRequestParams,
  type StreamResult,
} from "../services/api/streaming.js";
import type { StreamEvent } from "../types/message.js";
import { compactMessages } from "../context/compaction.js";
import {
  query,
  runTools,
  type AgenticLoopEvent,
  type AgenticLoopResult,
  type QueryParams,
} from "../core/agenticLoop.js";
import { clearMcpTools, registerMcpTools } from "../tools/index.js";
import {
  createQueryFailedPayload,
  getQueryTerminalEventType,
} from "../observability/queryLifecycle.js";

async function drainQuery(params: QueryParams): Promise<{
  events: AgenticLoopEvent[];
  result: AgenticLoopResult;
}> {
  const generator = query(params);
  const events: AgenticLoopEvent[] = [];
  while (true) {
    const next = await generator.next();
    if (next.done) return { events, result: next.value };
    events.push(next.value);
  }
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
}

async function main(): Promise<void> {
  const parent = new AbortController();
  const linked = createRequestLifecycle({ parentSignal: parent.signal, timeoutMs: 50 });
  parent.abort();
  assert.equal(linked.signal.aborted, true);
  assert.equal(linked.getCause(), "user_abort");
  const abortError = linked.normalizeError(new Error("provider secret should be omitted"));
  assert(abortError instanceof Error);
  assert.equal(abortError.name, "AbortError");
  assert.equal(abortError.message.includes("secret"), false);
  linked.dispose();

  const timed = createRequestLifecycle({ timeoutMs: 5 });
  await waitForAbort(timed.signal);
  assert.equal(timed.getCause(), "timeout");
  const timeoutError = timed.normalizeError(new Error("provider secret should be omitted"));
  assert(timeoutError instanceof RequestTimeoutError);
  assert.equal(classifyAPIError(timeoutError), "api_timeout");
  assert.equal(timeoutError.message.includes("secret"), false);
  timed.dispose();

  const disposed = createRequestLifecycle({ timeoutMs: 5 });
  disposed.dispose();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(disposed.signal.aborted, false);
  assert.equal(disposed.getCause(), "none");

  const previous = process.env.EASY_AGENT_MODEL_TIMEOUT_MS;
  process.env.EASY_AGENT_MODEL_TIMEOUT_MS = "25";
  assert.equal(getModelTimeoutMs(), 25);
  process.env.EASY_AGENT_MODEL_TIMEOUT_MS = "invalid";
  assert.equal(getModelTimeoutMs(), DEFAULT_MODEL_TIMEOUT_MS);
  if (previous === undefined) delete process.env.EASY_AGENT_MODEL_TIMEOUT_MS;
  else process.env.EASY_AGENT_MODEL_TIMEOUT_MS = previous;

  let attemptSignal: AbortSignal | undefined;
  const callResult = await callWithRetry(
    async (_attempt, signal) => {
      attemptSignal = signal;
      return "ok";
    },
    { timeoutMs: 50 },
  );
  assert.equal(callResult, "ok");
  assert(attemptSignal);
  assert.equal(attemptSignal.aborted, false);

  const emptyResult: StreamResult = {
    assistantMessage: { role: "assistant", content: [] },
    usage: { input_tokens: 0, output_tokens: 0 },
    stopReason: "error",
  };
  const params = (
    streamAttemptImpl: (request: StreamRequestParams) => AsyncGenerator<StreamEvent, StreamResult>,
    extra: Partial<StreamRequestParams> = {},
  ): StreamRequestParams => ({
    messages: [{ role: "user", content: "synthetic" }],
    streamAttemptImpl,
    ...extra,
  });

  let partialAttempts = 0;
  async function* partialThenFail(): AsyncGenerator<StreamEvent, StreamResult> {
    partialAttempts++;
    yield { type: "text", text: "partial" };
    throw new Error("stream broke");
  }
  const partialEvents: StreamEvent[] = [];
  const partialStream = streamMessage(params(partialThenFail));
  while (true) {
    const next = await partialStream.next();
    if (next.done) break;
    partialEvents.push(next.value);
  }
  const partialError = partialEvents.find((event) => event.type === "error");
  assert.equal(partialAttempts, 1);
  assert(partialError?.type === "error");
  assert.equal(partialError.outputStarted, true);
  assert.equal(partialEvents.some((event) => event.type === "retry"), false);

  const backoffAbort = new AbortController();
  let backoffAttempts = 0;
  async function* failBeforeOutput(): AsyncGenerator<StreamEvent, StreamResult> {
    backoffAttempts++;
    throw new APIConnectionError({ message: "synthetic connection failure" });
  }
  const backoffStream = streamMessage(params(failBeforeOutput, { signal: backoffAbort.signal }));
  const retryEvent = await backoffStream.next();
  assert.equal(retryEvent.done, false);
  assert.equal(retryEvent.value?.type, "retry");
  backoffAbort.abort();
  const backoffAbortEvent = await backoffStream.next();
  assert.equal(backoffAbortEvent.done, false);
  assert.equal(backoffAbortEvent.value?.type, "error");
  if (!backoffAbortEvent.done && backoffAbortEvent.value.type === "error") {
    assert.equal(backoffAbortEvent.value.category, "aborted");
  }
  assert.equal(backoffAttempts, 1);

  const preAborted = new AbortController();
  preAborted.abort();
  let preAbortedAttempts = 0;
  async function* shouldNotStart(): AsyncGenerator<StreamEvent, StreamResult> {
    preAbortedAttempts++;
    return emptyResult;
  }
  const abortedStream = streamMessage(params(shouldNotStart, { signal: preAborted.signal }));
  const abortedFirst = await abortedStream.next();
  assert.equal(preAbortedAttempts, 0);
  assert.equal(abortedFirst.done, false);
  assert.equal(abortedFirst.value?.type, "error");
  if (!abortedFirst.done && abortedFirst.value.type === "error") {
    assert.equal(abortedFirst.value.category, "aborted");
    assert.equal(abortedFirst.value.outputStarted, false);
  }

  const oldMaxRetries = process.env.EASY_AGENT_MAX_RETRIES;
  process.env.EASY_AGENT_MAX_RETRIES = "0";
  async function* waitUntilTimedOut(
    request: StreamRequestParams,
  ): AsyncGenerator<StreamEvent, StreamResult> {
    await waitForAbort(request.signal!);
    throw new Error("provider timeout body secret");
  }
  const timeoutStream = streamMessage(params(waitUntilTimedOut, { timeoutMs: 5 }));
  const timeoutFirst = await timeoutStream.next();
  assert.equal(timeoutFirst.done, false);
  assert.equal(timeoutFirst.value?.type, "error");
  if (!timeoutFirst.done && timeoutFirst.value.type === "error") {
    assert.equal(timeoutFirst.value.category, "api_timeout");
    assert.equal(timeoutFirst.value.outputStarted, false);
    assert.equal(timeoutFirst.value.error.message.includes("secret"), false);
  }
  if (oldMaxRetries === undefined) delete process.env.EASY_AGENT_MAX_RETRIES;
  else process.env.EASY_AGENT_MAX_RETRIES = oldMaxRetries;

  const compactAbort = new AbortController();
  compactAbort.abort();
  let summaryCalls = 0;
  await assert.rejects(
    compactMessages(
      [{ role: "user", content: "synthetic history" }],
      undefined,
      {
        force: true,
        signal: compactAbort.signal,
        createMessageImpl: async () => {
          summaryCalls++;
          return {
            content: [{ type: "text", text: "summary" }],
            usage: { input_tokens: 1, output_tokens: 1 },
            stopReason: "end_turn",
          };
        },
      },
    ),
    (error: unknown) => classifyAPIError(error) === "aborted",
  );
  assert.equal(summaryCalls, 0);

  const queryBase = {
    messages: [{ role: "user" as const, content: "synthetic query" }],
    model: "synthetic-model",
    toolContext: { cwd: process.cwd() },
    maxTurns: 1,
  };

  let partialCompactCalls = 0;
  async function* partialPromptTooLong(): AsyncGenerator<StreamEvent, StreamResult> {
    yield { type: "text", text: "partial" };
    yield {
      type: "error",
      error: new Error("prompt too long"),
      category: "prompt_too_long",
      outputStarted: true,
    };
    return emptyResult;
  }
  const partialRecovery = await drainQuery({
    ...queryBase,
    streamMessageImpl: partialPromptTooLong,
    compactMessagesImpl: async (messages) => {
      partialCompactCalls++;
      return { messages, didCompact: true, didMicroCompact: false };
    },
  });
  assert.equal(partialCompactCalls, 0);
  assert.equal(partialRecovery.result.reason, "model_error");
  assert.equal(partialRecovery.events.some((event) => event.type === "stream_restart"), false);

  let overflowStreamCalls = 0;
  let overflowCompactCalls = 0;
  async function* repeatedPromptTooLong(): AsyncGenerator<StreamEvent, StreamResult> {
    overflowStreamCalls++;
    yield {
      type: "error",
      error: new Error("prompt too long"),
      category: "prompt_too_long",
      outputStarted: false,
    };
    return emptyResult;
  }
  const boundedRecovery = await drainQuery({
    ...queryBase,
    streamMessageImpl: repeatedPromptTooLong,
    compactMessagesImpl: async () => {
      overflowCompactCalls++;
      return {
        messages: [{ role: "user", content: "compacted" }],
        didCompact: true,
        didMicroCompact: false,
      };
    },
  });
  assert.equal(overflowCompactCalls, 1);
  assert.equal(overflowStreamCalls, 2);
  assert.equal(boundedRecovery.result.reason, "model_error");
  assert.equal(
    boundedRecovery.events.filter((event) => event.type === "stream_restart").length,
    1,
  );

  const compactingAbort = new AbortController();
  let abortStreamCalls = 0;
  async function* overflowBeforeAbort(): AsyncGenerator<StreamEvent, StreamResult> {
    abortStreamCalls++;
    yield {
      type: "error",
      error: new Error("prompt too long"),
      category: "prompt_too_long",
      outputStarted: false,
    };
    return emptyResult;
  }
  const abortedRecovery = await drainQuery({
    ...queryBase,
    abortSignal: compactingAbort.signal,
    streamMessageImpl: overflowBeforeAbort,
    compactMessagesImpl: async () => {
      compactingAbort.abort();
      return {
        messages: [{ role: "user", content: "late compact" }],
        didCompact: true,
        didMicroCompact: false,
      };
    },
  });
  assert.equal(abortStreamCalls, 1);
  assert.equal(abortedRecovery.result.reason, "aborted");
  assert.equal(abortedRecovery.events.some((event) => event.type === "stream_restart"), false);

  let maxTokenCalls = 0;
  let prematureToolCalls = 0;
  registerMcpTools([{
    name: "MaxTokenProbe",
    description: "must not execute from a discarded max-token attempt",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async call() {
      prematureToolCalls++;
      return { content: "unexpected" };
    },
    isReadOnly: () => true,
    isEnabled: () => true,
    isConcurrencySafe: () => false,
  }]);
  async function* maxTokenToolThenSuccess(): AsyncGenerator<StreamEvent, StreamResult> {
    maxTokenCalls++;
    if (maxTokenCalls === 1) {
      return {
        assistantMessage: {
          role: "assistant",
          content: [{ type: "tool_use", id: "discarded-tool", name: "MaxTokenProbe", input: {} }],
        },
        usage: { input_tokens: 1, output_tokens: 1 },
        stopReason: "max_tokens",
      };
    }
    return {
      assistantMessage: { role: "assistant", content: [{ type: "text", text: "done" }] },
      usage: { input_tokens: 1, output_tokens: 1 },
      stopReason: "end_turn",
    };
  }
  try {
    const maxTokenRestart = await drainQuery({
      ...queryBase,
      streamMessageImpl: maxTokenToolThenSuccess,
    });
    assert.equal(maxTokenRestart.result.reason, "completed");
    assert.equal(maxTokenCalls, 2);
    assert.equal(prematureToolCalls, 0);
    assert.equal(
      maxTokenRestart.events.filter((event) => event.type === "stream_restart").length,
      1,
    );
  } finally {
    clearMcpTools();
  }

  let continuationCalls = 0;
  async function* maxTokenContinuation(): AsyncGenerator<StreamEvent, StreamResult> {
    continuationCalls++;
    if (continuationCalls <= 2) {
      return {
        assistantMessage: {
          role: "assistant",
          content: [{ type: "text", text: continuationCalls === 1 ? "discarded" : "truncated" }],
        },
        usage: { input_tokens: 1, output_tokens: 1 },
        stopReason: "max_tokens",
      };
    }
    return {
      assistantMessage: { role: "assistant", content: [{ type: "text", text: "continued" }] },
      usage: { input_tokens: 1, output_tokens: 1 },
      stopReason: "end_turn",
    };
  }
  const continuation = await drainQuery({
    ...queryBase,
    maxTurns: 3,
    streamMessageImpl: maxTokenContinuation,
  });
  const committedAssistantText: string[] = [];
  for (const event of continuation.events) {
    if (event.type !== "assistant_message") continue;
    if (typeof event.message.content === "string") {
      committedAssistantText.push(event.message.content);
      continue;
    }
    for (const block of event.message.content) {
      if (block.type === "text") committedAssistantText.push(block.text);
    }
  }
  assert.deepEqual(committedAssistantText, ["truncated", "continued"]);

  const permissionAbort = new AbortController();
  let toolCalls = 0;
  registerMcpTools([{
    name: "RecoveryAbortProbe",
    description: "synthetic abort probe",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async call() {
      toolCalls++;
      return { content: "must not run" };
    },
    isReadOnly: () => false,
    isEnabled: () => true,
    isConcurrencySafe: () => false,
  }]);
  try {
    await runTools(
      [{ type: "tool_use", id: "abort-probe", name: "RecoveryAbortProbe", input: {} }],
      { cwd: process.cwd(), abortSignal: permissionAbort.signal },
      {
        onPermissionRequest: async () => {
          permissionAbort.abort();
          return "allow_once";
        },
      },
    );
  } finally {
    clearMcpTools();
  }
  assert.equal(toolCalls, 0);

  async function* timedOutModel(): AsyncGenerator<StreamEvent, StreamResult> {
    yield {
      type: "error",
      error: new RequestTimeoutError(),
      category: "api_timeout",
      outputStarted: false,
    };
    return emptyResult;
  }
  const timedOutQuery = await drainQuery({
    ...queryBase,
    streamMessageImpl: timedOutModel,
  });
  assert.equal(timedOutQuery.result.reason, "timeout");
  assert.equal(
    timedOutQuery.events.some(
      (event) => event.type === "turn_complete" && event.reason === "timeout",
    ),
    true,
  );

  assert.equal(getQueryTerminalEventType("completed"), "query.finished");
  assert.equal(getQueryTerminalEventType("blocking_limit"), "query.finished");
  assert.equal(getQueryTerminalEventType("max_turns"), "query.finished");
  assert.equal(getQueryTerminalEventType("aborted"), "query.aborted");
  assert.equal(getQueryTerminalEventType("timeout"), "query.failed");
  assert.equal(getQueryTerminalEventType("model_error"), "query.failed");
  const safeTimeoutPayload = createQueryFailedPayload(
    new Error("provider-secret"),
    { reason: "timeout", errorCategory: "api_timeout" },
  );
  assert.equal(safeTimeoutPayload.reason, "timeout");
  assert.equal(safeTimeoutPayload.errorCategory, "api_timeout");
  assert.equal(JSON.stringify(safeTimeoutPayload).includes("provider-secret"), false);

  process.stdout.write("request/recovery lifecycle tests passed\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
