# PR-06 / R1-F Streaming / Abort / Context Recovery 设计

## 1. 目标

在不改变 Agent Prompt、Tool Result 和 Permission 决策的前提下，为单次 Query 建立统一生命周期边界，使 Model Streaming、Abort/Timeout、Reactive Compact 和 max-token Recovery 共享可解释的终止与重启语义。

本阶段保持一个 PR，但只修改一条主链：

`QueryEngine -> query -> streamMessage / compactMessages / runTools`

## 2. 已确认的现状缺口

- `streamMessage` 已阻止 Partial Output 后的 API replay，但上层 `query` 不知道错误前是否已输出内容，因此无法对 Reactive Compact 做同等安全判断。
- `query` 只在每个 turn 开头检查 Abort；等待 Permission、Compaction 或一个 Tool 完成后，仍可能启动新 Tool、Hook 或 Restart。
- Reactive Compact 和 QueryEngine 提交前的 Auto Compact 未传递 Query AbortSignal，其内部的摘要 Model 请求无法跟随用户取消。
- QueryEngine 的优雅 Abort 返回目前可被记为 `query.finished(reason=aborted)`，与异常路径的 `query.aborted` 不一致。
- max-token escalation、continuation 和 reactive compact 共用 `stream_restart` 概念，但尚未形成对“丢弃部分输出”与“提交部分输出后续写”的显式契约。

## 3. 生命周期模型

### 3.1 终止类别

| 类别 | 来源 | 是否 Retry | 是否启动新业务步骤 | Query 结果 |
|---|---|---:|---:|---|
| `user_aborted` | QueryEngine 父 AbortSignal | 否 | 否 | `aborted` |
| `timeout` | Model/摘要请求的可控超时 | 受 PR-05 Retry Policy 约束 | 仅允许有预算的 Model retry | 预算耗尽后 `timeout` |
| `model_error` | permanent/provider protocol/恢复失败 | 否 | 否 | `model_error` |
| `blocking_limit` | 预检算达硬限 | 否 | 否 | `blocking_limit` |
| `completed` | 正常 stop reason | 不适用 | 按 Agentic Loop 继续 | `completed` |

Abort 优先级高于 Timeout：父 Signal 已取消时，不将同一结果误标为 Timeout。

### 3.2 边界规则

1. 每个可产生新副作用的边界都在进入前检查 Abort：Model Attempt、Compaction、Permission 返回后的 Tool Call、串行 Tool 的下一项、PostToolUse/Stop Hook 和 Stream Restart。
2. 已经启动的外部操作只能做 best-effort cancel；不承诺撤销已发生的文件、Shell 或网络副作用。
3. 并行 Tool batch 在 dispatch 前只检查一次；一旦 `Promise.all` 已发布，该 batch 视为已启动，Abort 只向已启动的 Tool 传递，后续 batch 不再发布。
4. 所有 Timer 和父 Signal listener 由创建它们的 request scope 在 `finally/dispose` 中清理。

## 4. Streaming 与恢复语义

`StreamErrorEvent` 增加不含原文的 `outputStarted` 布尔字段，上层不再根据错误文本猜测是否安全重启。

| 场景 | 部分输出 | 处理 |
|---|---:|---|
| 建流前 transient failure | 无 | PR-05 有预算 retry |
| 流中 failure | 有 | 保留已显示内容，不 replay，不 compact-restart |
| prompt-too-long | 无 | 最多一次 Reactive Compact，成功后 restart |
| 第一次 `max_tokens` | 有，但尚未执行 Tool | 丢弃本次 UI 暂存文本，以 64K 上限 replay 同一 Model turn；Usage 只按实际请求各计一次 |
| 升级后仍 `max_tokens` | 有 | 提交 truncated assistant message，注入 continuation message，不 replay 已提交内容 |

Reactive Compact 只能在 `outputStarted=false`、未取消、本 Query 尚未尝试过 Reactive Compact 时启动。Compaction 结束后再次检查 Abort，防止“用户已取消，摘要刚好返回”时重启 Model。

## 5. Abort/Timeout 传播

- 新增小型 request lifecycle helper，负责链接父 AbortSignal、可配置 Model Timeout、区分 abort cause 并清理 timer/listener。
- Model Timeout 默认使用保守的 10 分钟 request deadline，可通过 `EASY_AGENT_MODEL_TIMEOUT_MS` 调整；非正数或非法值回退默认值。
- 该 deadline 覆盖一次 Model Attempt，不覆盖整个多 turn Query。Timeout 仍由 PR-05 attempts/delay budget 约束，因此不会无限 retry。
- `compactMessages` 和其摘要 `createMessage` 接收同一 Query AbortSignal；QueryEngine 提交前的 Auto Compact 也必须纳入当前 Query 的 Controller。
- 用户 Abort 不生成友好化 Model Error，只产生一个 `turn_complete(reason=aborted)` 和一个 `query.aborted` Trace 终止事件。
- Timeout 使用稳定 `api_timeout` 类别，不与用户 Abort 混同。

## 6. 代码边界

- `src/services/api/`：拥有 request timeout/abort 合并和 Stream Attempt 资源清理。
- `src/context/compaction.ts` 与 `autoCompact.ts`：只负责传递 Signal，不决定 Query 是否 restart。
- `src/core/agenticLoop.ts`：拥有“是否启动下一业务步骤”和 Recovery guard，不自行实现 Provider timeout。
- `src/core/queryEngine.ts`：在提交前 Compaction 之前建立顶层 Controller、Trace Writer 和 `query.started`，并在唯一 `finally` 中释放；不重复底层分类逻辑。
- 不引入新依赖，不修改 Provider payload、Prompt、Permission outcome 或 Tool Result 格式。

Trace 终止映射固定为：

- `completed | blocking_limit | max_turns` → `query.finished`；
- `aborted` → `query.aborted`；
- `timeout | model_error` → `query.failed`，payload 只增加 allowlisted reason/error category。

无论是 generator 正常返回还是抛异常，同一 Query 只能写入一个终止事件。

## 7. 确定性证据

新增一个无网络 lifecycle/recovery 聚焦脚本，并纳入 `verify:core`：

1. pre-stream transient failure 可 retry，Partial Stream failure 不 retry/restart。
2. Abort 发生在 Model wait、Permission wait、Compaction wait 后，新 Model/Tool/Hook 计数不再增加。
3. request timeout 产生 `api_timeout`，中止底层 Signal，并清理 timer/listener。
4. prompt-too-long 最多触发一次 compact/restart；Compact 失败或仍超限时有界终止。
5. max-token escalation 不执行第一次 partial tool use，Usage 不重复计入同一请求；continuation 只提交一次 truncated output。
6. 顶层 Trace 对 completed/aborted/timeout/model_error 只产生一个匹配的终止事件，不保存 Prompt、Partial Output 或原始错误体。

## 8. 成功标准

- Abort 后不启动新 Model、Compaction、Tool 或 Hook 业务步骤。
- Timeout 可分类、可终止、可清理，且不误报为用户 Abort。
- Partial Stream 不被盲目 replay；Restart 和 Continuation 有明确不同的消息与 Usage 语义。
- Context Overflow 最多进行一次 Reactive Compact/Restart，blocking limit 依旧有界终止。
- 新不变量进入 Evaluation Matrix 和 `npm run verify:core`；现有 Core Gate 仍通过。

## 9. 非目标

- 进程崩溃后 Session Recovery、checkpoint/replay 或持久化任务恢复。
- E4 Context Provenance、Memory Policy 或自适应 Context Strategy。
- 撤销已完成的不可逆 Tool 副作用。
- 强制终止不支持 AbortSignal 的第三方调用或操作系统进程。
- 重写 1100+ 行 `agenticLoop.ts`、全面重构 Compaction 或引入通用 Workflow Engine。
