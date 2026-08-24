# R1 Invariant-to-Evidence Matrix（PR-04 基线）

| Invariant ID | R1 承诺 | 确定性命令 | 证据文件 |
|---|---|---|---|
| `trace.schema-sequence-lifecycle` | Trace v1 schema、sequence 与终止生命周期有效 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `privacy.fake-secret-omitted` | Prompt、模型/Tool 正文和假 Secret 不进入 Trace/Evaluation | `npm run test:trace && npm run test:evaluation` | `src/scripts/test-trace.ts`, `src/scripts/test-evaluation.ts` |
| `permission.deny-zero-execution` | Permission Deny 后 Tool 调用计数为 0 | `npm run test:trace` | `src/scripts/test-trace.ts` |
| `writer.failure-isolation` | Writer degraded/timeout 不改变 Query/Tool 主结果 | `npm run test:trace` | `src/scripts/test-trace.ts` |

统一门禁：`npm run verify:core`。本矩阵只覆盖 PR-04 时已经声明的 R1 核心不变量；PR-05～PR-08 新承诺必须增量加入，不用测试数量或覆盖率替代证据映射。
