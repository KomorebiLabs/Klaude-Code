# Local Structured Harness Trace MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, privacy-preserving, best-effort JSONL trace for each top-level Easy-Agent task, creating a reliable foundation for debugging and deterministic regression evaluation without changing agent behavior.

**Architecture:** `QueryEngine` owns each top-level task trace lifecycle. `agenticLoop.query()` emits model/retry/termination facts and the single-tool execution boundary emits tool/permission facts through an optional `TraceSink`; a focused `src/observability/` package owns the versioned DTOs, safe summaries/redaction, per-trace sequence ordering, JSONL persistence, and tolerant parsing. Trace is enabled by default only while existing session persistence is enabled; its writer is strictly best-effort and cannot alter the agent’s model/tool/permission outcome.

**Tech Stack:** TypeScript 6, Node.js `fs/promises`, existing `tsx` smoke/characterization scripts, existing session persistence (`src/session/storage.ts`), Anthropic SDK message types.

## Global Constraints

- Work only on branch/worktree `enterprise-harness-upgrade`; do not touch the original dirty `main` checkout.
- `origin` push URL is intentionally `DISABLED_NO_PUSH_TO_UPSTREAM`; do not bypass it, push, or create a PR.
- Default trace persistence is enabled **only when** `isSessionPersistenceEnabled()` is true; when `cleanupPeriodDays: 0` disables session persistence, trace must not create files.
- P0 must not change model prompts, model request semantics, tool inputs/results, permission outcomes, session transcript schema, or UI event semantics.
- Trace files must be local JSONL, one top-level query per file, append-only, UTF-8, and readable despite a malformed/truncated line.
- Every event must contain `schemaVersion: 1`, `traceId`, `eventId`, monotonic `sequence`, ISO UTC `timestamp`, `eventType`, and a safe payload.
- P0 must never persist API keys, authorization headers, cookies, passwords, private keys, environment-variable values, complete prompts, system prompts, complete commands, file content, full tool inputs/outputs, stdout/stderr, or model text.
- Trace I/O, serialization, directory creation, redaction, and flush failures must be caught and must not change the caller-visible Agent result. Never recursively trace trace-writer failures.
- P0 implements the foreground/top-level trace only. Parent-child subagent traces, cloud telemetry, dashboards, databases, replay, and full-content capture are explicit non-goals.
- Use the source documents as normative design inputs: `docs/engineering/adr/ADR-001-local-structured-harness-trace.md`, `docs/engineering/specs/harness-trace-event-contract.md`, `docs/engineering/specs/harness-trace-storage-and-privacy.md`, and `docs/engineering/evaluation/trace-mvp-acceptance-plan.md`.
- Before modifying existing symbols, record the direct-call-site blast radius in the task notes and reattempt GitNexus impact analysis when available; prior index/toolchain failures must not be hidden.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/observability/types.ts` | Versioned event DTOs, event type union, safe summary DTOs, trace context/sink interfaces. No filesystem access. |
| `src/observability/redaction.ts` | Allowlisted conversion of runtime values to summaries; recursive last-line redaction; strict size limits; no I/O. |
| `src/observability/traceWriter.ts` | Creates one per-task JSONL writer, assigns sequence/event IDs, writes safe events best-effort, disables itself after the first internal failure. |
| `src/observability/traceReader.ts` | Test/diagnostic JSONL reader; skips malformed/unknown lines without crashing. |
| `src/observability/index.ts` | Public barrel; runtime code imports only this public boundary. |
| `src/session/storage.ts` | Reuse project isolation and persistence policy; add controlled trace-path helper only, without changing transcript entries. |
| `src/core/queryEngine.ts` | Creates root writer around each `submitInternal` loop invocation; emits query lifecycle; closes/flushed writer in terminal paths; passes optional sink to `query()`. |
| `src/core/agenticLoop.ts` | Adds optional trace sink to `QueryParams`/tool options and emits model, retry, tool, permission, compaction, and terminal facts at existing unified boundaries. |
| `src/scripts/test-trace.ts` | Deterministic trace suite F1–F7 using injected fake sink/writer and temporary filesystem locations. |
| `package.json` | Adds `test:trace` script using the existing `tsx src/scripts/...` convention. |
| `docs/learning/enterprise-upgrade/03-trace-mvp-implementation-and-verification.md` | Teaching artifact: actual code boundaries, trade-offs encountered, test evidence, and interview defense updates. |

## Task 1: Establish Trace DTOs, Safe Summaries, and Unit Tests

**Files:**
- Create: `src/observability/types.ts`
- Create: `src/observability/redaction.ts`
- Create: `src/observability/index.ts`
- Create: `src/scripts/test-trace.ts`

**Interfaces:**
- Produces `HarnessTraceEvent`, `HarnessTraceEventType`, `TraceSink`, `TraceMetadata`, `ToolInputSummary`, `ToolResultSummary`, `createSafeMessage()`, `summarizeToolInput()`, `summarizeToolResult()`, and `redactForTrace()`.
- Consumed later by `traceWriter.ts`, `QueryEngine`, and `agenticLoop`.

- [ ] **Step 1: Add the trace test entrypoint and write failing tests for event invariants and secret filtering.**

```ts
import assert from "node:assert/strict";
import {
  createSafeMessage,
  redactForTrace,
  summarizeToolInput,
} from "../observability/index.js";

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

const summary = summarizeToolInput({ command: "npm test", apiKey: secret, path: "src/x.ts" });
assert.deepEqual(summary.fieldNames, ["apiKey", "command", "path"]);
assert.equal(summary.contentOmitted, true);
assert.equal("command" in summary, false);

assert.equal(createSafeMessage(`Authorization: Bearer abcdef ${"x".repeat(1_000)}`).includes("abcdef"), false);
assert.ok(createSafeMessage("x".repeat(1_000)).length <= 500);
console.log("trace DTO/redaction tests passed");
```

- [ ] **Step 2: Run the test to verify it fails because the public observability module does not exist.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
```

Expected: failure resolving `../observability/index.js`.

- [ ] **Step 3: Define the minimal public DTO contract in `src/observability/types.ts`.**

```ts
export const TRACE_SCHEMA_VERSION = 1 as const;

export type HarnessTraceEventType =
  | "query.started"
  | "query.finished"
  | "query.aborted"
  | "query.failed"
  | "model.requested"
  | "model.completed"
  | "model.failed"
  | "retry.scheduled"
  | "stream.restarted"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "permission.requested"
  | "permission.resolved"
  | "context.compacted"
  | "token.warning"
  | "trace.degraded";

export interface HarnessTraceEvent {
  schemaVersion: typeof TRACE_SCHEMA_VERSION;
  eventId: string;
  traceId: string;
  sequence: number;
  timestamp: string;
  eventType: HarnessTraceEventType;
  sessionId?: string;
  spanId?: string;
  payload: Record<string, unknown>;
}

export interface TraceMetadata {
  traceId: string;
  sessionId?: string;
}

export interface TraceSink {
  emit(eventType: HarnessTraceEventType, payload: Record<string, unknown>, options?: { spanId?: string }): void;
  close(): Promise<void>;
}

export interface ToolInputSummary {
  fieldNames: string[];
  serializedLength: number;
  contentOmitted: true;
  redactedFieldNames?: string[];
}

export interface ToolResultSummary {
  outcome: "success" | "tool_error" | "permission_denied" | "aborted" | "timeout" | "unknown";
  textLength?: number;
  exitCode?: number;
  truncated: boolean;
  contentOmitted: true;
}
```

- [ ] **Step 4: Implement allowlist summary and defensive redaction in `src/observability/redaction.ts`.**

```ts
const SENSITIVE_KEY = /(?:api[_-]?key|token|authorization|cookie|password|passwd|secret|private[_-]?key|client[_-]?secret|credentials|env)/i;
const MAX_SAFE_MESSAGE_LENGTH = 500;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/([?&](?:token|key|sig|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

export function redactForTrace(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactForTrace(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [entryKey, redactForTrace(entryValue, entryKey)]));
  }
  return value;
}

export function createSafeMessage(value: unknown): string {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : "Trace operation failed";
  return redactString(raw).slice(0, MAX_SAFE_MESSAGE_LENGTH);
}

export function summarizeToolInput(input: Record<string, unknown>): ToolInputSummary {
  const fieldNames = Object.keys(input).sort().slice(0, 20);
  const redactedFieldNames = fieldNames.filter((name) => SENSITIVE_KEY.test(name));
  return {
    fieldNames,
    serializedLength: JSON.stringify(input).length,
    contentOmitted: true,
    ...(redactedFieldNames.length > 0 ? { redactedFieldNames } : {}),
  };
}
```

- [ ] **Step 5: Export the stable public interface from `src/observability/index.ts`.**

```ts
export {
  TRACE_SCHEMA_VERSION,
  type HarnessTraceEvent,
  type HarnessTraceEventType,
  type TraceMetadata,
  type TraceSink,
  type ToolInputSummary,
  type ToolResultSummary,
} from "./types.js";
export { createSafeMessage, redactForTrace, summarizeToolInput } from "./redaction.js";
```

- [ ] **Step 6: Run the focused trace test and TypeScript build.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
npm run build
```

Expected: `trace DTO/redaction tests passed` and TypeScript exits 0.

- [ ] **Step 7: Commit the standalone, tested DTO/redaction foundation.**

```bash
git add src/observability src/scripts/test-trace.ts
git commit -m "feat(trace): add safe event contract foundation"
```

## Task 2: Add Best-Effort JSONL Writer, Reader, and Controlled Storage Path

**Files:**
- Create: `src/observability/traceWriter.ts`
- Create: `src/observability/traceReader.ts`
- Modify: `src/observability/index.ts`
- Modify: `src/session/storage.ts`
- Modify: `src/scripts/test-trace.ts`

**Interfaces:**
- Consumes `TraceMetadata`, `TraceSink`, safe DTOs, existing `getEasyAgentHome()`, `getProjectPathInfo()`, and `isSessionPersistenceEnabled()`.
- Produces `getTracePath(cwd, traceId)`, `createTraceWriter({ cwd, traceId, sessionId? })`, and `readTraceEvents(filePath)`.

- [ ] **Step 1: Add failing writer/reader tests to `src/scripts/test-trace.ts`.**

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTraceWriter, readTraceEvents } from "../observability/index.js";

const tempDir = await mkdtemp(path.join(tmpdir(), "easy-agent-trace-"));
try {
  const writer = await createTraceWriter({ cwd: tempDir, traceId: "trace-test", sessionId: "session-test" });
  writer.emit("query.started", { model: "test", invocationKind: "user_prompt" });
  writer.emit("query.finished", { reason: "completed", turnCount: 1, usage: { input_tokens: 1, output_tokens: 1 }, durationMs: 1 });
  await writer.close();

  const events = await readTraceEvents(writer.filePath!);
  assert.deepEqual(events.map((event) => event.sequence), [1, 2]);
  assert.equal(events[0]?.traceId, "trace-test");
  assert.equal(events[1]?.eventType, "query.finished");
  assert.equal((await readFile(writer.filePath!, "utf-8")).includes("sk-test-very-secret"), false);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run the test and verify it fails on missing writer exports.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
```

Expected: failure that `createTraceWriter` / `readTraceEvents` are not exported.

- [ ] **Step 3: Add a controlled trace-path helper beside existing session storage helpers.**

In `src/session/storage.ts`, add an exported helper using the existing project identity mechanism rather than duplicating project-path logic:

```ts
export async function getTracePath(cwd: string, traceId: string): Promise<string> {
  const info = await getProjectPathInfo(cwd);
  const traceDir = path.join(getEasyAgentHome(), "projects", info.projectKey, "traces");
  return path.join(traceDir, `${traceId}.jsonl`);
}
```

If `getProjectPathInfo()` has a different returned key name, use its actual project directory/path output and preserve the existing session storage’s project isolation exactly. Add a companion `ensureTraceDirectory()` internal helper that creates only the controlled trace directory.

- [ ] **Step 4: Implement the disabled and best-effort writer contract.**

```ts
const MAX_EVENT_BYTES = 16 * 1024;

export interface TraceWriter extends TraceSink {
  readonly filePath?: string;
  readonly traceId: string;
  readonly degraded: boolean;
}

export async function createTraceWriter(input: {
  cwd: string;
  traceId: string;
  sessionId?: string;
}): Promise<TraceWriter> {
  if (!isSessionPersistenceEnabled()) return createNoopTraceWriter(input.traceId);
  try {
    const filePath = await getTracePath(input.cwd, input.traceId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    return createJsonlTraceWriter({ ...input, filePath });
  } catch {
    return createNoopTraceWriter(input.traceId, true);
  }
}
```

`createJsonlTraceWriter()` must:

- assign `sequence` strictly in one synchronous `emit()` call path;
- construct events only from `eventType`, safe payload, trace metadata and generated IDs;
- serialize then reject/drop an event above `MAX_EVENT_BYTES` without throwing;
- queue appends in a private promise chain so concurrent tool completions preserve `sequence` order;
- on the first append/serialization failure, set `degraded = true`, stop accepting events, and never throw from `emit()` or `close()`;
- never write raw caught errors to JSONL.

- [ ] **Step 5: Implement a tolerant reader.**

```ts
export async function readTraceEvents(filePath: string): Promise<HarnessTraceEvent[]> {
  const source = await fs.readFile(filePath, "utf-8");
  const events: HarnessTraceEvent[] = [];
  for (const line of source.split("\n")) {
    if (!line.trim()) continue;
    try {
      const candidate = JSON.parse(line) as HarnessTraceEvent;
      if (candidate.schemaVersion === 1 && typeof candidate.traceId === "string" && typeof candidate.sequence === "number" && typeof candidate.eventType === "string") {
        events.push(candidate);
      }
    } catch {
      // A crash may leave a partial trailing JSONL line; preserve earlier events.
    }
  }
  return events;
}
```

- [ ] **Step 6: Extend tests for malformed trailing JSON, disabled persistence, and injected append failure.**

Use dependency injection in `createJsonlTraceWriter()` for `appendFile` during tests rather than changing global filesystem behavior:

```ts
const failingWriter = createJsonlTraceWriter({
  cwd: tempDir,
  traceId: "fails-safely",
  filePath: path.join(tempDir, "fails.jsonl"),
  appendLine: async () => { throw new Error("disk unavailable"); },
});
failingWriter.emit("query.started", { model: "test" });
await failingWriter.close();
assert.equal(failingWriter.degraded, true);
```

Append `"{bad trailing json"` to a valid fixture, then assert `readTraceEvents()` still returns valid earlier events.

- [ ] **Step 7: Run focused tests and build.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
npm run build
```

Expected: trace script exits 0; build exits 0.

- [ ] **Step 8: Commit writer/reader/storage-path changes.**

```bash
git add src/observability src/session/storage.ts src/scripts/test-trace.ts
git commit -m "feat(trace): add best-effort local JSONL writer"
```

## Task 3: Wire Top-Level Query Lifecycle Without Changing Agent Semantics

**Files:**
- Modify: `src/core/queryEngine.ts`
- Modify: `src/observability/types.ts`
- Modify: `src/scripts/test-trace.ts`

**Interfaces:**
- Consumes `createTraceWriter`, existing `isSessionPersistenceEnabled` behavior indirectly through the writer, `LoopTerminationReason`, and existing `QueryEngine.submitInternal` lifecycle.
- Produces a root `TraceSink` passed to the loop through an optional `QueryParams.trace` field.

**Blast radius to record before editing:** `QueryEngine.submitInternal` owns prompt addition, `AbortController`, call to `query()`, loop event forwarding, usage updates, and `finally` cleanup (`src/core/queryEngine.ts` around the existing `const abortController = new AbortController()` and `const loop = query({...})` block). Keep all existing yielded `QueryEngineEvent`s unchanged.

- [ ] **Step 1: Add a failing integration test that drives QueryEngine with a fake provider/tool path and asserts lifecycle events exist.**

Use the existing stubbing pattern in `src/scripts/test-queryengine-characterization.ts`. The test must assert this safe sequence:

```ts
const events = await readTraceEvents(tracePath);
assert.equal(events[0]?.eventType, "query.started");
assert.equal(events.at(-1)?.eventType, "query.finished");
assert.equal(events.at(-1)?.payload.reason, "completed");
assert.equal(events.every((event, index) => event.sequence === index + 1), true);
```

- [ ] **Step 2: Run the focused script and confirm the trace lifecycle assertion fails.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
```

Expected: trace has no query lifecycle events before integration.

- [ ] **Step 3: Extend `QueryParams` with optional trace context.**

In `src/core/agenticLoop.ts`:

```ts
import type { TraceSink } from "../observability/index.js";

export interface QueryParams {
  // existing fields unchanged
  trace?: TraceSink;
}
```

The field must remain optional so existing child agent/tests compile unchanged.

- [ ] **Step 4: Create and close the writer in QueryEngine’s existing task submission boundary.**

At the beginning of the existing `submitInternal` section that creates the `AbortController`, create the writer after the effective model and task invocation kind are known:

```ts
const traceStartedAt = performance.now();
const trace = await createTraceWriter({
  cwd: this.toolContext.cwd,
  traceId: crypto.randomUUID(),
  sessionId: this.toolContext.sessionId,
});
trace.emit("query.started", {
  model: this.getActiveModel(),
  permissionMode: this.currentPermissionMode,
  invocationKind: promptToSubmit.length > 0 ? "user_prompt" : "task_notification",
});
```

Pass `trace` in the existing `query({...})` call. In the `done` branch, emit `query.finished` before returning:

```ts
trace.emit("query.finished", {
  reason: value.reason,
  turnCount: value.state.turnCount,
  usage: value.usage,
  durationMs: Math.round(performance.now() - traceStartedAt),
});
```

In `finally`, call `await trace.close()` after clearing the controller. If an exception escapes before a loop result exists, emit one `query.failed` with `errorCategory: "query_engine"`, a `createSafeMessage(error)` summary, and stage `"submitInternal"`; then close. Guard against writing both `query.finished` and `query.failed` with a local `traceTerminalWritten` boolean.

- [ ] **Step 5: Add a cancellation-specific test and implement the aborted terminal branch.**

When `value.reason === "aborted"`, write `query.aborted` and then `query.finished` with reason `aborted`, or choose exactly one terminal event according to the contract and update the contract document/test together. Recommended v1 behavior: write `query.aborted` as a causal event, followed by the sole terminal `query.finished`.

- [ ] **Step 6: Run focused trace, query-engine characterization, and build checks.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
npm run test:queryengine
npm run build
```

Expected: all pass; existing emitted UI/query events remain unchanged.

- [ ] **Step 7: Commit lifecycle wiring.**

```bash
git add src/core/queryEngine.ts src/core/agenticLoop.ts src/observability src/scripts/test-trace.ts
git commit -m "feat(trace): record top-level query lifecycle"
```

## Task 4: Instrument Model, Retry, and Terminal Facts in `agenticLoop.query()`

**Files:**
- Modify: `src/core/agenticLoop.ts`
- Modify: `src/scripts/test-trace.ts`

**Interfaces:**
- Consumes optional `params.trace` established in Task 3 and existing `streamMessage()`/stream event behavior.
- Produces safe `model.*`, `retry.scheduled`, `stream.restarted`, `token.warning`, `context.compacted`, and terminal-adjacent facts while preserving `AgenticLoopEvent` output exactly.

**Blast radius to record before editing:** `query()` in `src/core/agenticLoop.ts` is the core loop that checks abort and token limits, invokes `streamMessage()`, forwards stream values, handles retry/compaction/recovery, produces assistant/tool messages, and yields `turn_complete`. Do not refactor control flow; add side-effect-free `trace?.emit()` calls adjacent to existing facts.

- [ ] **Step 1: Write failing model/retry/abort trace assertions.**

```ts
assert.deepEqual(
  events.filter((event) => event.eventType.startsWith("model.")).map((event) => event.eventType),
  ["model.requested", "model.completed"],
);
assert.equal(events.some((event) => event.eventType === "retry.scheduled"), true);
assert.equal(events.some((event) => event.eventType === "query.aborted"), true);
```

Use fake stream inputs that exercise a normal `tool_use` stop and an existing retry callback/event pathway; do not call a live provider.

- [ ] **Step 2: Run the trace script and verify assertions fail.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
```

Expected: missing model/retry trace events.

- [ ] **Step 3: Emit a model request immediately before the existing `streamMessage({...})` call.**

```ts
const turnId = nextTurnCount;
const modelStartedAt = performance.now();
params.trace?.emit("model.requested", {
  turnId,
  model: params.model,
  toolCount: (params.getTools?.() ?? params.tools ?? []).length,
  messageCount: state.messages.length,
});
```

Do not call `getTools()` an additional time if it has side effects; assign the tools used by the existing request to a local variable once and use that same value for both the request and `toolCount`.

- [ ] **Step 4: Emit model completion/failure and retry facts from existing branches.**

- On successful stream completion, emit `model.completed` with `turnId`, existing `stopReason`, existing per-turn `usage`, `durationMs`, and a content summary containing only content-block types/counts.
- Where existing retry UI event `api_retry` is yielded, emit `retry.scheduled` with the same `attempt`, `maxRetries`, `delayMs`, and a categorized safe message—not provider raw error data.
- Where existing code yields `stream_restart`, emit `stream.restarted` with the same reason.
- Before existing `error` / `turn_complete(model_error)` yields, emit `model.failed` with `turnId`, `retryable` and `createSafeMessage()`.
- Where existing code yields `token_warning` and compaction has completed, emit `token.warning` and `context.compacted` from the same source values.

- [ ] **Step 5: Verify no event ordering change reaches UI consumers.**

Add an assertion to the existing query-engine/stream tests that snapshots the preexisting `AgenticLoopEvent.type` order for a known fixture. Trace must be side-effect-only.

- [ ] **Step 6: Run tests and build.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
npm run test:streaming
npm run test:queryengine
npm run build
```

Expected: all exit 0.

- [ ] **Step 7: Commit loop instrumentation.**

```bash
git add src/core/agenticLoop.ts src/scripts/test-trace.ts
git commit -m "feat(trace): record model and recovery lifecycle"
```

## Task 5: Instrument Unified Tool and Permission Boundaries

**Files:**
- Modify: `src/core/agenticLoop.ts`
- Modify: `src/observability/redaction.ts`
- Modify: `src/scripts/test-trace.ts`

**Interfaces:**
- Consumes `TraceSink`, `summarizeToolInput`, existing `ToolResult`, `checkPermission`, `runOneToolBlock`, `runTools`, and permission callback flow.
- Produces `tool.started`, `tool.completed`, `tool.failed`, `permission.requested`, and `permission.resolved` without touching individual tool implementations.

**Blast radius to record before editing:** `runOneToolBlock()` is called by both serial and concurrency-safe batches in `runTools()`; it runs hooks, calls `checkPermission`, executes one tool, and returns a `ToolExecutionResult`. Instrument this one function so built-in and MCP tools are uniformly covered. Preserve its return structure/order.

- [ ] **Step 1: Add failing successful-tool and permission-denied fixture assertions.**

```ts
const toolStart = events.find((event) => event.eventType === "tool.started");
const toolDone = events.find((event) => event.eventType === "tool.completed");
assert.equal(toolStart?.payload.toolName, "Read");
assert.equal(toolStart?.spanId, toolDone?.spanId);
assert.equal((toolDone?.payload.resultSummary as { contentOmitted: boolean }).contentOmitted, true);
assert.equal(events.some((event) => event.eventType === "permission.resolved" && event.payload.decision === "deny"), true);
```

- [ ] **Step 2: Run the trace suite and verify missing tool/permission event failures.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
```

Expected: failure due to missing `tool.started` / `permission.resolved`.

- [ ] **Step 3: Thread optional trace through `RunToolsOptions` and call sites.**

```ts
export interface RunToolsOptions {
  // existing fields unchanged
  trace?: TraceSink;
  turnId?: number;
}
```

Pass `params.trace` and the current loop turn ID from `query()` into `runTools()` without modifying tool inputs or permission settings.

- [ ] **Step 4: Emit events inside `runOneToolBlock()` around existing permission and execution facts.**

```ts
const spanId = crypto.randomUUID();
const startedAt = performance.now();
options.trace?.emit("tool.started", {
  turnId: options.turnId,
  toolUseId: block.id,
  toolName: block.name,
  inputSummary: summarizeToolInput((block.input as Record<string, unknown>) ?? {}),
}, { spanId });
```

At the existing permission request callback boundary, emit `permission.requested`; once `checkPermission()` resolves, emit `permission.resolved` with `decision` and source inferred only from actual available policy facts (`user`, `rule`, `mode`, `classifier`, `headless`). If source cannot be known safely, record `source: "unknown"`; do not invent it.

After the existing tool execution returns, map the existing `ToolResult` to `ToolResultSummary` using only `isError`, content length/block types, exit code where structurally available, and `contentOmitted: true`. Emit `tool.completed` using the same `spanId`. In the existing thrown-error path, emit `tool.failed` with a sanitized category/message and duration, then preserve current error handling exactly.

- [ ] **Step 5: Add a concurrency ordering test.**

Create two concurrency-safe fake tools that finish in reverse wall-clock order. Assert each tool’s start/completion share a `spanId`, all events retain unique monotonic `sequence`, and no raw output appears in the file. Do not assert wall-clock completion order.

- [ ] **Step 6: Run focused and existing safety tests.**

Run:

```bash
npx tsx src/scripts/test-trace.ts
npm run test:queryengine
npm run test:resilience
npm run test:sandbox
npm run build
```

Expected: all exit 0. If a preexisting test fails, capture its unmodified output and classify it separately from this change.

- [ ] **Step 7: Commit tool/permission instrumentation.**

```bash
git add src/core/agenticLoop.ts src/observability/redaction.ts src/scripts/test-trace.ts
git commit -m "feat(trace): record tool and permission outcomes"
```

## Task 6: Finish Reader Robustness, Add npm Entry, and Produce the Teaching Evidence

**Files:**
- Modify: `package.json`
- Modify: `src/scripts/test-trace.ts`
- Create: `docs/learning/enterprise-upgrade/03-trace-mvp-implementation-and-verification.md`
- Modify: `docs/engineering/evaluation/trace-mvp-acceptance-plan.md`

**Interfaces:**
- Consumes completed P0 trace public APIs and fixture output.
- Produces a stable `npm run test:trace` command, F1–F7 evidence, and a learning/implementation record.

- [ ] **Step 1: Add `test:trace` to `package.json` using the existing script convention.**

```json
"test:trace": "tsx src/scripts/test-trace.ts"
```

Place it adjacent to existing `test:streaming` / `test:resilience` scripts; preserve JSON formatting and all other scripts.

- [ ] **Step 2: Complete F1–F7 tests in `src/scripts/test-trace.ts`.**

The final script must print one named PASS line for each:

```text
PASS F1 success tool chain
PASS F2 permission denied
PASS F3 retry
PASS F4 abort
PASS F5 writer failure isolation
PASS F6 redaction
PASS F7 tolerant reader
```

Each case must use fake provider/tool adapters or injected dependencies. The suite must not require a real API key, network, a live MCP server, or a user TTY.

- [ ] **Step 3: Run the new dedicated command and verify all seven lines appear.**

Run:

```bash
npm run test:trace
```

Expected: exit 0 and exactly the seven named PASS lines.

- [ ] **Step 4: Run the full P0 verification sequence.**

Run:

```bash
npm run build
npm run test:trace
npm run test:queryengine
npm run test:streaming
npm run test:resilience
npm run test:sandbox
```

Expected: all exit 0. Record any failure with command, output, whether it predated P0, and remediation decision; do not silently skip it.

- [ ] **Step 5: Write the implementation teaching document with actual evidence, not predicted claims.**

Create `docs/learning/enterprise-upgrade/03-trace-mvp-implementation-and-verification.md` with:

```markdown
---
title: "P0 Trace MVP：实际实现、失败与验证"
created: 2026-07-28
tags: [easy-agent, agent-harness, observability, evaluation, implementation]
---

# P0 Trace MVP：实际实现、失败与验证

## 真实改动边界
## 实际调用链（QueryEngine → AgenticLoop → tool boundary → writer）
## 每个 F1–F7 的实际证据
## 实施中遇到的问题与最终取舍
## 未实现的边界：subagent、云端、回放、内容采集
## 面试追问：为何 Trace 失败不能影响主路径？如何证明？
```

Use links to ADR, event contract, privacy spec, and acceptance plan. Include actual test command output summaries, actual source paths/symbols, and actual constraints discovered during implementation. Do not claim a test passed unless it ran successfully.

- [ ] **Step 6: Update the acceptance plan checklist with completed evidence only.**

In `docs/engineering/evaluation/trace-mvp-acceptance-plan.md`, add a dated implementation evidence section listing test commands/results and known limitations. Leave unchecked any test that did not pass.

- [ ] **Step 7: Inspect changed scope and perform GitNexus change detection if the service is available.**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Then run `detect_changes(scope: "all", repo: "easy-agent")` if GitNexus is functioning. If it remains unavailable, record the exact tool failure and manually inspect changed symbol call sites and test scope in the teaching document.

- [ ] **Step 8: Commit the verified MVP and documentation.**

```bash
git add package.json src/observability src/session/storage.ts src/core/queryEngine.ts src/core/agenticLoop.ts src/scripts/test-trace.ts docs/engineering docs/learning/enterprise-upgrade
git commit -m "feat(trace): add local structured harness tracing"
```

Do not push. Confirm `git remote -v` still shows `DISABLED_NO_PUSH_TO_UPSTREAM` for origin push before any later integration step.

## Plan Self-Review

### Spec coverage

| Requirement | Covered by |
| --- | --- |
| Default-on, follows session persistence | Task 2 storage/writer path and disabled-writer test. |
| JSONL, schema, IDs, sequence, tolerant reader | Tasks 1–2. |
| Query / model / retry / tool / permission / context lifecycle | Tasks 3–5. |
| No raw content/secrets, redaction defense | Tasks 1–2 and F6 in Task 6. |
| Trace failure isolation | Task 2 injection test, F5, and all runtime integrations using non-throwing sink. |
| P0 no subagent/cloud/dashboard/replay | Global constraints and implementation boundaries. |
| F1–F7 deterministic evaluation | Task 6. |
| Teaching documentation with actual evidence | Task 6. |
| Build/existing regression verification | Tasks 1–6, especially Task 6. |

### Placeholder and consistency check

- No `TBD`/`TODO` implementation placeholders remain.
- All code-step public identifiers are defined in Task 1 or Task 2 before later tasks consume them.
- `TraceSink` is optional at runtime and required only for instrumentation calls guarded by optional chaining.
- The plan intentionally resolves the ADR ambiguity for terminal lifecycle: `query.aborted` can precede the sole final `query.finished(reason: "aborted")`; `query.finished` remains the only normal final event.
- The plan does not claim the current project-key shape in `getProjectPathInfo()`; Task 2 explicitly requires reuse of its actual existing return shape rather than inventing a property name.
