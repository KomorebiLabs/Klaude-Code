# PR-02 / R1-B Model / Retry / Stream Trace 实施计划

## 目标与边界

建立 Query → Model Request → API Retry / Stream Restart → Completion / Failure 的真实因果链。只观测现有行为，不改变 Provider 请求、Retry Policy、Streaming 恢复、UI 事件、Tool 或 Permission 语义。

## 实施任务

1. 新增 Model Lifecycle 安全 mapper，只输出 model、turn、request span、attempt、usage、stop reason、block 计数、duration 和安全错误分类。
2. 在 `QueryParams` 增加可选 Trace Context，并由 `QueryEngine.submitInternal()` 传入当前 `TraceSink`；legacy caller 不传时行为保持不变。
3. 在 `agenticLoop.query()` 的真实边界记录：
   - 每次 `streamMessage()` 前 `model.requested`；
   - 正常返回后 `model.completed`；
   - 最终 stream error 后 `model.failed`；
   - 既有 retry event 对应 `retry.scheduled`；
   - 既有 reactive compact / max-token escalation 对应 `stream.restarted`。
4. 在现有 `test:trace` 中加入聚焦证据：成功、API Retry、Restart、失败、Partial Output 不虚报 Retry、隐私，以及相同 Mock 输入下 Trace on/off 的主路径结果和 Loop Events 一致。
5. 更新 PR-02 Dev Doc，运行 `test:trace`、最相关 Streaming/Resilience 检查、Build 和 GitNexus change detection（若 CLI 可用）。

## 停止条件

如果记录事件必须改变 Provider Request、Streaming event contract 或现有 Retry 决策，则停止实现并先修订语义设计。本计划不接入 Tool/Permission Trace，不建设 Inspector。
