---
title: "Klaude-Code Enterprise Harness 阶段性开发与 PR 安排"
date: 2026-08-24
updated: 2026-08-24
status: maintenance-pause
plan_role: staged-pr-execution-register
roadmap: 2026-08-24-enterprise-harness-revised-development-roadmap.md
scope: R0-R3
---

# Klaude-Code Enterprise Harness 阶段性开发与 PR 安排

> **当前封箱状态：** PR-00～PR-11 与 PR-14 已完成实现和证据收口，项目近期没有活动 Stage。PR-12、PR-13、PR-15～PR-17 全部延期，只有用户重新授权后才能启动。当前事实入口见 [`docs/PROJECT-SNAPSHOT.md`](../../PROJECT-SNAPSHOT.md)。

> **For agentic workers:** 每次只执行本文一个已获用户授权的 PR Stage。进入代码实现前，必须为该 Stage 编写 Just-in-Time Implementation Plan，并使用 `executing-plans` 逐项执行。不得因为本文列出了后续阶段而提前修改后续文件。

**Goal:** 将修订后的 Enterprise Harness 路线转换为可逐 PR 实施、审查、验收和面试复盘的阶段安排。

**Architecture:** 以 Runtime Diagnostic Trace 提供运行因果证据，以独立 Evaluation Record/Artifact Store 提供受控评测证据；先完成 R1 可投递闭环，再按价值推进 Context、Multi-Agent、Diagnostics、Extension 和 Release。领域编号 E0–E9 表示能力域，PR 顺序由依赖和证据门决定。

**Tech Stack:** TypeScript 6、Node.js 22、React/Ink、Anthropic SDK、MCP SDK、llm-bridge、JSONL、本地文件系统、Git Worktree、GitHub Actions（后续阶段）。

---

## 1. 执行规则

### 1.1 PR 是最小授权与验收单位

- 一个 PR 只对应本文一个 Stage；一个 Stage 不跨多个 PR。
- 若实现期间发现范围明显超过约 1–3 个工作日或无法独立审查，先停止并把 Stage 重新拆分，经用户确认后再继续。
- 每个 PR 必须独立构建、独立验证、可单独回滚，不依赖尚未合并的未来 PR 才能成立。
- 文档、代码、聚焦验证和 Dev Doc 属于同一 Stage 的完整交付，不拆成“先代码、以后补证据”。
- 不把顺手重构、格式化、依赖升级或相邻能力塞入当前 PR；发现后登记为 Follow-up。
- 合并一个 PR 后，才根据真实代码状态编写下一 Stage 的文件级实施计划。
- Commit、Push、创建 PR、合并和删除 Worktree 均需用户另行明确授权。

### 1.2 每个 PR 的固定生命周期

```text
用户授权当前 Stage
  → 核对 worktree / branch / dirty files / ahead-behind
  → 阅读当前 Stage 的路线、ADR、Spec、前序 Dev Doc
  → GitNexus 探索与目标符号 upstream impact
  → 编写 Just-in-Time Implementation Plan
  → 实现与风险驱动验证
  → 更新 Dev Doc / 状态 / Evidence Matrix
  → 自审范围、隐私和非干扰性
  → 用户授权后 commit / push / PR
  → PR 合并后解锁下一 Stage
```

如果 GitNexus 索引不可用或版本不兼容，只尝试到能够确认根因；随后记录失败并改用源码、调用点和聚焦验证，不反复猜测。

### 1.3 统一 PR 验收包

每个 PR 必须提供：

1. **Problem**：当前真实缺口和不处理的后果；
2. **Boundary**：实际调用链、修改边界和明确非目标；
3. **Implementation**：修改文件/符号与关键决策；
4. **Evidence**：执行命令、预期/实际结果、失败说明；
5. **Safety**：隐私、权限、持久化、兼容性或不可逆副作用检查；
6. **Non-interference**：Trace/Diagnostics 不改变 Prompt、Provider 参数、Tool/Permission 结果和终止语义；
7. **Dev Doc**：实现事实、困难、限制和下一 Stage 的前置条件；
8. **Git scope**：只包含当前 Stage 文件，不吸收既有 dirty/untracked 用户文件。

状态只有在上述证据齐全时才能从 `in-progress` 变为 `evidenced`。

## 2. 总体里程碑

| 里程碑 | PR 范围 | 结果 | 是否阻塞投递版 |
| --- | --- | --- | --- |
| R0 Governance Ready | PR-00 | 路线、编号、状态和交接入口一致 | 是 |
| R1 Observability Ready | PR-01～PR-03 | Trace 可安全落盘、贯穿 Model/Tool/Permission 并可检查 | 是 |
| R1 Evaluation Ready | PR-04 | 有统一确定性评测入口和证据矩阵 | 是 |
| R1 Reliability Ready | PR-05～PR-06 | Retry、Provider、Streaming、Abort、Overflow 边界可解释 | 是 |
| R1 Safety Ready | PR-07～PR-08 | Tool/Permission、Sandbox/MCP/Secret 边界有证据 | 是 |
| Resume Release R1 | PR-09 | 承诺—实现—证据—材料闭环 | 是 |
| R2 Capability Depth | PR-10～PR-14 | Context/Memory、Multi-Agent、Diagnostics 增强 | 否 |
| R3 Ecosystem & Release | PR-15～PR-17 | 扩展治理、外部评测、兼容发布 | 否 |

本文不使用固定日历日期。复杂度采用相对投入：`S` 为短文档/窄改动，`M` 为一个垂直 Slice，`L` 表示必须在 JIT 计划阶段再次检查是否需要拆分；它不是工期承诺。

## 3. R0：治理基线

### PR-00 — R0 Roadmap Repair（S）

**建议分支：** `codex/r0-roadmap-repair`

**目标：** 让 README、`MainTask.md`、`Prompt.md` 和修订路线使用同一编号、执行图、状态定义和文档入口。

**主要交付：**

- 统一 E5 = Multi-Agent、E6 = Evaluation；
- 用证据门替换 E0→E9 严格串行图和失效的 2026 年 8 月周排期；
- Prompt 允许在 E1 后启动 E6-A，不再把 E4/E5 设为 Evaluation 的前置；
- 引入 `Foundation` 与 `Klaude hardening` 双维状态；
- 校正文档目录事实，并明确 E0 尚缺/已有的证据；
- 将本计划登记为后续 PR 顺序的执行入口。

**验收证据：** 三个入口文件对编号、R1 顺序、状态和下一授权任务不存在冲突；文档链接可解析；不修改运行时代码。

**非目标：** 不补 Trace 功能，不同步分支，不重排用户既有文档。

**合并后解锁：** PR-01。

## 4. R1：可投递 Enterprise Harness 闭环

### PR-01 — R1-A Trace Storage & Availability Contract（M）

**建议分支：** `codex/r1a-trace-storage-contract`

**目标：** 在扩展事件前收口 Trace 启用、降级、保留、关闭超时和兼容读取契约。

**主要交付：** Trace 与 Session Transcript 持久化关系的明确裁决；受控目录下 age/quota Retention；Writer close 时间预算；disabled/degraded 可见性；Query success/failure/abort 的真实落盘检查；统一 `test:trace` 入口。

**关键证据：** 挂起 Writer 不无限阻塞 Query；Retention 不越过受控 Trace 根；假 Secret/高风险正文不落盘；finished/failed/aborted/disabled-or-degraded 均有聚焦验证；Build 通过。

**停止条件：** 若需要迁移历史用户数据或改变默认隐私语义，先提交 ADR，删除型 Retention 在安全目录边界不可证明时保持禁用。

**非目标：** Model/Tool/Permission 新事件、Inspector UI、云存储。

**合并后解锁：** PR-02。

### PR-02 — R1-B Model / Retry / Stream Trace（M）

**建议分支：** `codex/r1b-model-stream-trace`

**目标：** 建立 Query → Model Request → Retry/Restart → Completion/Failure 的真实因果链。

**主要交付：** 独立的 Turn、Request Span、API Attempt 关联；model/retry/stream 事件安全 mapper；legacy caller 可选 Trace Context；成功、重试/重启和失败/中止证据。

**关键证据：** 使用相同 Mock 输入做 Trace on/off 成对验证，Prompt、Provider Params、Loop Events、Usage、Termination 和非 Trace 返回值相等；Partial Output 未重试时不产生虚假 Retry。

**停止条件：** 若记录事件要求改变 Provider Request 或 Streaming contract，停止并先修订 Trace Context/语义 ADR。

**非目标：** 改写 Retry Policy、统一全部 Provider、Tool/Permission Trace。

**合并后解锁：** PR-03。

### PR-03 — R1-C Tool / Permission Trace & Minimal Inspector（M）

**建议分支：** `codex/r1c-tool-permission-inspector`

**目标：** 在真实执行边界补齐 Permission/Tool 因果链，并证明 Trace 能被安全消费。

**主要交付：** requested/resolved、started/completed/failed 的真实边界事件；安全决策来源；并发 Tool 独立 Span；按 sequence 输出单 Trace 的最小 Inspector；坏行/未知事件容错。

**关键证据：** Tool success、Tool failure、Permission Deny 且执行计数为 0、两个并发 Tool 不串线；Inspector 不显示完整 Tool I/O、命令、文件正文或 Secret；Trace on/off 的执行结果一致。

**停止条件：** 若稳定 Tool Use ID 无法证明并发关联，先修正关联模型；UI Event 与核心边界冲突时以核心执行事实为准但不改变 UI 行为。

**非目标：** 完整 Permission 状态机、Sandbox/MCP 重构、Dashboard/Doctor。

**合并后解锁：** PR-04。

### PR-04 — R1-D Evaluation Foundation（M）

**建议分支：** `codex/r1d-evaluation-foundation`

**目标：** 建立后续能力共用的确定性评测入口和独立 Evaluation Artifact Store。

**主要交付：** Task/Trial/Grader/Result 窄契约；Invariant-to-Evidence Matrix；机器可读结果与 Markdown 报告；本地 `verify:core`；Evaluation Store 的 allowlist、脱敏、age/quota Retention 和安全删除；最小 CI 只使用 Fake Provider/fixtures。

**首批不变量：** Trace schema/sequence/lifecycle；隐私与假 Secret；Permission Deny 后 Tool 未执行；Writer degraded/timeout 不改变 Query 主结果。

**关键证据：** 本地与 CI 使用同一命令；每个 R1 承诺有断言和证据路径；产物不采集真实用户正文；报告能定位失败 Stage。

**停止条件：** 依赖真实网络或随机模型输出的 Grader 不进入 Core CI；隐私边界未完成前 Artifact 落盘禁用。

**非目标：** 真实付费模型、多仓库 Benchmark、LLM-as-a-Judge、通用评测平台。

**合并后解锁：** PR-05。

### PR-05 — R1-E Error Taxonomy / Retry / Provider Semantics（M）

**建议分支：** `codex/r1e-retry-provider-semantics`

**目标：** 统一 Harness 实际需要的错误类别、Retry Budget 和主要 Provider 最小语义。

**主要交付：** transient/permanent/rate_limited/provider_protocol 最小分类；Attempt/Backoff/Retry-After/Budget；Partial Output 后不盲目 Replay；主要 Provider 的 Tool Use、Usage、Stop Reason 和 Error Category characterization。

**关键证据：** transient retry→success；permanent→no retry；Backoff 不越预算；Partial Output 不重放；至少两个主要 Provider Profile 的公共字段证据。

**停止条件：** Provider 原始错误含 Secret 时只保留安全映射；无法可靠统一的字段保留 Provider-specific extension，不伪造公共语义。

**非目标：** Abort/Timeout、Context Overflow、进程恢复、自适应 Retry、全部 Provider 完全一致。

**合并后解锁：** PR-06。

### PR-06 — R1-F Streaming / Abort / Context Recovery（L，JIT 时强制复核范围）

**建议分支：** `codex/r1f-stream-abort-context-recovery`

**目标：** 证明中断、取消和上下文溢出不会造成重复副作用或错误终止语义。

**主要交付：** 建流前失败与 Partial Stream 区分；Restart/Continuation 边界；Abort/Timeout 资源释放；Reactive Compact 与 blocking limit；恢复过程接入既有 Trace/Evaluation。

**关键证据：** Partial Stream/Restart 不重复 Tool Use/Usage；Abort 后不启动新业务步骤；Timeout 释放可控资源；Overflow Recovery 保留关键约束；Evaluation Matrix 增量通过。

**停止条件：** 若同时修改 Streaming、Abort、Compaction 三个核心子系统导致无法独立审查，在写代码前提议拆成 R1-F1/R1-F2 两个 PR，并由用户重新授权；不得实现到一半再被动拆分。

**非目标：** 进程崩溃恢复、E4 Context Provenance/Memory、自适应上下文策略。

**合并后解锁：** PR-07。

### PR-07 — R1-G Tool / Permission Safety Contract（M）

**建议分支：** `codex/r1g-tool-permission-contract`

**目标：** 统一 Tool 输入输出安全契约、Permission 证据矩阵和高风险/不可逆动作边界。

**主要交付：** entry point × mode × decision source × outcome × executed 矩阵；deny/block 后不执行；路径/大小/timeout/错误安全摘要；删除、覆盖、Push、发布、权限提升和网络副作用治理；不可逆 Tool 不自动重试。

**关键证据：** 代表性 allow/deny/ask/block/bypass 路径；deny/block 执行计数为 0；不可逆动作在恢复路径中不重复；原有 Prompt/Tool Result 非目标行为保持兼容。

**停止条件：** 现有入口无法映射到统一 enum 时保留显式矩阵，不发明会丢失语义的总枚举；需要改变用户可见 Permission 行为时先形成 ADR。

**非目标：** Sandbox/MCP 内部实现、完整 Tool 重写、为每个 Tool 复制测试。

**合并后解锁：** PR-08。

### PR-08 — R1-H Sandbox / MCP / Secret Safety（M）

**建议分支：** `codex/r1h-sandbox-mcp-secret-safety`

**目标：** 收口外部执行、MCP 信任边界和诊断数据的 Secret Safety。

**主要交付：** cwd/路径穿越/进程/timeout/输出/回收边界；MCP Server/Tool 的 Permission、Timeout 和 Failure Isolation；必要 MCP Trace；Trace/Log/Error/Diagnostic 统一安全摘要。

**关键证据：** 路径穿越被阻止；MCP/Tool Timeout 不破坏主 Loop；外部 Tool 不绕过 Permission；假 Secret 不进入任何诊断渠道；受控正常路径不回归。

**停止条件：** 若必须依赖平台特定 Sandbox 才能满足承诺，明确降级矩阵并缩小 R1 支持声明，不以单平台结果冒充跨平台保证。

**非目标：** Extension Registry、Marketplace、公开插件分发。

**合并后解锁：** PR-09。

### PR-09 — R1-I Evidence Closure & Resume Release（M）

**建议分支：** `codex/r1i-evidence-closure`

**目标：** 用证据矩阵关闭 R1，而不是继续增加功能。

**主要交付：** R1 Claim-to-Evidence Matrix 最终版；一条端到端受控任务；至少一个 Bad Case→Root Cause→Fix→Regression 记录（可以引用前序 PR 的真实案例）；架构图、限制、演示脚本、README 状态和简历事实素材。

**关键证据：** 所有 R1 声明均指向代码、确定性检查、报告或 Dev Doc；无证据声明被删除或降级；Core 验证单命令通过；文档不把 inherited foundation 表述为独立从零实现。

**停止条件：** 任一安全/隐私/非干扰核心不变量失败时不得发布 R1 材料；真实模型实验若不稳定，只按逐 Trial 结果报告，不推断成功率分布。

**非目标：** 为了简历临时添加新能力、多仓库统计结论、正式发包或自动发布。

**合并后结果：** Resume Release R1；随后由用户从 R2 候选中选择下一个价值最高的 Stage。

## 5. R2：能力厚度增强（R1 后逐项授权）

R2 不设为 R1 的隐含前置。默认优先级为 Context/Memory → Multi-Agent → Diagnostics，但应根据 R1 Bad Case 和求职叙事重新排序。

### PR-10 — E4-A Context Provenance & Budget（M）

**状态：** 已与 PR-11 合并实施并完成统一验证。

**目标：** 解释上下文由哪些安全来源组成、为何进入、占用多少预算，不复制正文。

**交付/证据：** 来源类别、资格、规模和预算决策；Retry/Restart Usage 不重复统计；一条上下文预算受控场景；隐私检查。

**非目标：** Memory 检索、复杂 Prompt 优化、大规模 Benchmark。

### PR-11 — E4-B Compaction & Memory Governance（L）

**状态：** 已与 PR-10 合并实施并完成统一验证。

**目标：** 保留用户硬约束和关键工程状态，并把当前空实现的 Memory relevance 明确转化为窄、可验证能力或明确延期。

**交付/证据：** Compaction 保真；Memory provenance/时效/冲突/污染规则；一次过期或冲突 Memory 场景；不声称未实现的自动检索能力。

**停止条件：** 若“检索质量”无法用确定性 fixture 定义，先只做 lifecycle/provenance，不引入模糊语义搜索。

### PR-12 — E5-A Multi-Agent Contract & Worktree Baseline（M）

**状态：** deferred；未来恢复开发时的最高优先级候选，当前未授权。

**目标：** 定义 Goal/Input/Output/Owner/Dependency/Handoff、文件所有权与 Worktree baseline。

**交付/证据：** 冲突预检；fresh/head/specific commit 可解释；Parent/Child Snapshot 差异可见；子 Agent 拥有独立 Trace 身份。

**非目标：** Fleet 调度、自动 Merge、大规模并行。

### PR-13 — E5-B Multi-Agent Recovery & Integration（M）

**状态：** deferred；依赖 PR-12，当前未授权。

**目标：** 处理 Timeout、Partial Completion、失败交接和主会话最终责任。

**交付/证据：** 一个受控并行任务；失败/超时后状态、文件、验证和未完成项保留；删除 Worktree 前审计；主会话整合判断。

**非目标：** Dynamic Workflow、无人值守自治发布。

### PR-14 — E8 Developer Diagnostics（M）

**状态：** evidenced；Diagnostics v1 已完成，后续产品化增强延期。

**目标：** 将已有 Trace/Evaluation/Recovery 证据产品化为可演示的 Doctor、Timeline 和安全诊断包。

**交付/证据：** 有效配置来源；Retry/Permission/Compaction/Memory/Sub-Agent/Cost 解释；Recovery Guidance；诊断包隐私检查；用户无需读 JSONL 即可定位受控故障。

**非目标：** 重写底层 Trace、Package/CLI 身份迁移。

## 6. R3：生态、外部证据与发布（明确延期）

### PR-15 — E7 Extension Lifecycle Governance（L）

**状态：** deferred；当前未授权。

**目标：** 在真实 Plugin 基础存在后，统一 Skills/Hooks/MCP/Agent Definitions/Plugins 的 metadata、capability、provenance、compatibility、failure isolation 和 permission。

**启动条件：** 先确认 Plugin loading/scope 已有可信实现；如果仍为空缺，不以“治理”名义同时发明完整插件平台，应另立基础能力提案。

### PR-16 — E6-C Controlled External Benchmark & CI Expansion（L）

**状态：** deferred；当前未授权。

**目标：** 在安全副本上运行少量固定 Coding Tasks，形成真实 Trial、成本、失败分类和回归证据；按需要扩展 CI。

**约束：** 不预设仓库数/任务数；样本由 Invariant-to-Evidence Matrix 决定；真实 API 不进 CI；不从少量 Trial 推断统计成功率。

### PR-17 — E9 Compatibility, Packaging & Release（L）

**状态：** deferred；当前未授权。

**目标：** 分阶段完成 package/CLI identity、Settings/Session/Memory/Trace 数据兼容迁移、主要平台验证、Version/Changelog/Upgrade/Rollback。

**启动条件：** R1 已 evidenced，目标发布身份和兼容策略有 ADR；发布、tag、push、npm publish 等对外动作必须逐项获得用户授权。

## 7. PR 依赖与并行策略

```text
PR-00
  → PR-01 → PR-02 → PR-03 → PR-04
  → PR-05 → PR-06 → PR-07 → PR-08 → PR-09 (R1)
                                         │
                                         ├→ PR-10 → PR-11
                                         ├→ PR-12 → PR-13
                                         └→ PR-14

R2 证据稳定后：PR-15 / PR-16 → PR-17
```

近期 R1 默认串行，因为后一个 PR 会消费前一个 PR 的契约和证据入口。R2 的三条支线在接口稳定后理论上可并行，但单维护者默认仍逐 PR 推进，以减少分支漂移和上下文切换。

## 8. 每次开始和结束的检查清单

### 开始 Stage 前

- [ ] 用户明确授权了一个且仅一个 Stage；
- [ ] 核对 `pwd`、branch、`git status --short`、ahead/behind；
- [ ] 区分既有 dirty/untracked 文件与当前任务文件；
- [ ] 阅读权威路线、当前 Stage、前序 Dev Doc/交接和相关 ADR/Spec；
- [ ] GitNexus 索引可用性已确认；
- [ ] 对计划修改的函数/类/方法完成 upstream impact；
- [ ] HIGH/CRITICAL 风险已在编辑前告知用户；
- [ ] JIT Implementation Plan 已写明具体文件、步骤、命令和预期结果。

### 结束 Stage 前

- [ ] 目标行为和明确非目标均被复核；
- [ ] 聚焦 Build/Smoke/Evaluation 已运行并记录实际结果；
- [ ] 隐私、权限、持久化、兼容或副作用风险有对应证据；
- [ ] 失败被区分为代码回归、环境问题或工具问题；
- [ ] Dev Doc、状态和 Evidence Matrix 与代码一致；
- [ ] `git diff` 未吸收用户既有改动；
- [ ] 用户要求 Commit 前已运行 GitNexus `detect_changes`；
- [ ] 未经授权没有 commit、push、PR、merge、rebase 或 clean；
- [ ] 交接指向一个准确候选 Stage，或显式声明 maintenance pause 无活动 Stage。

## 9. 当前下一步

PR-00～PR-09 已形成 Resume Release R1，PR-14 Developer Diagnostics 与 PR-10～PR-11 Context/Memory Governance 已完成。本轮集中开发现已封箱，**当前没有授权中的下一 Stage**。未来恢复时优先重新评估 PR-12，但必须先核对最新代码与证据、获得用户授权并新建 JIT Plan，不能自动启动。
