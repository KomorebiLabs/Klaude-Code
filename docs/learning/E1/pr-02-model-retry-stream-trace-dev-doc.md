# PR-02：Model / Retry / Stream Trace 开发记录

## 问题

PR-01 已保证 Trace 独立存储与可用性，但一次 Query 内部的实际模型请求、API 重试、流重启和最终结果仍不可关联。事件名已存在于 v1 契约，不代表运行路径已经接入。

## 真实调用链与边界

`QueryEngine.submitInternal()` 创建顶层 `TraceSink`，随后调用 `agenticLoop.query()`。`query()` 的每次 `streamMessage()` 调用代表一个 request span；`streamMessage()` 内部可能包含多个 API attempt，并通过既有 `retry` event 暴露重试决策。Reactive Compaction 与 max-token escalation 在 `query()` 中重新进入当前逻辑 turn，并创建新的 request span。

直接调用 `query()` 的 Sub-Agent 与其他 legacy caller 不强制提供 Trace Context。本阶段没有把 Writer 下沉到 Provider 层。

## 决策

- `turnId` 是逻辑模型轮次；request `spanId` 是一次 `streamMessage()` 调用；`attempt` 是同一 request span 内的 API attempt；JSONL `sequence` 只是写入顺序。
- Trace Context 和 deterministic stream seam 均为可选参数；不传时执行路径保持原状。
- `model.completed` 表示一次 stream request 正常返回，即使其 stop reason 随后触发 max-token restart。
- 可恢复的 prompt-too-long request 只记录 restart，不误报最终 `model.failed`；不可恢复错误记录 failure，aborted 使用独立 outcome。
- Provider 错误正文不进入 payload。失败只记录分类和固定摘要，避免通用脱敏后仍残留原始响应正文。
- API Retry 复用现有 retry event；Partial Output 后既有 streaming 层不产生 retry event，因此 Trace 不会虚构重试。

## 实际改动

- 新增 `modelLifecycle.ts`，构造 model requested/completed/failed、retry scheduled、stream restarted 的 allowlisted payload。
- `QueryEngine.submitInternal()` 将当前 Writer 作为可选 Trace Context 传入 `query()`。
- `agenticLoop.query()` 在真实 request、retry、restart、completion 和 final failure 边界旁路 emit；不改变 UI events、请求参数、Retry Policy 或返回值。
- `test:trace` 增加 Trace on/off 成对 Mock、retry、max-token restart、final failure、abort、Partial Output 和隐私断言。

## 证据

- 相同 Mock 输入下 Trace on/off 的 Provider Params、Loop Events、Usage、Termination 和完整非 Trace 返回值深度相等。
- success 产生 requested → completed；retry 产生 requested → retry.scheduled → completed。
- max-token restart 产生新 request span；final failure 不产生 completed；Partial Output failure 不产生虚假 retry。
- Prompt、System Prompt、模型正文、Partial Output、Token 和 Provider 错误正文均不进入 Trace payload。
- `npm run test:trace`、`npm run test:resilience` 与 `npm run build` 通过。
- `npm run test:agents` 两次均完成前 9 组断言，随后在 Windows 临时目录清理阶段因 `EBUSY` 退出；未观察到 Agent 行为断言失败，该环境限制不被记为通过。
- GitNexus `detect-changes --scope all` 报告 HIGH：变更命中 `query()` / `submitInternal()` 并影响 15 条主 Query、Headless 与 Sub-Agent 流程，符合本阶段已声明的核心路径范围。

## 剩余限制

- 本阶段只观测现有 Retry/Restart 决策，不统一错误分类、Retry budget、Retry-After 或 Streaming Recovery；这些属于 PR-05/PR-06。
- Reactive Compaction 的真实 compaction 集成路径由既有行为负责，本阶段聚焦验证 restart mapper 与 max-token 重启主路径。
- Tool/Permission 因果链和最小 Inspector 属于 PR-03。
