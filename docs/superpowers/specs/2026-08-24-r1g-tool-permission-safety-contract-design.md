# PR-07 / R1-G Tool / Permission Safety Contract 设计

## 1. 目标

PR-07 在不重构 Sandbox/MCP 的前提下，为 Tool 执行建立统一、可解释、可验证的安全契约：

```text
entry point × mode × policy source × final outcome × executed
```

核心原则：

> deny 不可升级；普通 ask 可由受信 Hook 或显式 bypass 消解。

本阶段必须证明：

- 显式 deny、模式限制和 hard-deny 在任何入口都不会执行 Tool；
- Hook allow 与 bypass 不能推翻 policy deny；
- 非法输入不会启动 Hook、Permission Prompt 或 Tool；
- 同一 Query 内已经开始执行的 `tool_use_id` 不会因恢复或重放再次执行；
- Permission Trace 能解释入口、策略来源、最终结果和是否授权执行，同时不保存 Tool 正文。

## 2. 当前真实调用链与问题

主链位于：

```text
QueryEngine / Headless / Sub-Agent
  -> query
  -> runTools
  -> runOneToolBlock
     -> runPreToolUseHooks
     -> checkPermission
     -> onPermissionRequest（仅 ask）
     -> fileHistoryTrackEdit（写工具）
     -> tool.call
     -> runPostToolUseHooks
```

当前存在以下不一致：

1. default/plan 的 read-only 与 coordination 快路径可能先于 deny rule，导致用户显式 deny 失效。
2. WebFetch 预批准域名先于显式 deny，系统预批准可能覆盖用户禁止。
3. `runOneToolBlock` 可用 PreToolUse Hook 的 allow 覆盖 `checkPermission` 返回的 deny，包括 Plan 限制和 Auto hard-deny。
4. Trace 的 Permission source 只有 `permission_engine | pre_tool_hook | user | headless | default_deny`，无法解释规则、模式、Classifier、Sandbox、domain policy 或 bypass。
5. Tool 自行校验输入发生在 `tool.call()` 内；因此无效输入仍可能先执行 Hook、Classifier 或 Permission Prompt。
6. Query 没有已执行 `tool_use_id` 账本，无法以 Harness 不变量明确证明同一调用 ID 不会重放不可逆副作用。

## 3. 方案选择

### 方案 A：只调整条件顺序

优点是改动少；缺点是没有稳定的 provenance/outcome 类型，入口矩阵仍依赖字符串 reason，也不能关闭重复执行和非法输入边界。

### 方案 B：统一安全契约（采用）

在现有 Permission Engine 上增加稳定决策元数据，统一优先级；在 Agentic Loop 增加输入门禁与 Query-scoped execution ledger；按入口透传安全上下文，并用聚焦矩阵锁定行为。

### 方案 C：重写完整 Policy Engine

会同时侵入 Sandbox、MCP、路径治理和 Secret Safety，超过 PR-07 范围，留待 PR-08 及后续阶段。

## 4. 类型化安全模型

### 4.1 Entry Point

稳定入口集合：

```ts
type ToolEntryPoint =
  | "interactive"
  | "headless"
  | "subagent"
  | "background_subagent";
```

- QueryEngine 默认 `interactive`；
- `runHeadless` 显式使用 `headless`；
- 同步 Child Agent 使用 `subagent`；
- 异步/后台 Child Agent 使用 `background_subagent`。

`bypass` 是 ask 的解析来源，不伪装成入口。

### 4.2 Policy Decision

保留现有 `behavior: allow | ask | deny` 兼容调用方，并增加稳定元数据：

```ts
interface PermissionResponse {
  behavior: "allow" | "ask" | "deny";
  decisionSource: PermissionDecisionSource;
  reasonCode: PermissionReasonCode;
  reason: string;
  request: PermissionRequest;
}
```

`reason` 继续面向人类；程序、测试和 Trace 只依赖 allowlisted `decisionSource/reasonCode`。

第一版来源至少覆盖：

- `explicit_deny`、`explicit_allow`；
- `mode_policy`、`hard_safety`；
- `read_only`、`coordination_policy`；
- `domain_policy`、`sandbox_policy`；
- `classifier`；
- `default_policy`。

### 4.3 Final Outcome

Tool orchestration 最终结果区分：

```ts
type PermissionOutcome =
  | "allowed"
  | "denied"
  | "blocked"
  | "invalid"
  | "aborted"
  | "duplicate";
```

- `denied`：Policy 或用户明确拒绝；
- `blocked`：Hook block 或 hard safety block；
- `invalid`：输入不满足 Tool Schema；
- `aborted`：Query 已取消；
- `duplicate`：同一 Query 内 `tool_use_id` 已开始执行；
- `allowed`：本次调用已获得执行授权，不等于 Tool 最终成功。

Tool 是否真正开始执行由 execution ledger 与 `tool.started` 共同证明，不能把“授权”误写成“执行成功”。

## 5. 不可覆盖优先级

保留 PreToolUse Hook 在 Permission Check 前执行的既有扩展语义，但把“执行顺序”和“决策优先级”分开。统一编排顺序：

```text
1. Query Abort / Tool Input Validation
2. Run PreToolUse Hook
3. Hook Block Short-Circuit
4. Compute Permission Policy
5. Resolve Policy + Hook with fixed precedence
6. Entry-point Ask Resolution
7. Duplicate Execution Gate
8. fileHistory backup / tool.call / PostToolUse Hook
```

Hook block 与 policy deny 都是不可升级的终止结果；Hook block 直接短路，避免被明确阻止的动作继续触发 Auto Classifier。第 5 步的逻辑优先级固定为：

```text
Policy Deny > Hook Ask > Hook Allow > Original Policy Allow/Ask
```

具体规则：

- 所有 policy deny 均为 final，Hook allow 和 bypass 不可升级；
- Hook block 始终阻止执行；
- Hook allow 仅能把普通 ask 提升为 allow；
- Hook ask 可把普通 allow 降级为 ask，但不能改变 deny；
- Headless 与 background subagent 对 ask 默认 deny；
- Headless bypass 仅将 ask 解析为 `allow_once`；
- interactive/subagent 通过现有 callback 解析 ask；无 callback 时 deny；
- 显式 deny 优先于 read-only、coordination、WebFetch preapproval、explicit allow 与 sandbox auto-allow；
- Auto hard-deny 与 Plan restriction 不进入 prompt，因此不存在“用户点允许后执行”。

## 6. Tool 输入与输出边界

### 6.1 输入

在 PreToolUse Hook 和 Permission 之前增加无依赖的轻量顶层 JSON Schema 校验，第一版只实现项目实际需要且可稳定解释的子集：

- 输入必须是普通 object；
- `required` 字段存在；
- property 的 `type` 支持 string/number/integer/boolean/object/array；
- `enum` 值必须匹配；
- array 的顶层 item type 在 schema 声明时校验。

第一版不实现完整 JSON Schema（`oneOf`、复杂 `$ref`、深层条件表达式等）。遇到未支持关键字时保持 Tool 现有内部校验，不伪造“完整验证”声明。

校验失败返回安全、固定结构的 Tool error：只包含字段名和失败类别，不回显字段值。并且：

```text
hookCalls = 0
permissionPromptCalls = 0
toolCalls = 0
```

### 6.2 输出

沿用现有 `truncateToolResult` 默认 100K 文本上限和多模态 Tool 自身 image size guard。Trace 仅保存 outcome、长度、truncated/contentOmitted 等 allowlisted summary。

PR-07 不改变 ToolResult 正文送回模型的既有语义，不建设 Secret Scanner；MCP 输出、诊断 Secret 与外部响应边界属于 PR-08。

## 7. 不可逆动作与重复执行

`query()` 创建 Query-scoped execution ledger，并传给每次 `runTools()`。Ledger 以 `tool_use_id` 为键：

- 仅在即将调用 `tool.call()` 前登记；
- 一旦登记，即使 `tool.call()` 抛错也不移除；
- 后续遇到相同 ID，返回 `duplicate` 安全错误，禁止再次执行；
- Permission deny、Hook block、invalid、abort 等未开始执行的调用不占用 execution ID。

登记必须发生在同步代码段中，再进入 `await tool.call()`，从而避免同一并发 batch 中重复 ID 的竞态。

Ledger 只保证相同 `tool_use_id` 的 Harness 重放安全，不尝试判断不同 ID 是否具有相同语义，也不承诺对进程崩溃后的跨进程重放去重。

## 8. Trace 与隐私

扩展 `permission.resolved` 的 allowlisted payload，至少包含：

- `entryPoint`；
- `policyDecision`；
- `decisionSource`；
- `reasonCode`；
- `outcome`；
- `prompted`；
- `executionAuthorized`。

`permission.requested` 仍只在真实调用交互 callback 前发出；headless/background 的自动拒绝不伪造用户 prompt。

禁止写入 Trace：

- Tool 输入值、命令、路径、URL、文件正文；
- Hook 输入输出正文；
- Permission reason 中可能包含的动态 Provider/Classifier 文本；
- Tool 输出或异常正文；
- Secret、环境变量值或 authorization 信息。

TraceSink failure 继续保持 best-effort，不改变 Permission 或 Tool 结果。

## 9. 确定性验证矩阵

新增一个无网络 PR-07 聚焦脚本并纳入 `verify:core`，至少覆盖：

1. default/plan/auto 中 explicit deny 均零执行；
2. Read、coordination tool、preapproved WebFetch 遇到 explicit deny 仍零执行；
3. Hook allow + explicit deny 仍零执行；
4. 普通 ask + Hook allow 可执行；
5. Headless ask 默认拒绝，Headless bypass ask 可执行，explicit deny + bypass 仍零执行；
6. Background subagent ask 默认拒绝；
7. Hook block 零执行；
8. invalid input 的 Hook/Prompt/Tool 调用数均为 0；
9. 同一 `tool_use_id` 在串行和并发输入中最多执行一次；
10. Tool 抛错后相同 ID 不重试；
11. Trace provenance/outcome 字段正确且 Fake Secret/正文不落盘；
12. 现有 Tool success/error、Permission Deny、并发顺序、PR-06 Abort gate 不回归。

证据矩阵新增至少：

- `permission.deny-precedence-zero-execution`；
- `permission.entrypoint-resolution`；
- `tool.invalid-input-zero-side-effect`；
- `tool.execution-id-no-replay`；
- `permission.trace-explainable-safe`。

## 10. 范围边界

PR-07 不做：

- Sandbox cwd、路径穿越、Shell wrapper、子进程回收；
- MCP Timeout、Server trust、MCP domain Trace；
- Secret Scanner 或 Diagnostic Bundle；
- 跨进程幂等、事务回滚或已完成副作用撤销；
- 对语义相同但 `tool_use_id` 不同的动作做启发式去重；
- 完整 JSON Schema 引擎或新增第三方依赖；
- Permission UI 重做或完整 Policy DSL。

这些边界分别属于 PR-08 或后续 R1+ 阶段。

## 11. 交付与后续

PR-07 作为单个独立 PR，从已合并 PR-06 基线开发。完成后更新 Core Gate、R1 Evidence Matrix、docs 状态与 E3 Dev Doc。下一候选是 PR-08 / R1-H Sandbox / MCP / Secret Safety，未经单独授权不启动。
