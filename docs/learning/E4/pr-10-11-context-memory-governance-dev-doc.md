# PR-10～PR-11 Context 与 Memory Governance Dev Doc

## 问题与边界

既有系统能拼装 System Prompt、加载 `MEMORY.md` 并执行 Compaction，但无法回答“哪些来源进入了请求、占用多少预算、Memory 是否可信/过期、更新是否覆盖了并发变化、压缩是否遗漏硬约束”。本 Slice 不建设向量检索、价格账单或自动语义冲突判断，也不改变既有 Permission、Retry、Tool 执行与 Provider 失败语义。

## 实际调用链

`QueryEngine.submitInternal()` 通过 `buildSystemPromptBundle()` 一次生成旧版兼容的 Prompt parts 与无正文 `ContextManifest`，随后在 Query 边界 best-effort 发出一条 `context.assembled`。Diagnostics 只聚合来源数、类别与 Token 估算。MemoryWrite/MemoryDelete 进入 `memdir.ts`，再由 `governance.ts` 完成版本校验、canonical containment、revision 比较与归档；`MEMORY.md` 索引只保留未过期、未归档条目。Full Compaction 在调用总结模型前建立 invariant snapshot，摘要缺少 marker 时保持原消息并报告失败。

## 关键决策

- Context Manifest 只持有稳定 ID、类别、资格、状态、字符数与确定性 Token 估算；不持有 Prompt、Memory 正文、绝对路径或 Secret。
- `buildSystemPrompt()` 保持 `Promise<string[]>` 兼容；新能力通过 `buildSystemPromptBundle()` 暴露。
- Memory schema v2 记录 source、created/updated/expires、revision；v1 继续可读，但明确标记 `legacy/unknown`。
- 已存在 Memory 的更新与删除必须提供当前 revision；冲突即时返回，不静默覆盖。
- 删除移动到真实 `.trash` 目录，不做不可恢复删除；根目录、目标文件、父目录和 `.trash` 链接均拒绝。
- stale/legacy 状态进入模型可见的治理清单与 Diagnostics；不把文件名、来源或模型输出视为可信输入。
- Compaction 保真采用窄、确定性的 snapshot 与 digest；日志只记录 digest/计数，不记录约束正文。

## 变更与证据

- Context：`src/context/provenance/`、`context.assembled`、Diagnostics 聚合与 `test:context-governance`。
- Memory：schema v2、MemoryWrite revision contract、MemoryDelete、目录诊断与 `test:memory-governance`。
- Compaction：`compactionInvariants.ts` 与失败关闭测试。
- Evaluation：Post-R1 Matrix 新增 6 项不变量；两组确定性测试进入 `verify:core`。

## 已知限制

- Token 仅为确定性估算，不等于 Provider billing；完整 input/output/cache/cost 汇总仍属后续工作。
- Context Manifest v1 聚焦系统 Prompt 来源；消息历史、附件、图片和逐项 Tool Result 的统一预算尚未纳入。
- Memory 不提供语义检索或自动事实冲突合并；legacy 文件需要在显式更新后升级为 v2。
- revision 检查面向当前单进程本地工作流，尚未提供跨进程文件锁或事务数据库。
- Context Trace 当前覆盖主 Query 提交边界；独立子 Agent 的 Parent/Child 关联由 PR-12～PR-13 处理。
