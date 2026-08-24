# PR-05 / R1-E Error Taxonomy / Retry / Provider 实施计划

1. 在保留现有 `APIErrorCategory` 的前提下增加稳定 Harness 分类：`transient | permanent | rate_limited | provider_protocol`。
2. 将 Retry policy 建模为显式 attempts + total delay budget，输出稳定停止原因；Retry-After 超过剩余预算时不提前重试。
3. Streaming 与 non-streaming 共用同一 budget accounting；Partial Output 继续禁止 replay，并补确定性证据。
4. 使用现有 OpenAI Chat/OpenAI Responses/Gemini characterization 锁定至少两类主要 Provider 的 Tool Use、Usage、Stop Reason 公共语义，并统一 Error Class；无法统一的能力显式保留。
5. 扩充 resilience/provider characterization 与 Evaluation Matrix，运行 `verify:core`、相关测试、Build、diff check 和 change detection。

非目标：Abort/Timeout 资源治理、Context Overflow、进程恢复、自适应 Retry、全部 Provider 完全一致。
