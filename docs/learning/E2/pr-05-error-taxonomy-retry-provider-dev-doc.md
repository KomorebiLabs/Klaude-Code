# PR-05：Error Taxonomy / Retry / Provider Semantics 开发记录

## 问题

原有 API 层已能识别 429、529、5xx、认证、网络与上下文过长等细分错误，但 Harness 没有稳定的跨 Provider 分类；Retry 仅有次数上限，没有累计等待预算与可解释的停止原因；Provider 协议错误还可能将原始响应片段带入错误文本。

## 实际调用链与边界

- 流式路径：`streamMessage -> streamOnce -> Anthropic SDK | streamViaProvider -> decideRetry -> sleep`。
- 非流式路径：`createMessage -> callWithRetry -> decideRetry -> sleep`。
- 非 Anthropic Provider 在 `providerStream.ts` 边界将 OpenAI Chat、OpenAI Responses 与 Gemini 统一为 `StreamEvent/StreamResult`，上层 Agentic Loop 不感知 Provider 差异。

## 决策与改动

- 保留原 `APIErrorCategory` 作为诊断细节，新增 `HarnessErrorKind` 四类：`transient | permanent | rate_limited | provider_protocol`，避免破坏旧恢复分支。
- 新增 `ProviderProtocolError`；非 SSE 或 Provider Stream error 不再伪装成普通 400，也不携带原始 Response Body。
- `RetryDecision` 显式返回 attempt/maxAttempts、spent/remaining delay、delay 与 stop reason。默认累计等待预算为 200,000ms，覆盖旧默认十次重试的最坏 jitter 区间，不收紧原有正常语义。
- `Retry-After` 大于剩余预算时直接停止，不提前违反服务端指令，也不越过本地预算。
- 流式与非流式路径共用同一策略。一旦输出 text/tool-use 内容，当前 attempt 不再 replay，避免重复文本或工具副作用。

## 证据

- `npm run test:resilience`：覆盖四类 Harness 错误、transient retry success、permanent no retry、529 前台/后台策略、Retry-After/等待预算、Partial Output no replay。
- `npm run test:providerstream`：11 个无网络 characterization 场景锁定 OpenAI Chat/Responses 与 Gemini 的 Tool Use、Usage、Stop Reason；额外验证非 SSE 响应进入 `provider_protocol` 且不回显 body。
- `npm run test:trace`：旧 Trace 契约与脱敏仍通过。
- `npm run build`：TypeScript 构建通过。

## 遇到的问题

Provider golden 文件在 Windows checkout 下使用 CRLF，运行时 recording 使用 LF，造成纯换行符假失败。比对前统一换行符，未更新 golden 内容。

## 剩余限制

- Abort/Timeout 资源释放、Context Overflow 恢复、Partial Stream 保留/续传策略属于 PR-06。
- 本阶段不做自适应 Retry、进程崩溃恢复或所有 Provider 完全一致。
- Provider 的非公共字段仍留在各自翻译层，未为追求统一而伪造语义。
