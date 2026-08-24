# PR-06：Streaming / Abort / Context Recovery 开发记录

## 问题

原有 Streaming Retry 已禁止 Partial Output 后重放同一 API Attempt，但上层 Agentic Loop 不知道错误发生前是否已有输出，仍可能执行 Reactive Compact + Restart。Model request 没有统一 deadline；AbortSignal 未贯穿 preflight compaction；Tool/Hook 等等待边界也缺少一致的取消门禁。Query 的优雅取消还可能被记为普通 finished，无法从 Trace 区分 aborted 与 timeout。

## 实际调用链与边界

- 顶层：`QueryEngine.submitInternal -> compactMessages/autoCompactIfNeeded -> query`。
- Model：`query -> streamMessage -> streamOnce -> Anthropic SDK | streamViaProvider`。
- Non-streaming/Compaction：`compactMessages -> createMessage -> callWithRetry -> Provider`。
- Tool：`query -> runTools -> runOneToolBlock -> permission -> backup -> tool.call -> PostToolUse hook`。
- Trace：`QueryEngine.submitInternal` 拥有 Query Controller、Writer 和唯一 terminal emission。

## 决策与改动

- 新增 request-scoped lifecycle，将父 AbortSignal 与默认 10 分钟 Model deadline 合并；`EASY_AGENT_MODEL_TIMEOUT_MS` 可覆盖 deadline。父取消优先于 timeout，结束时清理 timer 与 parent listener。
- Streaming 与 non-streaming 每个 Attempt 独立拥有 lifecycle scope。错误只暴露固定安全的 timeout/abort 文本，不复制 Provider Body。
- `StreamErrorEvent.outputStarted` 显式告诉 Agentic Loop 是否已有用户可见输出。Partial Stream 后禁止 API replay、Reactive Compact 和 Restart。
- Prompt-too-long 只在 `outputStarted=false` 时允许一次 Compact + Restart；第二次溢出直接按 model error 结束，防止无限恢复。
- AbortSignal 贯穿 pre-submit compaction、summary Model request 和 Agentic Loop。在 Hook、Permission、Compaction 等 await 返回后重新检查，取消后不启动新的 Model、Compaction、Tool 或 Hook。
- `runOneToolBlock` 在 permission 后、backup/tool 前以及 tool 后/PostToolUse 前设置门禁。已经开始或已经完成的 Tool 副作用不会伪装成可回滚事务。
- Query terminal 映射统一为：`completed | blocking_limit | max_turns -> query.finished`，`aborted -> query.aborted`，`timeout | model_error -> query.failed`。失败 payload 仅保留 allowlisted reason/category。

## 确定性证据

- `npm run test:recovery-lifecycle`：覆盖父取消、timeout、dispose、Attempt Signal、Retry backoff 取消后零新 Attempt、Partial Output no replay/restart、单次 Reactive Compact、max-token escalation/continuation、Compaction Abort、Permission wait 后零 Tool 执行、timeout reason 和安全 terminal payload。
- `npm run test:resilience`：保留 PR-05 Retry Budget、错误分类和 Partial Output no replay 证据。
- `npm run test:providerstream`：保留三类 Provider 公共 StreamResult 语义。
- `npm run test:trace`：Trace schema、脱敏、Writer isolation 与 Model restart 回归。
- `npm run test:agents` 的全部功能断言与 `npm run build`：Legacy caller 和 TypeScript 契约回归；Windows 上测试末尾删除临时目录持续出现 `EBUSY`，不属于功能断言失败。
- `npm run verify:core`：统一 Core Gate，已纳入 PR-06 聚焦脚本。

## 遇到的问题

`test:queryengine` 的 golden 由 macOS 环境生成，并会读取宿主用户 settings；在 Windows 上存在模型 profile、PowerShell 工具、Sandbox、Clipboard、路径分隔符和换行符差异。它不能在当前环境中证明或否定本 PR 的 Query 生命周期改动，因此没有更新 golden，也没有把宿主配置写入仓库。PR-06 使用无网络 lifecycle/recovery 测试、Trace 测试和 build 作为有效证据。

## 剩余限制

- 不回滚已经完成的 Tool、Hook 或文件系统副作用；本阶段保证的是取消后不再启动新动作。
- 不处理进程崩溃恢复、跨进程 checkpoint/resume 或 E4 Memory。
- Provider 在底层调用已经开始后能否立即停止，取决于对应 SDK 对 AbortSignal 的支持；Harness 会停止后续恢复和副作用。
- 不建设全领域 Trace 或 Inspector 新功能。
- 下一候选是 PR-07 / R1-G Tool / Permission Safety Contract，需单独授权后启动。
