# Context Provenance 与 Memory Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一个 PR 内建立安全 Context Manifest，并以其为基础完成 Memory 写入、冲突、过期、删除、来源与 Compaction 保真治理。

**Architecture:** `src/context/provenance/` 负责纯 Context 元数据和预算；`src/context/memory/` 负责版本化文档与文件生命周期；Compaction 只消费窄的 invariant snapshot。现有 `buildSystemPrompt()`、MemoryWrite Tool 和 Query 主路径保留兼容入口。

**Tech Stack:** TypeScript、Node.js `fs/promises`、现有 Trace/Evaluation/Diagnostics、确定性脚本测试。

## Global Constraints

- 不保存 Prompt、Memory 正文、Tool payload、绝对路径或 Secret 到 Trace/Diagnostics。
- 所有模型提供的文件名、来源、时间和 revision 都是不可信输入。
- deny 不可升级，ask 只可由既有 Hook/bypass 规则消解。
- 不实现语义向量检索、自动源码语义冲突判断或成本账单。
- `AGENTS.md`、`CLAUDE.md` 不纳入提交。

---

### Task 1：Context Manifest 与预算

**Files:**
- Create: `src/context/provenance/types.ts`
- Create: `src/context/provenance/manifest.ts`
- Modify: `src/context/systemPrompt.ts`
- Test: `src/scripts/test-context-governance.ts`

**Interfaces:**
- Produces: `buildSystemPromptBundle(options): Promise<{ parts: string[]; manifest: ContextManifest }>`
- Preserves: `buildSystemPrompt(options): Promise<string[]>`

- [x] 写入失败测试，证明来源类别、资格、加载状态、Token 合计存在且条目不包含正文。
- [x] 运行 `npm run test:context-governance`，确认因接口不存在失败。
- [x] 实现纯 manifest builder 和兼容 Prompt bundle。
- [x] 验证 ignore-memory 产生 omitted reason，旧 Prompt 渲染不变。

### Task 2：Context Trace、Diagnostics 与 Usage 边界

**Files:**
- Modify: `src/observability/types.ts`
- Modify: `src/core/queryEngine.ts`
- Modify: `src/diagnostics/types.ts`
- Modify: `src/diagnostics/traceAnalysis.ts`
- Test: `src/scripts/test-context-governance.ts`
- Test: `src/scripts/test-diagnostics.ts`

**Interfaces:**
- Consumes: `ContextManifest`
- Produces: 白名单 `context.assembled` Event 和安全 Diagnostics Summary

- [x] 写入失败测试，证明 Trace 只有类别、Token、状态和计数。
- [x] 在 Query 提交边界 best-effort 发出一次 manifest 事件，Retry/Restart 不重复发出来源。
- [x] 扩展 Diagnostics 聚合，不改变缺失事件时的兼容行为。
- [x] 验证 fake Secret、正文和绝对路径不进入 Trace/Diagnostics。

### Task 3：Memory schema v2、路径和 revision 冲突

**Files:**
- Modify: `src/context/memory/memoryTypes.ts`
- Modify: `src/context/memory/memdir.ts`
- Modify: `src/tools/memoryWriteTool.ts`
- Test: `src/scripts/test-memory-governance.ts`

**Interfaces:**
- Produces: `MemoryGovernanceStatus`、版本化 `MemoryDocument`、revision-aware `writeProjectMemory()`

- [x] 写入旧格式兼容、新格式 round-trip、来源枚举、过期和 revision 失败测试。
- [x] 写入绝对路径、`..`、入口文件、`.trash`、symlink 逃逸测试。
- [x] 实现 schema v2 解析/序列化和 canonical containment。
- [x] 实现 expected revision 冲突返回；不得静默覆盖。
- [x] 更新 MemoryWrite schema 和固定错误结果。

### Task 4：可恢复删除与索引一致性

**Files:**
- Create: `src/tools/memoryDeleteTool.ts`
- Modify: `src/context/memory/memdir.ts`
- Modify: Tool registry 的实际注册文件
- Modify: `src/core/queryEngine/commands/memory.ts`
- Test: `src/scripts/test-memory-governance.ts`

**Interfaces:**
- Produces: `archiveProjectMemory({ cwd, fileName, expectedRevision })`

- [x] 写入 revision mismatch、symlink、入口文件和成功归档测试。
- [x] 实现 `.trash` 内唯一归档名和索引原子重建。
- [x] 注册非只读 MemoryDelete Tool，并让 `/memory list` 显示治理状态。
- [x] 验证归档后正文仍可恢复、active index 不再引用它。

### Task 5：Compaction 关键约束保真

**Files:**
- Create: `src/context/compactionInvariants.ts`
- Modify: `src/context/compaction.ts`
- Test: `src/scripts/test-context-governance.ts`

**Interfaces:**
- Produces: `CompactionInvariantSnapshot` 与 `validateCompactionInvariantRetention()`

- [x] 写入硬约束、当前任务、未完成项的提取与 digest 测试。
- [x] 写入摘要遗漏关键项时 Full Compaction 保持原消息的失败测试。
- [x] 将 snapshot 作为窄保真要求加入总结请求并校验结果。
- [x] 验证 Trace/日志只记录 digest 和计数，不记录约束正文。

### Task 6：证据、文档与交接

**Files:**
- Modify: `package.json`
- Modify: `src/evaluation/evidenceMatrix.ts`
- Modify: `docs/evaluation/post-r1-invariant-to-evidence-matrix.md`
- Create: `docs/learning/E4/pr-10-11-context-memory-governance-dev-doc.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-08-24-enterprise-harness-staged-pr-plan.md`

- [x] 将两个确定性测试接入 `verify:core`。
- [x] 增加 Context/Memory/Compaction Post-R1 invariants。
- [x] 记录真实调用链、迁移兼容、安全边界、证据和限制。
- [x] 运行聚焦测试、`npm run verify:core`、`git diff --check` 和代码审查。
- [x] 运行 GitNexus detect-changes，并输出只含本 PR 文件的详细中文 PR 命令。
