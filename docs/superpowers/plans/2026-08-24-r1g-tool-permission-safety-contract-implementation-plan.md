# PR-07 / R1-G Tool / Permission Safety Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立不可升级 deny、可解释入口决策、非法输入零副作用和 Query 内 Tool Use ID 不重放的统一安全契约。

**Architecture:** 保留现有 `checkPermission -> runOneToolBlock -> tool.call` 主链，在 PermissionResponse 上增加稳定 provenance，在 Tool 编排边界增加轻量 Schema Validator 与 Query-scoped execution ledger。所有入口显式透传 entry point/ask source，Trace 只记录 allowlisted 决策元数据。

**Tech Stack:** TypeScript 6、现有 Tool JSON Schema、AsyncGenerator、JSONL Trace、无网络 deterministic scripts。

---

## File Map

- Create `src/permissions/permissionContract.ts`: entry point、policy source、reason code、outcome、ask source 类型与 Hook/Policy 合并函数。
- Create `src/tools/inputValidation.ts`: 无依赖的 Tool JSON Schema 顶层验证器和安全错误摘要。
- Create `src/scripts/test-tool-permission-contract.ts`: PR-07 离线矩阵主证据。
- Modify `src/permissions/permissions.ts`: 全局 deny precedence 和每条 PermissionResponse 的稳定 provenance。
- Modify `src/core/agenticLoop.ts`: invalid/Hook/Policy/ask/duplicate 门禁、entry metadata、execution ledger。
- Modify `src/core/queryEngine/types.ts`, `src/core/queryEngine.ts`: interactive/headless entry metadata 透传。
- Modify `src/entrypoint/headless.ts`: headless 与 bypass ask source。
- Modify `src/agents/runAgent.ts`, `src/agents/runAsyncAgent.ts`, `src/tools/agentTool.ts`, `src/tools/Tool.ts`: foreground/background subagent provenance 透传。
- Modify `src/observability/toolLifecycle.ts`: allowlisted Permission resolution payload。
- Modify `src/scripts/test-trace.ts`: Trace provenance、隐私与旧序列回归。
- Modify `package.json`, `docs/evaluation/r1-invariant-to-evidence-matrix.md`, `docs/README.md`: Core Gate 和状态。
- Create `docs/learning/E3/pr-07-tool-permission-safety-contract-dev-doc.md`: 实施事实、证据和限制。

### Task 1: Permission Contract and Deny Precedence

**Files:**
- Create: `src/permissions/permissionContract.ts`
- Modify: `src/permissions/permissions.ts`
- Test: `src/scripts/test-tool-permission-contract.ts`

- [ ] **Step 1: Write failing precedence matrix**

用真实 `checkPermission` 和注册 Tool 覆盖：

```ts
const cases = [
  { mode: "default", tool: readTool, deny: ["Read"] },
  { mode: "plan", tool: readTool, deny: ["Read"] },
  { mode: "auto", tool: readTool, deny: ["Read"] },
  { mode: "default", tool: teamDeleteTool, deny: ["TeamDelete"] },
  { mode: "default", tool: webFetchTool, deny: ["WebFetch(domain:docs.python.org)"] },
] as const;

for (const fixture of cases) {
  const result = await checkPermission({
    tool: fixture.tool,
    input: fixture.input ?? {},
    cwd,
    mode: fixture.mode,
    settings: { mode: fixture.mode, allow: [], deny: [...fixture.deny] },
  });
  assert.equal(result.behavior, "deny");
  assert.equal(result.decisionSource, "explicit_deny");
}
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts`

Expected: FAIL，因为 readonly/coordination/domain 快路径可先于 deny，且 provenance 类型不存在。

- [ ] **Step 3: Define stable contract types**

在 `permissionContract.ts` 定义：

```ts
export type ToolEntryPoint = "interactive" | "headless" | "subagent" | "background_subagent";
export type PermissionAskSource = "user" | "headless" | "bypass" | "background" | "default_deny";
export type PermissionPolicySource =
  | "explicit_deny" | "explicit_allow" | "mode_policy" | "hard_safety"
  | "read_only" | "coordination_policy" | "domain_policy"
  | "sandbox_policy" | "classifier" | "default_policy";
export type PermissionReasonCode =
  | "matched_deny_rule" | "matched_allow_rule" | "plan_restriction"
  | "auto_hard_deny" | "read_only" | "coordination_safe"
  | "domain_preapproved" | "domain_confirmation" | "sandbox_auto_allow"
  | "classifier_allow" | "classifier_deny" | "classifier_unavailable"
  | "confirmation_required" | "mode_transition";
export type PermissionOutcome = "allowed" | "denied" | "blocked" | "invalid" | "aborted" | "duplicate";
```

扩展 `PermissionResponse`：

```ts
interface PermissionResponse {
  behavior: PermissionBehavior;
  decisionSource: PermissionPolicySource;
  reasonCode: PermissionReasonCode;
  reason: string;
  request: PermissionRequest;
}
```

- [ ] **Step 4: Move explicit deny ahead of every allow fast-path**

在 `checkPermission` 构造 request 后首先检查 session/settings deny。之后才进入 WebFetch、Auto、coordination、Plan、read-only、allow 和 sandbox 分支。删除各 resolver 内重复且顺序不一致的 deny 判断。

每条返回值必须给出固定 `decisionSource/reasonCode`；human-readable `reason` 保持现有含义，不作为程序判断依据。

- [ ] **Step 5: Run GREEN**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts && npx tsx scripts/verify-permission-regression.ts && npm run build`

Expected: precedence matrix、历史 default/plan regression 和 build 通过。

### Task 2: Tool Input Boundary Before Side Effects

**Files:**
- Create: `src/tools/inputValidation.ts`
- Modify: `src/core/agenticLoop.ts`
- Test: `src/scripts/test-tool-permission-contract.ts`

- [ ] **Step 1: Add failing zero-side-effect tests**

注册一个 schema 为 `{ required: ["command"], properties: { command: { type: "string" }, mode: { enum: ["safe", "unsafe"] } } }` 的 probe Tool，并注入 Hook/Permission callback 计数器：

```ts
const result = await runTools(
  [{ type: "tool_use", id: "invalid-1", name: "ContractProbe", input: { command: 42 } }],
  { cwd },
  { preToolUseHookImpl, onPermissionRequest },
);
assert.equal(hookCalls, 0);
assert.equal(promptCalls, 0);
assert.equal(toolCalls, 0);
assert.match(toolResultText(result.executions[0].result.content), /invalid tool input/i);
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts`

Expected: FAIL，当前 Hook/Permission 在 Tool 内部输入检查前运行。

- [ ] **Step 3: Implement narrow validator**

`validateToolInput(schema, input)` 返回：

```ts
export interface ToolInputValidationResult {
  valid: boolean;
  issues: Array<{ field: string; code: "required" | "type" | "enum" | "item_type" }>;
}
```

只校验普通 object、required、string/number/integer/boolean/object/array、enum 和声明了简单 type 的 array items。`formatToolInputValidationError` 只输出字段名和 code，不输出字段值。

- [ ] **Step 4: Gate runOneToolBlock before Hook**

在 Tool lookup 后、`runPreToolUseHooks` 前调用 validator。失败时返回 `isError: true` 的安全 ToolResult，Permission outcome 为 `invalid`，并保证 Hook/Prompt/Tool 计数均为零。

- [ ] **Step 5: Run GREEN**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts && npm run build`

Expected: required/type/enum/item_type 断言通过，既有 Tool 类型仍编译。

### Task 3: Non-upgradable Deny and Entry-point Ask Resolution

**Files:**
- Modify: `src/permissions/permissionContract.ts`
- Modify: `src/core/agenticLoop.ts`
- Test: `src/scripts/test-tool-permission-contract.ts`

- [ ] **Step 1: Add failing Hook/bypass/entry matrix**

使用 `preToolUseHookImpl` seam 和显式 `entryPoint/askSource` 覆盖：

```ts
// policy deny + hook allow => zero execution
assert.equal(denied.executions[0].result.isError, true);
assert.equal(toolCalls, 0);

// ordinary ask + hook allow => one execution
assert.equal(hookAllowedCalls, 1);

// headless ask => deny; headless+bypass ask => execute
assert.equal(headlessCalls, 0);
assert.equal(bypassCalls, 1);

// policy deny + bypass => zero execution
assert.equal(bypassDeniedCalls, 0);

// background subagent ask => zero execution
assert.equal(backgroundCalls, 0);
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts`

Expected: FAIL，Hook allow 当前可覆盖 deny，entry/ask provenance 不存在。

- [ ] **Step 3: Implement fixed merge policy**

在 `permissionContract.ts` 增加纯函数：

```ts
export function applyHookPermissionBehavior(
  policy: PermissionResponse,
  hook: "allow" | "ask" | undefined,
): PermissionBehavior {
  if (policy.behavior === "deny") return "deny";
  if (hook === "ask") return "ask";
  if (hook === "allow" && policy.behavior === "ask") return "allow";
  return policy.behavior;
}
```

Hook blockingError 继续在 policy 前安全短路；Hook allow 不得修改 deny。

- [ ] **Step 4: Make ask resolution explicit**

扩展 `RunToolsOptions/QueryParams`：

```ts
entryPoint?: ToolEntryPoint;
askSource?: PermissionAskSource;
preToolUseHookImpl?: typeof runPreToolUseHooks;
```

默认值保持 legacy interactive/user。background 对 ask 直接 deny；其他入口仍调用已有 callback。最终 provenance 使用显式 ask source，不从 reason 文本推断。

- [ ] **Step 5: Run GREEN**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts && npm run test:trace && npm run build`

Expected: Hook/bypass/entry matrix 和旧 Trace 行为通过。

### Task 4: Query-scoped Tool Use Execution Ledger

**Files:**
- Modify: `src/core/agenticLoop.ts`
- Test: `src/scripts/test-tool-permission-contract.ts`
- Test: `src/scripts/test-recovery-lifecycle.ts`

- [ ] **Step 1: Add failing serial/concurrent/throw tests**

覆盖：

```ts
// 同一 ID 串行出现两次：call count = 1
// 同一 ID 在 concurrency-safe batch 出现两次：call count = 1
// 第一次 tool.call 抛错后再次出现相同 ID：call count 仍为 1
// deny/invalid 未执行的 ID 不占用 ledger，后续合法授权仍可执行
```

- [ ] **Step 2: Run RED**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts`

Expected: FAIL，当前每个 Tool Use block 独立调用 Tool。

- [ ] **Step 3: Add execution ledger**

`query()` 创建 `const executedToolUseIds = new Set<string>()`，每次 `runTools` 通过 `RunToolsOptions` 传入。`runOneToolBlock` 在 authorization/abort 后、backup/tool 前同步执行：

```ts
if (ledger.has(block.id)) return duplicateToolReturn(block);
ledger.add(block.id); // reserve before first await that belongs to execution
```

如果 file-history backup 或 `tool.call()` 失败，不移除 ID。invalid/deny/block/abort 在 reserve 前返回。

- [ ] **Step 4: Run GREEN**

Run: `npx tsx src/scripts/test-tool-permission-contract.ts && npm run test:recovery-lifecycle && npm run test:agents && npm run build`

Expected: duplicate ID 最多执行一次；PR-06 cancellation 和 Tool concurrency 回归保持通过。Windows `test:agents` 若只在最终 temp cleanup 报 EBUSY，记录环境限制，不误报功能失败。

### Task 5: Production Entry Propagation and Safe Trace

**Files:**
- Modify: `src/core/queryEngine/types.ts`
- Modify: `src/core/queryEngine.ts`
- Modify: `src/entrypoint/headless.ts`
- Modify: `src/agents/runAgent.ts`
- Modify: `src/agents/runAsyncAgent.ts`
- Modify: `src/tools/agentTool.ts`
- Modify: `src/tools/Tool.ts`
- Modify: `src/observability/toolLifecycle.ts`
- Modify: `src/scripts/test-trace.ts`
- Test: `src/scripts/test-tool-permission-contract.ts`

- [ ] **Step 1: Add failing provenance/privacy assertions**

断言 `permission.resolved` payload 精确包含：

```ts
{
  entryPoint: "headless",
  policyDecision: "ask",
  decisionSource: "default_policy",
  reasonCode: "confirmation_required",
  outcome: "allowed",
  resolutionSource: "bypass",
  prompted: false,
  executionAuthorized: true,
}
```

并确认序列化内容不含 Fake Secret、command、path、URL、Hook reason 或 Tool 正文。

- [ ] **Step 2: Run RED**

Run: `npm run test:trace && npx tsx src/scripts/test-tool-permission-contract.ts`

Expected: FAIL，现有 payload 只有 decision/source/prompted。

- [ ] **Step 3: Extend allowlisted Trace payload**

修改 `createPermissionResolvedPayload` 使用类型化字段。保留 `decision` 兼容 Inspector/旧消费者，但其值由 outcome 映射，不接收动态 reason。

- [ ] **Step 4: Propagate production entry metadata**

- QueryEngine 默认 `interactive/user`；
- `runHeadless` 使用 `headless`，无 bypass 为 `headless`，有 bypass 为 `bypass`；
- ToolContext 保存 parent ask source；
- foreground Child Agent 使用 `subagent` 并继承 parent ask source；
- async Child Agent 使用 `background_subagent/background`。

- [ ] **Step 5: Run GREEN**

Run: `npm run test:trace && npx tsx src/scripts/test-tool-permission-contract.ts && npm run test:agents && npm run build`

Expected: provenance/隐私断言、生产入口透传和 legacy callers 通过。

### Task 6: Evidence Closure and Documentation

**Files:**
- Modify: `package.json`
- Modify: `docs/evaluation/r1-invariant-to-evidence-matrix.md`
- Modify: `docs/README.md`
- Create: `docs/learning/E3/pr-07-tool-permission-safety-contract-dev-doc.md`

- [ ] **Step 1: Add focused Core Gate**

增加：

```json
"test:tool-permission-contract": "tsx src/scripts/test-tool-permission-contract.ts"
```

在 `verify:core` 中放在 recovery lifecycle 之后、provider characterization 之前。

- [ ] **Step 2: Update evidence matrix**

新增：

- `permission.deny-precedence-zero-execution`；
- `permission.entrypoint-resolution`；
- `tool.invalid-input-zero-side-effect`；
- `tool.execution-id-no-replay`；
- `permission.trace-explainable-safe`。

- [ ] **Step 3: Write Dev Doc and status handoff**

记录真实调用链、最终 precedence、入口矩阵、input validator 子集、ledger 语义、Trace allowlist、验证证据和限制。明确不声称跨进程幂等、语义去重、Sandbox/MCP 加固或副作用回滚；下一候选为 PR-08。

- [ ] **Step 4: Run final verification**

Run:

```powershell
npm run verify:core
git diff --check
node .gitnexus/run.cjs detect-changes --scope compare --base-ref github/main --repo easy-agent
git status --short
```

Expected: Core Gate 全绿；GitNexus 只报告预期 Permission/Tool/Agent/Trace 流；`AGENTS.md`、`CLAUDE.md` 保持未跟踪且不进入 PR。

## Commit Policy

本项目由用户执行最终 commit/push/PR。实施期间不提交，不推送，不创建 PR。阶段完成后提供一组精确 PowerShell 命令，只暂存本阶段文件，中文 PR 标题和详细中文 `--body`，明确排除 `AGENTS.md`、`CLAUDE.md`。
