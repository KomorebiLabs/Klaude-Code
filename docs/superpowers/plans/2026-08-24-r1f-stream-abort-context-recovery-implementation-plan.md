# PR-06 / R1-F Streaming / Abort / Context Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Query 建立统一 Abort/Timeout/Streaming/Context Recovery 生命周期，确保取消后不启动新业务步骤，且所有恢复路径有界、不重复副作用。

**Execution status (2026-08-24):** Tasks 1–6 已执行并通过 Core Gate。下方 checkbox 保留原始 RED/GREEN 执行顺序；`test:queryengine` 因现有 macOS golden、Windows 平台输出及宿主 settings 污染不能作为本阶段有效证据，未修改 golden，偏差详见 PR-06 Dev Doc。

**Architecture:** API 层新增 request-scoped lifecycle helper，统一链接父 AbortSignal、Model deadline 和资源清理。`streamMessage` 返回 `outputStarted` 安全信号；`agenticLoop` 在 Model/Compaction/Tool/Hook/Restart 边界做取消门禁；`QueryEngine` 统一 Controller 和终止 Trace。

**Tech Stack:** TypeScript 6、Node.js AbortController/AbortSignal、AsyncGenerator、Anthropic SDK、现有无网络 smoke/characterization scripts。

---

## File Map

- Create `src/services/api/requestLifecycle.ts`: request deadline、父 Signal 链接、abort cause 和 cleanup。
- Create `src/scripts/test-recovery-lifecycle.ts`: PR-06 确定性主证据。
- Modify `src/services/api/errors.ts`: 识别内部 request timeout，保留 `api_timeout` 公共类别。
- Modify `src/services/api/withRetry.ts`: 每个 non-streaming attempt 使用独立 lifecycle scope。
- Modify `src/services/api/streaming.ts`: 每个 streaming attempt 使用 lifecycle scope，输出 `outputStarted`。
- Modify `src/types/message.ts`: 向 `StreamErrorEvent` 增加兼容的 `outputStarted` 字段。
- Modify `src/context/compaction.ts`, `src/context/autoCompact.ts`: 将 Query Signal 传到摘要 Model request。
- Modify `src/core/agenticLoop.ts`: 恢复门禁、Abort 边界、测试注入点。
- Modify `src/core/queryEngine.ts`, `src/observability/queryLifecycle.ts`: 统一 Query Controller 与唯一终止 Trace。
- Modify `src/scripts/test-trace.ts`, `package.json`, `docs/evaluation/r1-invariant-to-evidence-matrix.md`, `docs/README.md`: 回归、Core Gate 和交接。
- Create `docs/learning/E2/pr-06-stream-abort-context-recovery-dev-doc.md`: 实施事实与限制。

### Task 1: Request Lifecycle Primitive

**Files:**
- Create: `src/services/api/requestLifecycle.ts`
- Modify: `src/services/api/errors.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Create a script that asserts parent abort wins over timeout, timeout aborts the child signal with a stable cause, and `dispose()` prevents a later timeout:

```ts
const parent = new AbortController();
const linked = createRequestLifecycle({ parentSignal: parent.signal, timeoutMs: 50 });
parent.abort();
assert.equal(linked.signal.aborted, true);
assert.equal(linked.getCause(), "user_abort");
linked.dispose();

const timed = createRequestLifecycle({ timeoutMs: 5 });
await waitForAbort(timed.signal);
assert.equal(timed.getCause(), "timeout");
assert.equal(classifyAPIError(timed.normalizeError(new Error("AbortError"))), "api_timeout");
timed.dispose();
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts`

Expected: FAIL because `requestLifecycle.ts` does not exist.

- [ ] **Step 3: Implement the minimal lifecycle contract**

Implement:

```ts
export type RequestAbortCause = "none" | "user_abort" | "timeout";
export const DEFAULT_MODEL_TIMEOUT_MS = 600_000;
export class RequestTimeoutError extends Error {
  constructor() {
    super("Model request timed out.");
    this.name = "RequestTimeoutError";
  }
}
export function getModelTimeoutMs(): number {
  const parsed = Number(process.env.EASY_AGENT_MODEL_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MODEL_TIMEOUT_MS;
}
export function createRequestLifecycle(options: {
  parentSignal?: AbortSignal;
  timeoutMs?: number;
}): {
  signal: AbortSignal;
  getCause(): RequestAbortCause;
  normalizeError(error: unknown): unknown;
  dispose(): void;
};
```

The parent listener sets `user_abort`; the timer sets `timeout`; `dispose` clears both. `normalizeError` returns a fixed `RequestTimeoutError` for timeout and an `AbortError` for parent cancellation without copying provider text.

- [ ] **Step 4: Run GREEN**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts && npm run build`

Expected: lifecycle assertions pass; TypeScript build passes.

### Task 2: Streaming and Non-streaming Attempt Ownership

**Files:**
- Modify: `src/services/api/withRetry.ts`
- Modify: `src/services/api/streaming.ts`
- Modify: `src/types/message.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`
- Test: `src/scripts/smoke-resilience.ts`

- [ ] **Step 1: Add failing behavior assertions**

Assert that a pre-output timeout is categorized as `api_timeout`, a partial stream error carries `outputStarted: true`, and user abort stops retry even if the provider throws a generic abort-shaped error. Add a non-streaming assertion that each retry operation receives a non-aborted attempt signal and that the attempt signal is disposed after completion.

- [ ] **Step 2: Run RED**

Run: `npm run test:resilience && npx tsx src/scripts/test-recovery-lifecycle.ts`

Expected: FAIL on missing attempt signal/outputStarted behavior.

- [ ] **Step 3: Integrate lifecycle scopes**

Extend the contracts without breaking legacy callers:

```ts
export interface StreamRequestParams {
  // existing fields
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface StreamErrorEvent {
  type: "error";
  error: Error;
  category?: string;
  outputStarted?: boolean;
}
```

For each `streamMessage` attempt, create a request lifecycle, pass its child signal into `streamOnce`, normalize caught errors, and always dispose in `finally`. Set `outputStarted` from the existing `hasYieldedContent` flag. Extend `callWithRetry` so `operation(attempt, attemptSignal)` receives a per-attempt child signal and `timeoutMs` is optional.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:resilience && npx tsx src/scripts/test-recovery-lifecycle.ts && npm run test:providerstream && npm run build`

Expected: all commands pass without network.

### Task 3: Abortable Compaction

**Files:**
- Modify: `src/context/compaction.ts`
- Modify: `src/context/autoCompact.ts`
- Modify: `src/services/api/streaming.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`

- [ ] **Step 1: Add failing compaction cancellation test**

Use an injected `createMessageImpl` seam or an already-aborted signal to prove the summarization request receives the signal and no compacted messages are committed after cancellation:

```ts
const controller = new AbortController();
controller.abort();
await assert.rejects(
  compactMessages(history, undefined, { force: true, signal: controller.signal }),
  (error) => classifyAPIError(error) === "aborted",
);
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts`

Expected: FAIL because compaction options do not accept/forward `signal`.

- [ ] **Step 3: Forward the signal through compaction**

Add `signal?: AbortSignal` to `CompactionCheckOptions`; check it before summarization and after the response; pass it through `autoCompactIfNeeded` and into `createMessage`. Change `createMessage` to accept the full `StreamRequestParams` shape and pass the signal/timeout into `callWithRetry`.

- [ ] **Step 4: Run GREEN**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts && npm run build`

Expected: compaction cancellation is classified as aborted and build passes.

### Task 4: Agentic Loop Recovery and Side-effect Gates

**Files:**
- Modify: `src/core/agenticLoop.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`
- Test: `src/scripts/test-trace.ts`

- [ ] **Step 1: Add failing query-level tests**

Use `streamMessageImpl`, `compactMessagesImpl`, and `runToolsImpl` seams to assert:

```ts
// Partial prompt-too-long must not compact/restart.
yield { type: "text", text: "partial" };
yield { type: "error", error: new Error("too long"), category: "prompt_too_long", outputStarted: true };
assert.equal(compactCalls, 0);
assert.equal(restartEvents, 0);

// Pre-output prompt-too-long compacts/restarts at most once.
assert.equal(compactCalls, 1);
assert.equal(restartEvents, 1);

// Abort after a wait prevents the next injected Tool/Hook/Restart call.
assert.equal(newBusinessActionCallsAfterAbort, 0);
```

Add a max-token fixture proving the first generated tool-use is not executed before escalation, while continuation commits each truncated assistant message exactly once.

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts && npm run test:trace`

Expected: FAIL on missing `outputStarted` recovery guard and post-wait Abort gates.

- [ ] **Step 3: Implement boundary checks**

- Store `{ error, category, outputStarted }` for stream failures.
- Return an `aborted` loop result immediately when the parent signal is aborted, without yielding a friendly model error.
- Permit Reactive Compact only when `outputStarted !== true`; use `params.compactMessagesImpl ?? compactMessages`; check Abort before and after it.
- Check Abort before max-token restart/continuation, before Stop hooks, before each Tool batch, after permission resolution, before file-history backup/tool call, after tool call before PostToolUse hook, and before the next serial/concurrent chunk.
- Add only narrow dependency seams needed by the deterministic script; production defaults stay the existing functions.

- [ ] **Step 4: Run GREEN**

Run: `npx tsx src/scripts/test-recovery-lifecycle.ts && npm run test:trace && npm run test:agents && npm run build`

Expected: all assertions pass; no real model is called.

### Task 5: QueryEngine Controller and Terminal Trace

**Files:**
- Modify: `src/core/queryEngine.ts`
- Modify: `src/observability/queryLifecycle.ts`
- Modify: `src/scripts/test-queryengine-characterization.ts`
- Test: `src/scripts/test-trace.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`

- [ ] **Step 1: Add failing terminal-event tests**

Cover graceful abort and timeout results. For each Query, assert exactly one terminal event:

```ts
assert.deepEqual(terminalTypes(abortedTrace), ["query.aborted"]);
assert.deepEqual(terminalTypes(timeoutTrace), ["query.failed"]);
assert.equal(timeoutTrace[0]?.payload.reason, "timeout");
assert.equal(JSON.stringify(timeoutTrace).includes("provider-secret"), false);
```

Assert an abort during pre-submit compaction stops before the first main Model call.

- [ ] **Step 2: Run RED**

Run: `npm run test:trace && npx tsx src/scripts/test-recovery-lifecycle.ts`

Expected: graceful abort is still recorded as `query.finished` or preflight compaction cannot be interrupted.

- [ ] **Step 3: Unify Query lifecycle ownership**

Create the Query controller and Trace Writer before pre-submit compaction. Wrap preflight + Agentic Loop in one `try/catch/finally`; pass the signal into compact/auto-compact/query. Map terminal reasons exactly:

```ts
completed | blocking_limit | max_turns -> query.finished
aborted                               -> query.aborted
timeout | model_error                 -> query.failed
```

Extend `createQueryFailedPayload` with an optional allowlisted `{ reason, errorCategory }`, while retaining safe redaction and legacy calls. Guard terminal emission so catch and normal return cannot both write terminal events.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:queryengine && npm run test:trace && npx tsx src/scripts/test-recovery-lifecycle.ts && npm run build`

Expected: characterization remains stable except intentional lifecycle fields; each Query has one terminal Trace.

### Task 6: Evidence Closure and Documentation

**Files:**
- Modify: `package.json`
- Modify: `docs/evaluation/r1-invariant-to-evidence-matrix.md`
- Modify: `docs/README.md`
- Create: `docs/learning/E2/pr-06-stream-abort-context-recovery-dev-doc.md`

- [ ] **Step 1: Add the focused gate**

Add `test:recovery-lifecycle` and execute it from `verify:core` after resilience and before provider characterization.

- [ ] **Step 2: Update the evidence matrix**

Add explicit rows for:

- `lifecycle.abort-no-new-action`
- `lifecycle.timeout-bounded-cleanup`
- `stream.partial-output-no-restart`
- `context.single-reactive-recovery`
- `trace.single-terminal-event`

- [ ] **Step 3: Write the Dev Doc and status handoff**

Record the actual call chain, design decisions, changed symbols, deterministic evidence, unsupported cancellation boundaries, and PR-07 as the next candidate. Do not claim rollback of already-completed Tool side effects or process crash recovery.

- [ ] **Step 4: Run final verification**

Run:

```powershell
npm run verify:core
git diff --check
node .gitnexus/run.cjs detect-changes --scope compare --base-ref github/main --repo easy-agent
git status --short
```

Expected: Core Gate passes; diff check is clean; GitNexus reports only the expected Query/Streaming/Compaction/Trace flows; `AGENTS.md` and `CLAUDE.md` remain untracked and unstaged.

## Commit Policy

The repository instructions reserve commit/push/PR actions for explicit user execution. Do not commit after individual tasks. At stage completion provide one exact staging, commit, push, and `gh pr create` command set that excludes `AGENTS.md` and `CLAUDE.md`.
