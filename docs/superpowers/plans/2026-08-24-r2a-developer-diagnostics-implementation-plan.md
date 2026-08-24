# PR-14 Developer Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最新 Trace 与 Evaluation Artifact 转换成安全、可解释、可从 `/doctor` 和 CLI 消费的诊断报告。

**Architecture:** 新增独立 `src/diagnostics/` 领域，纯分析函数与文件发现分离；`/doctor` 仅 best-effort 调用聚合器，CLI 复用同一报告与渲染器。诊断不写回运行时，不扩展 Trace 正文。

**Tech Stack:** TypeScript、Node.js `fs/promises`、现有 Trace/Evaluation 类型、现有 observability redaction。

---

### Task 1：诊断类型与 Trace 分析

**Files:**
- Create: `src/diagnostics/types.ts`
- Create: `src/diagnostics/traceAnalysis.ts`
- Create: `src/diagnostics/render.ts`
- Create: `src/diagnostics/index.ts`
- Test: `src/scripts/test-diagnostics.ts`

- [x] 定义版本化 `DiagnosticReport`、`DiagnosticFinding`、`DiagnosticEvidence`、`DiagnosticRecovery` 和固定状态枚举。
- [x] 用受控事件先验证 Retry、Restart、Permission、Tool、Terminal、Trace degraded 与证据缺口场景。
- [x] 实现纯 Trace 分析，所有文本由固定模板和安全枚举组成。
- [x] 实现稳定文本/JSON 渲染，JSON 不携带原始 Event payload。
- [x] 运行 `npm run test:diagnostics`，所有诊断契约和隐私断言通过。

### Task 2：安全 Artifact 发现与 Evaluation 摘要

**Files:**
- Create: `src/diagnostics/artifactReader.ts`
- Modify: `src/diagnostics/types.ts`
- Modify: `src/diagnostics/index.ts`
- Test: `src/scripts/test-diagnostics.ts`

- [x] 在临时项目目录创建 Trace、Evaluation、损坏文件和 symlink fixture。
- [x] 只选择 `traces/` 中最新普通 `.jsonl` 与 `evaluations/<run>/result.json` 普通文件。
- [x] 统计 Trace 无效/截断行；Evaluation 只接受 schema、outcome、assertion、limitation 的窄形状。
- [x] 返回 basename/runId 安全引用，不返回绝对路径。
- [x] 验证 Artifact 缺失/损坏/链接时返回 unavailable 或 incomplete，而不是抛出。

### Task 3：项目报告与 `/doctor` 集成

**Files:**
- Create: `src/diagnostics/projectDiagnostics.ts`
- Modify: `src/core/queryEngine/commands/diagnostics.ts`
- Modify: `src/scripts/__golden__/queryengine-characterization.golden.txt`
- Test: `src/scripts/test-diagnostics.ts`

- [x] 聚合最新 Trace 分析和 Evaluation 摘要，生成单一 `DiagnosticReport v1`。
- [x] 在 `/doctor` 环境检查末尾 best-effort 追加固定格式摘要。
- [x] 对聚合器异常执行 catch，输出 unavailable；不得改变 command handled 结果。
- [x] 更新 Doctor characterization 的确定性输出。
- [x] 验证无 Artifact 和损坏 Artifact 均不破坏 `/doctor`。

### Task 4：安全 CLI 与持续 Evaluation

**Files:**
- Create: `src/scripts/diagnose-project.ts`
- Modify: `package.json`
- Modify: `src/evaluation/evidenceMatrix.ts`
- Create: `docs/evaluation/post-r1-invariant-to-evidence-matrix.md`
- Test: `src/scripts/test-diagnostics.ts`

- [x] 增加 `npm run diagnose -- [--json] [cwd]`，默认只输出文本，不写文件或联网。
- [x] 增加 `test:diagnostics` 并接入 `verify:core`。
- [x] 增加 Diagnostics 证据条目，证明解释正确性、Artifact failure isolation 和 Secret absence。
- [x] 验证文本与 JSON 均不包含 fake Secret、绝对 cwd 或原始 payload。

### Task 5：文档、审查与交接

**Files:**
- Create: `docs/learning/E8/pr-14-developer-diagnostics-dev-doc.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/README.md`

- [x] 记录问题、真实调用链、核心决策、变更、证据和限制。
- [x] 增加 `/doctor` 与 `npm run diagnose` 演示方式，明确不支持的 Context/Memory/Sub-Agent 解释。
- [x] 运行 `npm run verify:core` 与 `git diff --check`。
- [x] 使用 code-review-and-quality 做五轴自审，修复必须项。
- [x] 运行 GitNexus `detect-changes`；对陈旧索引与真实 Git diff 分别报告。
- [x] 输出仅包含本 PR 文件的中文 commit/push/`gh pr create` 命令，不提交用户的 `AGENTS.md`、`CLAUDE.md`。
