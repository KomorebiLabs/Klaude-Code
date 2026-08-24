---
title: "Klaude-Code Docs"
date: 2026-08-04
updated: 2026-08-24
tags:
  - klaude-code
  - documentation
  - index
aliases:
  - 文档入口
  - Docs Index
status: active
---

# Klaude-Code Docs

> [!abstract] 文档管理原则
> 文档按照**面向谁、处于什么阶段、是否仍然有效**来组织，而不是按照复杂的技术名词层层拆分。`docs/README.md` 是唯一入口；新增文档前先判断它的读者和生命周期。

## 文件夹总览

```text
docs/
├── README.md                  # 唯一文档入口和规则说明
├── learning/
│   ├── E0/                    # 路线修复与早期阶段汇报
│   └── E1～E3/                # Trace、可靠性与安全阶段开发记录
├── superpowers/
│   ├── mainTask/
│   │   ├── MainTask.md        # 权威长期方向
│   │   └── Prompt.md          # 单 PR 开发窗口提示
│   └── plans/                 # 审计路线、阶段 PR 与 JIT 计划
└── archive/                   # 历史和已被替代的资料
```

> [!important] 当前目录的实际状态
> 上述目录来自当前 worktree 的实际文件。当前不存在 `docs/engineering/` 或 `docs/other/`，因此不把它们列为有效入口；已有文件不在本次路线修复中移动或重命名。

## 1. `learning/`：面向你的阶段汇报

这是**给项目负责人阅读的文档**，不是给主 Agent 执行任务的计划。

当前已有阶段汇报位于：

```text
learning/E0/
```

后续按需建立阶段目录时，文档应以“阶段汇报”的形式记录：

1. 这个阶段做了什么；
2. 实现后产生了什么效果；
3. 为什么选择这样做；
4. 涉及了哪些重要设计决策；
5. 遇到了哪些真实困难；
6. 困难是如何定位和解决的；
7. 哪些内容是面试重点；
8. 当前完成到什么程度；
9. 下一步是什么。

推荐文件风格：

```text
learning/E1/
├── phase-1-trace-foundation-report.md
├── phase-2-query-lifecycle-report.md
└── phase-3-reliability-report.md
```

这类文件应当使用清晰的中文解释，优先服务于你的阅读、复盘和面试准备。不要把大量 Agent 执行命令、内部任务拆解或临时调试过程直接堆进这里。

## 2. `superpowers/plans/`：面向主 Agent 的计划与执行文档

这是**给主 Agent 和执行流程使用的文档**，不是阶段汇报。

适合放入：

- 实现计划；
- 任务拆解；
- 执行方案；
- 文件修改清单；
- 测试和验证步骤；
- Agent/Subagent 的工作说明；
- 设计确认后的实施边界；
- 需要按步骤执行的工程任务。

当计划数量较少时，可以直接放在：

```text
docs/superpowers/plans/
```

命名建议：

```text
YYYY-MM-DD-<short-topic>.md
```

例如：

```text
docs/superpowers/plans/2026-08-24-r0-roadmap-repair-implementation-plan.md
```

计划文档应回答：

```text
要实现什么？
为什么现在实现？
修改哪些文件？
按什么步骤执行？
如何验证？
什么不在范围内？
```

## 3. `archive/`：历史和过时资料

`archive/` 用于保存仍有参考价值、但不应作为当前执行依据的资料，例如：

- 已被新路线替代的旧计划；
- 旧版文档索引；
- 已完成阶段的历史实施计划；
- 过时但能说明设计演进的文档；
- 不再适用于当前分支/目录结构的材料。

归档不等于删除。归档文件可以保留历史上下文，但必须避免被新 Agent 当成当前规则执行。

归档文件顶部最好标明：

```yaml
status: historical-reference
```

## 文档归属判断流程

新增文档时只问三个问题：

```text
第一问：主要给谁看？
  给项目负责人 → learning/E*
  给主 Agent 执行 → superpowers/plans/
  都不是 → 继续第二问

第二问：以后是否仍作为当前依据？
  是 → 放入对应的 learning/E* 或 plans 子目录
  否 → archive/

第三问：暂时无法判断归属？
  → 保持草稿状态并先确认，不创建含义模糊的新顶层目录
```

## 当前项目的阅读入口

### 你本人阅读

从对应阶段的 `learning/E*` 文件夹开始，优先阅读阶段汇报，而不是 Agent 计划。

### 主 Agent 接收任务

先读 `docs/superpowers/mainTask/MainTask.md`，再读阶段性 PR 安排和当前 Stage 的 JIT Plan。

### 新 Agent 接班

先读取：

1. 项目根目录 `CLAUDE.md`；
2. `docs/README.md`；
3. `docs/superpowers/mainTask/MainTask.md`；
4. `docs/superpowers/mainTask/Prompt.md` 中当前已授权 PR Stage；
5. [修订路线](./superpowers/plans/2026-08-24-enterprise-harness-revised-development-roadmap.md)；
6. [阶段性 PR 安排](./superpowers/plans/2026-08-24-enterprise-harness-staged-pr-plan.md)；
7. 当前 Stage 的 JIT Plan 和前序 Dev Doc/交接；
8. `archive/` 只在需要追查历史决策时阅读。

## 当前状态

- PR-00～PR-08：路线修复、Trace/Inspector、Evaluation Foundation、可靠性恢复、Tool/Permission 与 External Safety 已合并。
- PR-09 / R1-I Evidence Closure & Resume Release：实现完成，待验证、审查与合并；合并后 R1 标记为 evidenced。
- R1 后候选为 PR-10 Context Provenance、PR-12 Multi-Agent Contract 或 PR-14 Developer Diagnostics，由维护者单独选择和授权。
- 既有文档的历史归属暂不在本文件更新中强制调整；后续新增文档必须遵守本规则。

> [!warning] 维护底线
> 不要因为文档“看起来可以归类”就随意删除或覆盖。移动/重命名已有文档前，先确认内容、修复链接，并使用 Git 保留历史；纯粹更新规则时，只修改本 README 即可。
