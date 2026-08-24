---
title: "E1 核心因果链 Structured Trace 执行计划"
date: 2026-08-06
updated: 2026-08-06
status: ready-for-review
roadmap_phase: E1
plan_role: just-in-time-implementation-plan
tags:
  - klaude-code
  - agent-harness
  - trace
  - observability
  - implementation-plan
---

# E1 核心因果链 Structured Trace 执行计划

> [!important] 计划定位
> 本计划只负责 E1 第一版核心因果链：**Trace Context → Model Attempt/Retry/Stream → Tool/Permission → 最小 Inspector**。它不提前实现 E2 的可靠性策略重构，不扩张到 Context、Memory、MCP、Sub-Agent 的完整领域 Trace，也不建设 E6 Evaluation Framework。

## 1. 目标与完成结果

在 Task 1–3 已完成的 Query 生命周期 Trace 上，建立一条能够解释真实 Agent 主循环的安全因果链：

```text
query.started
  → model.requested
  → retry.scheduled / stream.restarted（若发生）
  → model.completed / model.failed
  → tool.started
  → permission.requested / permission.resolved（若发生）
  → tool.completed / tool.failed
  → 下一轮 model.requested
  → query.finished / query.failed / query.aborted
```

E1 完成后应能回答：

- 一次 Query 进行了几轮模型调用；
- 某轮是否发生 API Retry 或 Stream Restart；
- 模型在哪一轮完成或失败；
- 模型请求了哪些类型的工具；
- Permission 在哪里、由什么来源作出决定；
- Tool 是否真正执行以及结果类别；
- 最终为何完成、失败或取消；
- 整条链是否遵守内容最小化和失败隔离。

## 2. 当前实现事实

### 2.1 已有 Trace 基础

- `src/observability/types.ts`
  - 已定义 Query、Model、Retry、Stream、Tool、Permission 等 v1 事件名；
  - `TraceSink.emit()` 支持可选 `spanId`；
  - 已有安全 Tool Input/Result Summary 类型。
- `src/observability/redaction.ts`
  - 提供递归脱敏、安全错误摘要和工具输入/结果摘要。
- `src/observability/traceWriter.ts`
  - 负责 sequence、JSONL 追加、最终脱敏和失败隔离。
- `src/observability/queryLifecycle.ts`
  - 负责 Query started/finished/failed/aborted 安全 payload。
- `src/core/queryEngine.ts:481`
  - `submitInternal()` 是顶层真实模型请求的汇聚点；
  - 当前在调用 `query()` 前创建 Writer 并发出 `query.started`；
  - 正常返回、异常/Abort 和 finally close 已接入。

### 2.2 Model/Retry/Stream 真实边界

- `src/core/agenticLoop.ts:639`
  - `query(params)` 管理 turn、usage、终止原因、Stream Restart 和 Tool 执行。
- `src/core/agenticLoop.ts:709`
  - 每轮 `streamMessage()` 调用是 Model Attempt 的 Harness 边界。
- `src/services/api/streaming.ts:334`
  - `streamMessage()` 内部维护 API attempt；
  - 仅在尚未产出内容时重试；
  - 通过 `retry` event 暴露 attempt、maxRetries、delay、category；
  - 不可重试、重试耗尽或中途失败通过 `error` event 暴露。
- `src/core/agenticLoop.ts:780`
  - Reactive Compaction 后通过 `stream_restart` 重启当前轮次。
- `src/core/agenticLoop.ts:822`
  - `max_tokens` 升级和续写会形成不同恢复路径。

### 2.3 Tool/Permission 真实边界

- `src/core/agenticLoop.ts:307`
  - `runOneToolBlock()` 是单 Tool 的统一真实执行边界；
  - 内部按顺序执行 PreToolUse Hook、Permission Check、可能的用户决策、`tool.call()`、结果截断和 PostToolUse Hook。
- `src/core/agenticLoop.ts:580`
  - `runTools()` 负责批次调度和结果聚合；存在并发安全 Tool 批次。
- `src/core/agenticLoop.ts:947`
  - `query()` 调用 `runTools()` 后才向 UI 发出 `permission_request` 和 `tool_use_done`；
  - 因此 UI event 不是精确的 Permission requested/resolved 或 Tool started 时间边界，Trace 不应只照抄 UI event。

### 2.4 其他调用方

- `src/agents/runAgent.ts:241` 也直接调用 `query()`；
- E1 必须保持新增 Trace Context 可选，避免破坏 Sub-Agent 和其他 legacy caller；
- Parent/Child Trace 的完整语义留到 E5，不在 E1 伪造。

### 2.5 GitNexus 状态

2026-08-06 查询 `easy-agent` 索引时出现：

```text
LadybugDB database version mismatch:
database version 42, current build storage version 40
```

本计划已停止重复调用 GitNexus，采用直接源码阅读和调用点搜索作为降级依据。真正修改每个目标符号前，新开发窗口仍应先尝试一次 upstream impact analysis；若同一版本错误仍存在，记录后直接使用本计划中的调用点和聚焦搜索，不得反复重试。

## 3. 设计约束

### 3.1 Trace Context

E1 需要一个轻量、可选的运行上下文，至少携带：

- 当前 `TraceSink`；
- 顶层 `traceId` 已由 Writer 持有，不重复由业务代码生成；
- 当前 turn/attempt/span 的关联信息由 Agentic Loop 生成或维护。

设计要求：

- `QueryParams` 中新增字段必须可选；
- 没有 Trace Context 时，`query()`、`runTools()` 和 `runOneToolBlock()` 行为不变；
- 不让 observability 模块反向依赖 UI；
- 不把 Trace Writer 放入全局单例；
- 不把完整 Message、Tool Input/Result 或 Error 对象传给 payload 构造器后直接序列化。

具体类型名和承载方式在 Task 4 实现前结合当前类型结构确定，优先复用 `TraceSink`，避免为 E1 建立过宽抽象。

### 3.2 Span 与编号

第一版建议：

- `turnId`：Agentic Loop 的逻辑模型轮次，从 1 开始；
- Model `spanId`：每次实际 `streamMessage()` 请求生成，Stream Restart 后的新请求应有新 Span；
- `attempt`：沿用 Streaming Retry event 的 API attempt；
- Tool `spanId`：每个 `toolUseId` 对应一个 Tool 执行 Span，必要时生成独立 ID；
- Tool/Permission 通过 `toolUseId` 和相同 Tool Span 关联。

不要把 `turnId`、API `attempt`、`sequence` 混为一个概念。

### 3.3 隐私边界

允许记录：

- model/provider 安全标识；
- turn、attempt、span；
- message/tool 数量；
- stop reason；
- usage；
- duration；
- error category 和固定/脱敏安全摘要；
- Tool Name、字段名、长度、Outcome；
- Permission Decision 与安全来源分类。

禁止记录：

- Prompt/System Prompt；
- Messages 或模型输出正文；
- Tool 完整输入/输出；
- Command、文件内容、stdout/stderr；
- Provider 原始响应；
- API Key、Token、Cookie、环境变量值；
- 未经映射的 Error/ToolResult/Message 对象。

### 3.4 失败隔离

- Trace emit/close 失败不得改变 Agent 主路径；
- 不在 Trace 失败处理内再次递归 emit；
- Trace 不改变 Retry、Abort、Permission 和 Tool Result；
- 不为了 Trace 等待额外网络或执行真实副作用。

## 4. Task 拆分与顺序

# Task 4A：Trace Context 与 Model Attempt 生命周期

## 4.1 目标

把 QueryEngine 创建的 `TraceSink` 可选传入 Agentic Loop，并为每次实际模型请求记录 requested/completed/failed。

## 4.2 预计涉及文件与符号

- 修改 `src/core/queryEngine.ts`
  - `QueryEngine.submitInternal()`；
  - 将当前 Writer 作为可选 Trace Context 传入 `query()`。
- 修改 `src/core/agenticLoop.ts`
  - `QueryParams`；
  - `query()`；
  - 每次 `streamMessage()` 前后建立 Model Span 和 Duration；
  - 区分成功返回、最终 Stream Error、Abort 与 Harness 终止。
- 新增或修改 `src/observability/` 中聚焦 payload mapper
  - 建议建立 `modelLifecycle.ts`，只负责 Model/Retry/Stream 的 allowlisted payload；
  - 从 `index.ts` 导出。
- 必要时扩充 `src/observability/types.ts`
  - 只增加 E1 实际需要的窄类型，不提前加入 E4/E5 领域模型。
- 更新 `src/scripts/test-trace.ts` 或使用一个现有 Streaming/QueryEngine 聚焦入口
  - 不新建多个重复脚本。

## 4.3 行为要求

- `model.requested` 在每次实际 `streamMessage()` 前发出；
- `model.completed` 只在该次 Stream 正常返回 `StreamResult` 后发出；
- `model.failed` 在该次请求形成最终不可恢复 Stream Error 时发出；
- Abort 不应被错误分类为普通 Provider Failure；
- Duration 以单调执行区间为含义，不依赖 event timestamp 相减；
- Completion payload 只记录 stop reason、usage、block 类型/数量等结构摘要；
- 不将 Model 文字内容写入 Trace。

## 4.4 风险点

- `streamMessage()` 内部一次调用可能包含多个 API Retry attempt；
- Reactive Compact 和 max-token escalation 会重新进入 `streamMessage()`；
- `turnId` 与实际 request span 并非一一对应；
- `streamMessage()` 在 error event 后可能返回空结果，必须避免同时写 completed 和 failed；
- QueryEngine、Sub-Agent 等调用方都依赖 `query()`，新增参数必须可选。

## 4.5 最小验证

集中确认：

1. 一个普通成功模型轮次产生 requested → completed；
2. 一个最终模型错误产生 requested → failed，不产生 completed；
3. Trace payload 不包含注入的 Prompt/模型正文/假 Token；
4. 未传 Trace Context 的既有 `query()` 调用仍能工作；
5. `npm run build` 通过。

根据实现复用已有测试入口，只增加能证明上述承诺的少量断言。

## 4.6 交付物

- 可选 Trace Context；
- Model lifecycle payload mapper；
- Model requested/completed/failed 主路径；
- Task 4 Dev Doc 的第一部分；
- 必要聚焦证据。

---

# Task 4B：API Retry 与 Stream Restart Trace

## 4.7 目标

将现有 Streaming Retry 和 Agentic Loop Stream Restart 决策安全接入同一模型因果链，不在 E1 重写 Retry Policy。

## 4.8 预计涉及文件与符号

- 修改 `src/core/agenticLoop.ts`
  - `query()` 对 Streaming `retry` event 的处理；
  - Reactive Compact、max-token escalation 和必要的续写恢复路径；
  - 复用 Task 4A Model Span/Turn 关联。
- 修改 `src/observability/modelLifecycle.ts`
  - Retry/Restart 安全 payload mapper。
- 仅在现有 event 信息不足时修改 `src/services/api/streaming.ts`
  - `streamMessage()`；
  - 优先消费已有 `retry` event，不把 Trace Writer 下沉到 Provider 层。

## 4.9 行为要求

- `retry.scheduled` 记录 attempt、maxRetries、delayMs、errorCategory；
- 不记录 `errorMessage` 原文，除非先映射为固定安全摘要；
- `stream.restarted` 区分至少：
  - `reactive_compact`；
  - `max_tokens_escalation`；
  - 若记录 continuation，名称必须与真实语义一致；
- API Retry 和 Stream Restart 不得混为同一事件；
- E1 只观测现有决策，不改变重试次数、Delay、Compaction 或 max-token 恢复行为。

## 4.10 风险点

- Retry event 属于同一次 `streamMessage()` 内部 API attempt；
- Stream Restart 会重新创建 Model Request Span；
- Partial Output 后现有代码不会 Retry，Trace 不能错误声称已重试；
- max-token 两阶段恢复存在“同一 turn 新 request”和“新 continuation turn”的区别。

## 4.11 最小验证

集中确认：

1. 一个可恢复 API Error 产生 retry.scheduled，随后模型完成；
2. 一个 Stream Restart 产生正确 reason，并在后续产生新的 Model Request Span；
3. Retry/Restart 接入不改变已有 UI event 次数和 Retry 决策；
4. Trace 不出现 Provider 原始 request/response/error body；
5. Build 和最相关的现有 Streaming Smoke 通过。

## 4.12 交付物

- Retry/Restart Trace；
- 清晰的 turn/request/attempt 关联；
- Task 4 Dev Doc 完整版；
- Task 4 聚焦验证记录。

> [!note] Task 4A/4B 是否同一提交
> 如果实现时确认二者共享同一组窄改动且拆开会造成半成品，可以作为一个 Task 4 实现窗口完成；文档中仍需分别解释 Model 生命周期与 Retry/Restart 语义。未经用户要求不自动提交。

---

# Task 5：Tool 与 Permission Trace

## 4.13 目标

在真实 Tool/Permission 执行边界记录 started/resolved/completed/failed，而不是从延迟的 UI events 反推。

## 4.14 预计涉及文件与符号

- 修改 `src/core/agenticLoop.ts`
  - `RunToolsOptions` 或窄 Trace 参数；
  - `runOneToolBlock()`；
  - `runTools()` 只负责必要透传，不重复 emit；
  - `query()` 将 Trace Context 传入 Tool 执行。
- 新增 `src/observability/toolLifecycle.ts`
  - Tool/Permission allowlisted payload mapper；
  - 复用 `summarizeToolInput()`、`summarizeToolResult()`、`createSafeMessage()`。
- 修改 `src/observability/index.ts`。
- 必要时窄幅调整 `src/observability/types.ts`。
- 更新现有 `src/scripts/test-trace.ts` 或最相关 Tool/Permission 测试入口。

## 4.15 精确事件边界

### Tool

- `tool.started`：Permission 已允许、真正执行 `tool.call()` 前；
- `tool.completed`：获得最终 Tool Result 并完成必要 PostToolUse 处理后；
- `tool.failed`：执行边界抛错或明确失败，使用安全错误分类；
- Permission Denied/Hook Blocked/Unknown Tool 不得伪装为成功执行。

### Permission

- `permission.requested`：实际需要用户/外部决策并即将等待时；
- `permission.resolved`：记录 allow/deny 与安全来源；
- Rule/Mode/Hook 直接 allow/deny 是否记录 resolved，应依据最终契约统一，不能伪造 requested；
- Headless 自动拒绝必须能与真实用户拒绝区分。

## 4.16 并发约束

`runTools()` 可能并行执行 concurrency-safe Tool：

- 每个 Tool 使用独立 Span；
- JSONL `sequence` 只代表事件写入顺序，不声称并行任务按模型 block 顺序完成；
- `toolUseId` 负责前后关联；
- 不通过共享可变 turn/span 状态造成并发串线。

## 4.17 Outcome 建议

第一版至少统一：

- `success`；
- `tool_error`；
- `permission_denied`；
- `aborted`；
- `timeout`；
- `unknown`。

不要在 E1 顺便重构 E3 的完整 Permission/Sandbox 状态模型。

## 4.18 最小验证

集中确认：

1. 一个成功 Tool：started → completed；
2. 一个 Permission Deny：Permission 事件可解释，且没有真正执行 Tool；
3. 一个 Tool Error：不写 completed success；
4. 两个并发安全 Tool 的 Span 不串线；
5. 完整 Tool Input/Result、命令和假 Secret 不进入 Trace；
6. Trace 失败不改变 Tool/Permission 结果；
7. Build 和一个最相关的 Tool/Permission Smoke 通过。

## 4.19 交付物

- Tool/Permission 生命周期 Trace；
- 安全 payload mapper；
- 并发关联语义；
- Task 5 Dev Doc；
- 必要聚焦证据。

---

# E1 收口：最小 Trace Inspector

## 4.20 目标

提供一个最小开发者入口，将单个 Trace JSONL 转为按 sequence 排序的安全时间线，证明事件可以被消费。

## 4.21 实现边界

优先建立一个窄模块和 CLI/script 入口：

- 复用 `readTraceEvents()`；
- 输入为受控 Trace Path 或 Trace ID；
- 输出 event type、sequence、turn/attempt/tool/reason/outcome 等安全字段；
- 未知事件忽略或以通用形式显示；
- 坏行沿用 Reader 容错；
- 不显示被省略的正文；
- 不建设交互 UI、Dashboard、诊断建议或导出包。

预计文件在实现时按现有 CLI 结构选择，候选为：

- `src/observability/traceInspector.ts`；
- 一个 `src/scripts/` 开发者入口，或现有命令体系中的最小只读命令。

在选择命令入口前需先读取当前 CLI command 注册方式，不能仅凭计划猜测具体命令文件。

## 4.22 最小验证

- 对一份包含 Model/Retry/Tool/Permission 的 Trace 输出稳定时间线；
- 顺序使用 `sequence`；
- 坏行不导致整个读取失败；
- 输出不包含 fixture 中的敏感正文；
- Build 通过。

## 4.23 交付物

- 最小 Inspector；
- 一份受控示例时间线；
- E1 阶段收口说明；
- 工程索引和状态更新。

---

## 5. 文档更新范围

E1 实施期间按实际进展维护：

- `docs/engineering/specs/harness-trace-event-contract.md`
  - 只在事件字段/语义确定后更新；
- `docs/engineering/specs/harness-trace-storage-and-privacy.md`
  - 若新增记录字段或存储边界，必须同步；
- `docs/engineering/dev-docs/task-4-model-attempt-retry-trace.md`
  - Task 4 实现事实；
- `docs/engineering/dev-docs/task-5-tool-permission-trace.md`
  - Task 5 实现事实；
- `docs/engineering/README.md`
  - E1 完成后更新状态和入口；
- `docs/superpowers/mainTask/MainTask.md`
  - 只有路线方向发生变化时才修订，不把实现日志堆入主任务书。

历史 Task 6 仍代表正式 Evaluation，不把 Inspector 重编号为 Task 6。

## 6. E1 明确不做

- 不重写 Retry Policy、Error Taxonomy 或 Streaming Recovery；这些属于 E2；
- 不完成 Tool Schema、Sandbox、MCP Trust Boundary；这些属于 E3；
- 不实现 Context/Memory 领域 Trace；这些随 E4 接入；
- 不实现 Parent/Child Trace；这些属于 E5；
- 不建设 F1–F7、Benchmark、真实模型报告或 GitHub Actions；这些属于 E6；
- 不记录 Prompt、Model Text、Command、File Content、stdout/stderr；
- 不使用 Dynamic Workflow；
- 不创建新 Worktree；
- 不自动 Commit、Merge、Rebase 或 Push。

## 7. 开发窗口与检查点

建议用两个聊天窗口完成 E1：

### 窗口 E1-A

- Task 4A：Trace Context + Model Lifecycle；
- Task 4B：Retry + Stream Restart；
- Task 4 Dev Doc；
- 集中聚焦验证；
- 停止并交接，不自动开始 Task 5。

### 窗口 E1-B

- 复核 Task 4 交接和 Git 状态；
- Task 5：Tool + Permission；
- 最小 Inspector；
- E1 文档/状态收口；
- 集中聚焦验证与最终 Diff 审查。

## 8. 每个窗口结束时必须交接

- 已完成 Task/Slice；
- 修改的文件与核心符号；
- 实际调用链和关键设计；
- 运行的验证及结果；
- 未运行的验证及原因；
- 失败、工具链阻塞和剩余限制；
- `git status --short --branch`；
- 与窗口开始相比新增的改动；
- 下一个**已授权**任务；
- 禁止自动进入的后续任务。

## 9. E1 最终完成标准

- Query/Model/Retry/Stream/Tool/Permission/Termination 可由一个 Trace 关联；
- Model Turn、Request Span、API Attempt 和 Tool Use ID 语义清晰；
- Tool 并发不会造成 Span 串线；
- 未传 Trace Context 的调用方行为兼容；
- Trace 不改变 Prompt、模型调用、Retry、Permission、Tool Result 或终止语义；
- 默认不持久化高风险正文和秘密；
- Writer/Inspector 故障不影响 Agent 主路径；
- 最小 Inspector 能输出安全时间线；
- 必要 Build/聚焦检查通过；
- Task 4、Task 5 和 E1 限制可由维护者解释；
- 未经用户明确指令，不自动进入 E2。
