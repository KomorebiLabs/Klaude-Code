# R0 Roadmap Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 Klaude-Code 的路线编号、近期执行关系、状态表达、文档入口和新开发窗口顺序，为 PR-01 提供无冲突的权威基线。

**Architecture:** 本阶段只修订治理文档，不修改运行时代码。`MainTask.md` 继续定义长期方向，修订路线定义证据门，阶段性 PR 安排定义执行顺序，`Prompt.md` 只提供与该顺序一致的单 PR 启动提示。

**Tech Stack:** Markdown、Git、PowerShell 文本检查。

---

### Task 1: 统一根 README 的领域编号与状态

**Files:**
- Modify: `README.zh-CN.md`

- [ ] **Step 1:** 将 Enterprise Track 状态改成 `Foundation` / `Klaude hardening` 双维表达，并避免把 inherited foundation 当作 Klaude hardening 证据。
- [ ] **Step 2:** 统一 E5 = Multi-Agent / Worktree、E6 = Evaluation / Benchmark。
- [ ] **Step 3:** 用 R0→R1-A…R1-I 的证据门摘要替换旧的当前企业级位置和近期重点。
- [ ] **Step 4:** 将文档目录说明改成与当前实际存在的 `docs/learning/`、`docs/superpowers/mainTask/`、`docs/superpowers/plans/`、`docs/archive/` 一致；不宣称缺失的 `docs/engineering/` 入口有效。

### Task 2: 修订权威 MainTask 的依赖、状态和节奏

**Files:**
- Modify: `docs/superpowers/mainTask/MainTask.md`

- [ ] **Step 1:** 将主依赖链改为领域编号与执行顺序分离的 R1 证据门关系。
- [ ] **Step 2:** 明确 Runtime Diagnostic Trace 与 Evaluation Record/Artifact Store 分离，并允许 E6-A 在 E1 后启动。
- [ ] **Step 3:** 将 E0 状态改为双维状态，明确 Gap Matrix 等缺口，未完成前不标记 evidenced。
- [ ] **Step 4:** 将失效的 2026 年 8 月周计划标记为历史基线，改用 PR-00～PR-09 证据门。
- [ ] **Step 5:** 将全局状态规则改成 `Foundation` 与 `Klaude hardening` 两个维度。

### Task 3: 重写单 PR 开发窗口入口

**Files:**
- Modify: `docs/superpowers/mainTask/Prompt.md`

- [ ] **Step 1:** 将“一个窗口 2–3 个 Slice”改为一个窗口只执行一个已授权 PR Stage。
- [ ] **Step 2:** 用 PR-00～PR-09 顺序替换旧 E1→E5→E6 的窗口顺序，确保 E6-A Evaluation Foundation 位于 E1 后、E2/E3 前。
- [ ] **Step 3:** 每个窗口保留启动检查、边界、停止条件和禁止自动进入下一 PR 的约束。
- [ ] **Step 4:** 将 R2/R3 仅保留为后续候选，不允许 Prompt 将其视为 R1 前置。

### Task 4: 校正文档入口且保留用户既有组织意图

**Files:**
- Modify: `docs/README.md`

- [ ] **Step 1:** 保留当前未提交版本中“按读者与生命周期组织”的原则。
- [ ] **Step 2:** 用 `rg --files docs` 的真实结果校正目录树、阅读入口和权威文档关系。
- [ ] **Step 3:** 将“Task 4 是下一入口”改为 PR-00 已执行、PR-01 是下一候选入口，并链接两份 2026-08-24 路线文档。
- [ ] **Step 4:** 不移动、删除或重命名任何既有文档。

### Task 5: 文档一致性验证

**Files:**
- Verify: `README.zh-CN.md`
- Verify: `docs/README.md`
- Verify: `docs/superpowers/mainTask/MainTask.md`
- Verify: `docs/superpowers/mainTask/Prompt.md`

- [ ] **Step 1:** 搜索 E5/E6 映射，确认不存在 E5 Evaluation 或 E6 Multi-Agent 的活动路线表述。
- [ ] **Step 2:** 搜索旧严格串行/周计划/Task 4 下一入口表述，确认已删除或明确标记 historical。
- [ ] **Step 3:** 检查 Markdown code fence 成对、相对链接目标存在。
- [ ] **Step 4:** 用 `git diff --check` 检查空白错误，并审阅 task-scoped diff。
- [ ] **Step 5:** 报告现有 dirty files、未运行 Build 的原因和唯一下一候选 PR-01；不 commit、不 push、不创建 PR。
