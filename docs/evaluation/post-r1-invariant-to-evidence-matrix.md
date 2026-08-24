# Post-R1 Invariant-to-Evidence Matrix

R1 的 25 项发布矩阵保持冻结，后续 Enterprise Harness 能力在本矩阵中持续增加，不重写已经发布的 R1 口径。

| Invariant ID | 声明 | 确定性命令 | 证据文件 |
|---|---|---|---|
| `diagnostics.failure-explanation` | Trace 证据能解释 Retry、Restart、Permission、Tool 和 Query 结果，并给出有界恢复建议 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/traceAnalysis.ts` |
| `diagnostics.artifact-failure-isolation` | Artifact 缺失、损坏、截断或链接异常不会破坏 Doctor 和诊断报告 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/artifactReader.ts` |
| `diagnostics.safe-share-output` | 文本与 JSON 诊断报告不包含原始 payload、fake Secret 或绝对项目路径 | `npm run test:diagnostics` | `src/scripts/test-diagnostics.ts`, `src/diagnostics/render.ts` |
| `context.manifest-privacy` | Context Provenance 只记录白名单元数据，不记录 Prompt、Memory、路径或 Secret 正文 | `npm run test:context-governance` | `src/scripts/test-context-governance.ts`, `src/context/provenance/manifest.ts` |
| `context.budget-accounting` | 已加载 Context 来源拥有确定性的类别与 Token 估算，且不冒充 Provider 账单 | `npm run test:context-governance` | `src/scripts/test-context-governance.ts`, `src/context/provenance/types.ts` |
| `memory.path-isolation` | Memory 写入与归档拒绝路径穿越、保留路径、根目录/文件/归档目录链接逃逸 | `npm run test:memory-governance` | `src/scripts/test-memory-governance.ts`, `src/context/memory/governance.ts` |
| `memory.revision-conflict` | 更新和删除已有 Memory 必须携带当前 revision，不允许静默覆盖 | `npm run test:memory-governance` | `src/scripts/test-memory-governance.ts`, `src/context/memory/governance.ts` |
| `memory.expiry-recoverable-delete` | 过期 Memory 被标记 stale，删除采用可恢复归档且退出 active index | `npm run test:memory-governance` | `src/scripts/test-memory-governance.ts`, `src/tools/memoryDeleteTool.ts` |
| `compaction.invariant-retention` | Full Compaction 若遗漏必要任务约束则失败关闭并保留原消息 | `npm run test:context-governance` | `src/scripts/test-context-governance.ts`, `src/context/compactionInvariants.ts` |

统一门禁仍为 `npm run verify:core`。PR-10～PR-11 已关闭 Context Provenance 与 Memory Lifecycle 的诊断 gap；Sub-Agent Lifecycle 仍等待 PR-12～PR-13 建立证据。
