# R1 Invariant-to-Evidence Matrix（PR-05 基线）

| Invariant ID | R1 承诺 | 确定性命令 | 证据文件 |
|---|---|---|---|
| `trace.schema-sequence-lifecycle` | Trace v1 schema、sequence 与终止生命周期有效 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `privacy.fake-secret-omitted` | Prompt、模型/Tool 正文和假 Secret 不进入 Trace/Evaluation | `npm run test:trace && npm run test:evaluation` | `src/scripts/test-trace.ts`, `src/scripts/test-evaluation.ts` |
| `permission.deny-zero-execution` | Permission Deny 后 Tool 调用计数为 0 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `writer.failure-isolation` | Writer degraded/timeout 不改变 Query/Tool 主结果 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `retry.error-taxonomy` | Provider 细分类映射为 transient/permanent/rate_limited/provider_protocol | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `retry.bounded-policy` | Attempt、Backoff、Retry-After 与累计等待预算都有明确上界 | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `retry.partial-output-no-replay` | 任一用户可见部分输出都禁止重放当前 Stream Attempt | `npm run test:resilience` | `src/scripts/smoke-resilience.ts` |
| `provider.common-semantics` | OpenAI Chat/Responses 与 Gemini 的 Tool Use、Usage、Stop Reason 均归一到公共 StreamResult | `npm run test:providerstream` | `src/scripts/test-providerstream-characterization.ts`, `src/scripts/__golden__/providerstream-characterization.golden.txt` |
| `provider.protocol-error-safe` | 非 SSE/协议错误映射为 provider_protocol，不回显 Provider Body | `npm run test:providerstream` | `src/scripts/test-providerstream-characterization.ts` |

统一门禁：`npm run verify:core`。本矩阵覆盖 PR-04 基础与 PR-05 可靠性承诺；PR-06～PR-08 新承诺必须增量加入，不用测试数量或覆盖率替代证据映射。
