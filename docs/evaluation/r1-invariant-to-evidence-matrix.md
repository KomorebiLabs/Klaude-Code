# R1 Invariant-to-Evidence Matrix（PR-07 基线）

| Invariant ID | R1 承诺 | 确定性命令 | 证据文件 |
|---|---|---|---|
| `trace.schema-sequence-lifecycle` | Trace v1 schema、sequence 与终止生命周期有效 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `privacy.fake-secret-omitted` | Prompt、模型/Tool 正文和假 Secret 不进入 Trace/Evaluation | `npm run test:trace && npm run test:evaluation` | `src/scripts/test-trace.ts`, `src/scripts/test-evaluation.ts` |
| `permission.deny-zero-execution` | Permission Deny 后 Tool 调用计数为 0 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `permission.deny-precedence-zero-execution` | 显式 deny 高于只读、协调、预批准域名、Hook allow 与 bypass，且 Tool 调用计数为 0 | `npm run test:tool-permission-contract` | `src/scripts/test-tool-permission-contract.ts` |
| `permission.input-validation-zero-side-effect` | 非法 Tool 输入在 Hook、Permission Prompt、备份和 Tool 执行前失败 | `npm run test:tool-permission-contract` | `src/scripts/test-tool-permission-contract.ts`, `src/tools/inputValidation.ts` |
| `permission.entrypoint-resolution` | interactive/headless/subagent/background_subagent 的 ask 消解来源明确，只有显式 bypass 可在无头入口放行 ask | `npm run test:tool-permission-contract && npm run test:trace` | `src/scripts/test-tool-permission-contract.ts`, `src/observability/toolLifecycle.ts` |
| `tool.execution-at-most-once-per-query` | 同一 Query 内相同 tool_use_id 在串行、并发和异常重放下最多执行一次 | `npm run test:tool-permission-contract && npm run test:recovery-lifecycle` | `src/scripts/test-tool-permission-contract.ts`, `src/core/agenticLoop.ts` |
| `writer.failure-isolation` | Writer degraded/timeout 不改变 Query/Tool 主结果 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `retry.error-taxonomy` | Provider 细分类映射为 transient/permanent/rate_limited/provider_protocol | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `retry.bounded-policy` | Attempt、Backoff、Retry-After 与累计等待预算都有明确上界 | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `retry.partial-output-no-replay` | 任一用户可见部分输出都禁止重放当前 Stream Attempt | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `provider.common-semantics` | OpenAI Chat/Responses 与 Gemini 的 Tool Use、Usage、Stop Reason 均归一到公共 StreamResult | `npm run test:providerstream` | `src/scripts/test-providerstream-characterization.ts`, `src/scripts/__golden__/providerstream-characterization.golden.txt` |
| `provider.protocol-error-safe` | 非 SSE/协议错误映射为 provider_protocol，不回显 Provider Body | `npm run test:providerstream` | `src/scripts/test-providerstream-characterization.ts` |
| `lifecycle.abort-no-new-action` | Query 取消后不再启动新的 Model、Compaction、Tool 或 Hook 业务动作 | `npm run test:recovery-lifecycle` | `src/scripts/test-recovery-lifecycle.ts` |
| `lifecycle.timeout-bounded-cleanup` | 每个 Model attempt 有有界 deadline，父取消优先，timer/listener 在结束时释放 | `npm run test:recovery-lifecycle` | `src/scripts/test-recovery-lifecycle.ts`, `src/services/api/requestLifecycle.ts` |
| `stream.partial-output-no-restart` | Partial Stream 后既不 replay API attempt，也不触发 Reactive Compact/restart | `npm run test:resilience && npm run test:recovery-lifecycle` | `src/scripts/smoke-resilience.ts`, `src/scripts/test-recovery-lifecycle.ts` |
| `context.single-reactive-recovery` | Prompt-too-long 仅可在零输出时执行一次 Compact + Restart，重复溢出有界失败 | `npm run test:recovery-lifecycle` | `src/scripts/test-recovery-lifecycle.ts` |
| `trace.single-terminal-event` | completed/blocking/max-turns、aborted、timeout/model-error 映射到唯一且匹配的 Query 终止事件 | `npm run test:trace && npm run test:recovery-lifecycle` | `src/scripts/test-trace.ts`, `src/scripts/test-recovery-lifecycle.ts` |

统一门禁：`npm run verify:core`。本矩阵覆盖 PR-04 基础、PR-05～PR-06 可靠性承诺以及 PR-07 Tool/Permission 安全契约；PR-08 新承诺必须增量加入，不用测试数量或覆盖率替代证据映射。
