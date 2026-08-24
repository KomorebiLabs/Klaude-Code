# Post-R1 Invariant-to-Evidence Matrix

R1 的 25 项发布矩阵保持冻结，后续 Enterprise Harness 能力在本矩阵中持续增加，不重写已经发布的 R1 口径。

| Invariant ID | 声明 | 确定性命令 | 证据文件 |
|---|---|---|---|
| `diagnostics.failure-explanation` | Trace 证据能解释 Retry、Restart、Permission、Tool 和 Query 结果，并给出有界恢复建议 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/traceAnalysis.ts` |
| `diagnostics.artifact-failure-isolation` | Artifact 缺失、损坏、截断或链接异常不会破坏 Doctor 和诊断报告 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/artifactReader.ts` |
| `diagnostics.safe-share-output` | 文本与 JSON 诊断报告不包含原始 payload、fake Secret 或绝对项目路径 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/render.ts` |

统一门禁仍为 `npm run verify:core`。PR-14 的报告只消费当前已有证据；Context Provenance、Memory Lifecycle 与 Sub-Agent Lifecycle 在对应后续 PR 建立证据前保持显式 gap。
