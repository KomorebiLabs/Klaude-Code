# PR-08 / R1-H Sandbox / MCP / Secret Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不建设跨平台 Sandbox 或通用 Secret Scanner 的前提下，关闭路径逃逸、外部进程失控、MCP 请求无界和诊断 Secret 泄漏四类 R1 高风险边界。

**Architecture:** 保留 PR-07 的统一 Permission/Execution Ledger 作为唯一授权入口；文件路径在 I/O 前 canonicalize，Bash/PowerShell 共享受控进程执行器，MCP 请求共享 timeout/abort/内容预算，所有诊断出口复用 observability redaction。安全状态通过窄类型和 allowlisted Trace 摘要表达，不持久化外部正文。

**Tech Stack:** TypeScript 6、Node.js `fs/path/child_process`、`@modelcontextprotocol/sdk` RequestOptions、现有 Trace/Evaluation/Core Gate。

**实施状态（2026-08-24）：** Task 1～6 已完成；Core Gate、真实 MCP 冒烟和提交前 change detection 已通过。实际 MCP 共享模块采用 `src/services/mcp/safety.ts`，职责与本文原定 `requestSafety.ts` 相同。Windows 上两个历史跨平台 characterization 的限制见 E3 Dev Doc。

---

## 文件结构与职责

- Create `src/tools/processLifecycle.ts`：timeout 规范化、有界输出缓冲、进程树终止和单次结算。
- Create `src/services/mcp/requestSafety.ts`：MCP timeout/abort、内容预算、错误分类和安全摘要。
- Create `src/scripts/test-external-safety-contract.ts`：PR-08 路径/进程/MCP/Secret 主证据。
- Modify `src/tools/pathUtils.ts`：真实路径/最近存在祖先 containment。
- Modify `src/tools/bashTool.ts`、`src/tools/powerShellTool.ts`：接入共享进程生命周期。
- Modify `src/tools/Tool.ts`、`src/core/agenticLoop.ts`、`src/observability/toolLifecycle.ts`：外部来源与终止状态的 allowlisted Trace。
- Modify `src/services/mcp/fetchTools.ts`、`src/tools/listMcpResourcesTool.ts`、`src/tools/readMcpResourceTool.ts`：统一 MCP request safety。
- Modify `src/services/mcp/client.ts`、`src/utils/log.ts`、`src/core/queryEngine/commands/diagnostics.ts`：诊断 Secret Safety。
- Modify `package.json`、R1 Matrix、docs 状态并新增 E3 Dev Doc：证据闭环。

## Task 1: Canonical Path Containment

**Files:**
- Modify: `src/tools/pathUtils.ts`
- Create/Test: `src/scripts/test-external-safety-contract.ts`

- [ ] **Step 1: 写 traversal RED 测试**

在临时目录创建 `workspace/link-out` 指向 sibling `outside` 的 directory junction/symlink，断言：

```ts
assert.throws(
  () => resolveWorkspacePath(path.join("link-out", "secret.txt"), workspace),
  /outside the allowed roots|symlink escape/i,
);
assert.equal(
  resolveWorkspacePath(path.join("nested", "new.txt"), workspace),
  path.join(workspace, "nested", "new.txt"),
);
```

同时覆盖普通 `../outside`、正常 cwd、`getEasyAgentHome()` 和 `setAdditionalAllowedRoots()`。

- [ ] **Step 2: 运行 RED**

Run: `npx tsx src/scripts/test-external-safety-contract.ts`

Expected: symlink traversal 断言失败，证明现有词法检查可逃逸。

- [ ] **Step 3: 实现 canonicalization**

在 `pathUtils.ts` 增加：

```ts
function canonicalizeWithExistingAncestor(candidate: string): string;
function isInsideRoot(candidate: string, root: string): boolean;
```

`canonicalizeWithExistingAncestor` 对存在目标使用 `realpathSync.native`；不存在目标逐级向上寻找存在祖先，canonicalize 后拼回剩余 segments。`expandHome` 只接受 `~`/`~/`/`~\` 并使用 `os.homedir()`。`ensureInsideAllowedRoots` 比较 canonical target 与 canonical roots。

- [ ] **Step 4: 运行 GREEN 与历史文件工具检查**

Run: `npm run test:external-safety && npm run build`

Expected: traversal 被阻止，正常路径通过，TypeScript build 通过。

## Task 2: Bounded Local Process Lifecycle

**Files:**
- Create: `src/tools/processLifecycle.ts`
- Modify: `src/tools/bashTool.ts`
- Modify: `src/tools/powerShellTool.ts`
- Test: `src/scripts/test-external-safety-contract.ts`

- [ ] **Step 1: 写 process RED 测试**

覆盖：

```ts
assert.equal(normalizeToolTimeout(Number.POSITIVE_INFINITY), DEFAULT_PROCESS_TIMEOUT_MS);
assert.equal(normalizeToolTimeout(-1), MIN_PROCESS_TIMEOUT_MS);

const buffer = new BoundedTextBuffer(16);
buffer.append("a".repeat(40));
assert.equal(buffer.text.length, 16);
assert.equal(buffer.omittedChars, 24);
```

再启动一个会延迟写 marker 文件的 Node child，使用 100ms timeout，等待超过 child 延迟后断言 marker 不存在、结果为 `timeout` 且总等待有上界。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:external-safety`

Expected: `processLifecycle.ts` 尚不存在或 child timeout 后仍可能存活。

- [ ] **Step 3: 实现共享执行器**

定义：

```ts
export type ManagedProcessOutcome = "completed" | "spawn_error" | "timeout" | "aborted";
export type ProcessTermination = "not_required" | "confirmed" | "degraded";

export interface ManagedProcessResult {
  outcome: ManagedProcessOutcome;
  termination: ProcessTermination;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutOmittedChars: number;
  stderrOmittedChars: number;
  errorCategory?: string;
}

export function normalizeToolTimeout(value: unknown): number;
export class BoundedTextBuffer;
export function runManagedProcess(options: ManagedProcessOptions): Promise<ManagedProcessResult>;
```

POSIX 使用 detached process group，timeout/abort 先 SIGTERM、grace 后 SIGKILL；Windows 使用 `taskkill /PID <pid> /T /F`。所有路径清理 timer/listener，close/error/timeout/abort 只结算一次；无法确认退出时在固定回收 deadline 后返回 `termination: "degraded"`。

- [ ] **Step 4: 接入 Bash/PowerShell**

两类 Tool 只负责准备 executable/args/env、Sandbox wrapper、progress 和格式化 ToolResult；执行统一交给 `runManagedProcess`。结果不回显 compiled Sandbox profile，输出使用 executor 已截断文本和 omitted count。

- [ ] **Step 5: 运行 GREEN**

Run: `npm run test:external-safety && npm run test:recovery-lifecycle && npm run build`

Expected: output/timeout/abort 通过，PR-06 cancellation 不回归。

## Task 3: MCP Request and Permission Boundary

**Files:**
- Create: `src/services/mcp/requestSafety.ts`
- Modify: `src/services/mcp/fetchTools.ts`
- Modify: `src/tools/listMcpResourcesTool.ts`
- Modify: `src/tools/readMcpResourceTool.ts`
- Modify: `src/tools/Tool.ts`
- Test: `src/scripts/test-external-safety-contract.ts`

- [ ] **Step 1: 写 MCP RED 测试**

构造 fake `ConnectedMcpServer.client.request` 并覆盖：

```ts
// explicit deny through runTools => requestCalls === 0
// authorized call => options.signal and bounded timeout/maxTotalTimeout exist
// already-aborted context => result.isError and request does not hang
// oversized text blocks => adapter result length <= MCP_CONTENT_BUDGET_CHARS + marker
```

MCP probe 必须使用真实 `mcp__server__tool` adapter，而不是普通本地 Tool 冒充。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:external-safety`

Expected: adapter 当前不传 context signal/显式 total timeout，大内容先完整聚合。

- [ ] **Step 3: 实现 request safety**

定义：

```ts
export const MCP_REQUEST_TIMEOUT_MS = 30_000;
export const MCP_CONTENT_BUDGET_CHARS = 100_000;
export type McpFailureCategory = "mcp_timeout" | "mcp_aborted" | "mcp_failure";

export function getMcpRequestOptions(signal?: AbortSignal): {
  signal?: AbortSignal;
  timeout: number;
  maxTotalTimeout: number;
};
export function classifyMcpFailure(error: unknown): McpFailureCategory;
export function createSafeMcpFailure(operation: string, error: unknown): string;
export class BoundedMcpContent;
```

成功内容按 budget 增量追加；失败正文先分类、redact、限长。

- [ ] **Step 4: 接入 Tool 与 Resource 调用**

`fetchTools.ts` 导出可测试的 `buildToolAdapter`，将 `_context` 改为 `context` 并向 SDK request 传 RequestOptions。List/Read MCP Resource 使用相同 options 和错误摘要，并限制条目/文本预算。

`Tool` 增加可选来源：

```ts
externalSource?: {
  kind: "mcp";
  sourceName: string;
  operationName: string;
};
```

字段只使用规范化 server/tool 名，不包含 URL、headers 或参数。

- [ ] **Step 5: 运行 GREEN 与历史 MCP 检查**

Run: `npm run test:external-safety && npm run test:mcp && npm run test:tool-permission-contract && npm run build`

Expected: MCP deny-no-request、timeout/abort/content budget 通过，历史 MCP 正常链路通过。

## Task 4: Diagnostic Secret Safety

**Files:**
- Modify: `src/observability/redaction.ts`
- Modify: `src/observability/index.ts`
- Modify: `src/utils/log.ts`
- Modify: `src/services/mcp/client.ts`
- Modify: `src/services/mcp/fetchTools.ts`
- Modify: `src/core/queryEngine/commands/diagnostics.ts`
- Test: `src/scripts/test-external-safety-contract.ts`
- Test: `src/scripts/test-trace.ts`
- Test: `src/scripts/test-evaluation.ts`

- [ ] **Step 1: 写 fake-secret RED 测试**

使用唯一标记：

```ts
const fakeSecret = "sk-r1h-fake-secret-123";
const unsafeUrl = `https://user:${fakeSecret}@example.test/mcp?token=${fakeSecret}`;
```

捕获 `console.error`、MCP ToolResult 和 `/doctor` command message，连同内存 Trace 与 Evaluation Report 一起序列化，断言不包含 fakeSecret、Bearer value 或 private-key body。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:external-safety && npm run test:trace && npm run test:evaluation`

Expected: MCP warning/error 或 doctor endpoint 至少一个渠道泄漏 fakeSecret。

- [ ] **Step 3: 扩展统一清洗接口**

在 `redaction.ts` 增加：

```ts
export function createSafeDiagnosticMessage(value: unknown): string;
export function createSafeUrlSummary(value: string): string;
```

URL summary 仅保留 `protocol//host[:port]`；解析失败返回固定 `[invalid-url]`。redaction 自身异常返回固定 `Diagnostic detail omitted.`。

- [ ] **Step 4: 清洗所有 PR-08 诊断出口**

`debugLog` 清洗 message 并对 details 调用 `redactForTrace`；`logWarn` 在 UI/stderr 前调用 `createSafeDiagnosticMessage`。MCP client 不把 raw stderr/URL/args 存入 connection.error。`/doctor` 使用 safe URL summary 和 safe connection error。

- [ ] **Step 5: 运行 GREEN**

Run: `npm run test:external-safety && npm run test:trace && npm run test:evaluation && npm run test:queryengine && npm run build`

Expected: fake secret absent，现有 Trace/Evaluation/Doctor characterization 通过或仅因预期安全摘要更新 golden。

## Task 5: External Execution Trace Summary

**Files:**
- Modify: `src/tools/Tool.ts`
- Modify: `src/core/agenticLoop.ts`
- Modify: `src/observability/toolLifecycle.ts`
- Modify: `src/observability/types.ts`
- Test: `src/scripts/test-external-safety-contract.ts`
- Test: `src/scripts/test-trace.ts`

- [ ] **Step 1: 写 Trace RED 测试**

对 MCP adapter 和本地 process probe 断言 payload 只增加：

```ts
external: {
  kind: "mcp",
  sourceName: "safe_server",
  operationName: "safe_tool",
  termination: "timeout"
}
```

并断言序列化 Trace 不含 URL、headers、command、arguments、stdout、stderr 或 fakeSecret。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:external-safety && npm run test:trace`

Expected: 当前 Tool lifecycle payload 没有 typed external summary。

- [ ] **Step 3: 实现 allowlisted external summary**

扩展 `createToolStartedPayload/createToolFinishedPayload/createToolExceptionPayload` 的输入，只接受类型化 external metadata 与 termination enum。`runOneToolBlock` 从 `tool.externalSource` 和结构化 ToolResult metadata 读取，不从正文解析。

`ToolResult` 增加可选内部元数据：

```ts
diagnostics?: {
  termination?: "completed" | "timeout" | "aborted" | "degraded";
  sandboxState?: "enabled" | "disabled" | "unsupported" | "degraded";
};
```

该字段不进入模型正文，只供 Trace/Inspector 使用。

- [ ] **Step 4: 运行 GREEN**

Run: `npm run test:external-safety && npm run test:trace && npm run build`

Expected: external summary 完整且隐私断言通过。

## Task 6: Evidence and Documentation Closure

**Files:**
- Modify: `package.json`
- Modify: `docs/evaluation/r1-invariant-to-evidence-matrix.md`
- Modify: `docs/README.md`
- Create: `docs/learning/E3/pr-08-sandbox-mcp-secret-safety-dev-doc.md`

- [ ] **Step 1: 加入 Core Gate**

新增：

```json
"test:external-safety": "tsx src/scripts/test-external-safety-contract.ts"
```

并将其放在 `test:tool-permission-contract` 之后、provider characterization 之前。

- [ ] **Step 2: 更新 Evidence Matrix**

新增不变量：

- `filesystem.canonical-containment`；
- `sandbox.permission-no-upgrade`；
- `process.timeout-bounded-cleanup`；
- `mcp.permission-deny-no-request`；
- `mcp.timeout-failure-isolation`；
- `diagnostics.fake-secret-absent`。

- [ ] **Step 3: 编写 Dev Doc 与状态更新**

记录真实调用链、实际支持平台、process/MCP timeout 语义、Secret 清洗渠道、确定性证据、TOCTOU/跨平台 Sandbox/成功正文等限制，并将下一候选更新为 PR-09。

- [ ] **Step 4: 完整验证**

Run:

```powershell
npm run verify:core
npm run test:sandbox
npm run test:mcp
npm run test:queryengine
git diff --check
```

Expected: Core Gate 与聚焦历史检查通过；若 Windows temp cleanup 出现已知 `EBUSY`，必须单独记录，不掩盖功能断言。

- [ ] **Step 5: 提交前审计**

运行 GitNexus `detect-changes --scope all`，检查 git status，确认不暂存根目录未跟踪 `AGENTS.md`/`CLAUDE.md`，并向用户提供完整中文 commit/push/PR PowerShell 命令。Agent 不自行 commit、push 或创建 PR。
