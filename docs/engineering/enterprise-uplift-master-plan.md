---
title: "Easy-Agent 企业级 Harness 升级总控"
status: active
owner: "YangYiTao + Claude"
branch: enterprise-harness-upgrade
created: 2026-07-28
tags:
  - agent-harness
  - engineering-roadmap
  - reliability
  - evaluation
---

# Easy-Agent 企业级 Harness 升级总控

> [!abstract] 北极星目标
> 在**明确的高频日常 coding 工作流**中，让 Easy-Agent 成为可持续使用的本地终端 Agent，而不是功能演示集合；以可复现任务、可靠性数据、可诊断失败和安全边界逐步逼近 Claude Code / Codex 的 Harness 水准。
>
> 这不是“声称完全替代 Claude Code/Codex”的项目。是否能替代，必须由任务成功率、人工接管率、恢复成本与安全行为证据决定。

## 1. 约束与安全边界

| 约束 | 决策 |
| --- | --- |
| 原始工作区 | `main` 已有大量非本阶段的未提交变更；禁止在其中修改或清理。 |
| 开发分支 | `enterprise-harness-upgrade`。 |
| 隔离环境 | `.claude/worktrees/enterprise-harness-upgrade`。 |
| 上游推送 | 此 worktree 的 `origin` fetch URL 保留原地址，**push URL 已设置为 `DISABLED_NO_PUSH_TO_UPSTREAM`**；禁止绕过它。 |
| 提交/发布 | 未得到用户明确指令，不提交、不推送、不创建 PR。 |
| 影响分析 | 修改任何函数、类或方法前，按项目 `CLAUDE.md` 执行 GitNexus upstream impact analysis。 |
| GitNexus 状态 | 索引目前落后 HEAD 一个提交；2026-07-28 尝试 `npx gitnexus analyze` 时 Node/npx 发生 `exit 139` segmentation fault。修改前须重试或记录为工具链阻塞。 |

> [!warning]
> 不要将“Git 工作树隔离”误解为“已经可以随意改”。隔离解决的是不污染原工作区；影响范围、测试、回滚、权限和用户体验仍须逐项控制。

## 2. DeepSeek Harness JD → 项目能力矩阵

JD 的核心不是列出 Agent 术语，而是要求能在真实任务中把 **Model + Harness = Agent** 转化为研究、工程和产品闭环：

- 上下文管理、长期记忆、Subagent/Multi-Agent、长程任务；
- Model 与 Harness 深度适配；
- 基准测试、标注策略、实验和真实任务反馈；
- Agent Loop、Tool Use、Reasoning、Planning、Skills、MCP、Memory 的工程理解；
- 强开发者体验，以及对异常路径和失败场景的敏感性。

| 能力域 | 当前已见证据 | 当前缺口 | 对 JD / 面试信号 |
| --- | --- | --- | --- |
| 核心运行时 | `src/core/agenticLoop.ts`：多轮 loop、工具并发批次、abort、token warning、retry UI event | 缺少一条统一、持久、可关联的运行 trace | 不能只讲“有 loop”，要讲一次任务如何被观测和复盘。 |
| 工具/权限/沙箱 | 内置工具、MCP、`default/plan/auto`、sandbox 模块均存在 | 缺少针对真实任务的安全回归矩阵和策略可解释性证据 | 工程成熟度由允许/拒绝/降级是否可验证决定。 |
| 上下文与会话 | compaction、memory、plans、session history 已存在 | 缺少上下文质量和长程任务退化的量化评测 | JD 重点，适合作为后续研究/工程双向项目。 |
| 多 Agent | agents、async agents、teams、worktree 机制已存在 | 缺少协作成功率、成本、冲突和失败恢复的评估 | 先评测再扩能力，避免“多 Agent 只是并发”。 |
| Provider 适配 | Anthropic 与 provider translation 已存在 | 缺少一致性/退化策略的契约测试和真实矩阵 | 要能证明模型差异不会默默破坏工具调用。 |
| 可观测性 | debug log、UI 状态、部分 usage/retry event 已存在 | 缺少任务级 trace、结构化事件协议、回放/诊断入口 | **最高杠杆缺口**，是后续可靠性、评测、面试叙事的地基。 |
| Evaluation | 各 stage smoke / characterization scripts 存在 | 缺少面向真实 coding task 的基准、指标、回归门禁 | JD 明确要求提出 benchmark 与真实任务反馈。 |
| 工程交付 | TypeScript、npm build、多组 smoke 脚本 | 未见 CI workflow、质量门禁、发布/贡献治理证据 | 企业级不是“能 build”，而是变更可防回归。 |

## 3. 基线判断

### 已跨过 toy 阶段的原因

1. 项目不是单轮 prompt wrapper：存在多轮 `query()`、工具批处理、权限回调、hooks、session、compaction、MCP 和子 Agent 等相互作用的运行时。
2. 已有多个失败与恢复方向：API retry、输出 token recovery、阻塞 token limit、abort、sandbox、MCP timeout/cleanup。
3. UI 层已经消费运行时事件，而不是单纯打印模型文本。

### 尚未达到企业级项目门槛的关键原因

1. **不可证明**：没有统一任务 trace 和 evaluation contract，无法对“这次变更提高了还是降低了 Agent 成功率”给出证据。
2. **不可系统回归**：现有 smoke/characterization 测试多为模块或阶段脚本，尚不是按真实用户任务组织的持续评测系统。
3. **不可快速诊断**：当 Agent 失败时，缺少把用户请求、模型轮次、工具调用、权限决定、重试、上下文压缩、子 Agent 关联起来的可消费证据。
4. **交付治理薄弱**：当前未发现 CI workflow；项目质量主要依赖人工运行脚本。

## 4. 升级优先级

### P0 — 可观测性与任务评测地基（第一阶段）

**问题**：没有可信证据就无法判断任何“增强 Agent 能力”的效果，也无法把 Bad Case 转成回归测试。

**MVP 边界**：

- 定义内部结构化 `HarnessTraceEvent` 协议；
- 为每次顶层 query 创建 `traceId`，为每一轮模型调用创建 `turnId`；
- 覆盖最小关键事件：任务开始/结束、模型请求、流结束、工具开始/结束、权限决定、重试、压缩、错误/取消；
- 默认只写 JSONL 到本地 session trace 目录，设置长度/字段脱敏边界；
- trace 失败绝不能中断 Agent 主路径；
- 先提供开发者可读的诊断命令/入口，不做遥测上传、不做复杂 Web dashboard；
- 用 3–5 个固定真实 coding task 建立离线基准骨架与回归断言。

**非目标**：OpenTelemetry 云端平台、用户行为上报、分布式 tracing、全量 prompt 永久存储、自动评测平台。

### P1 — 真实任务回归与失败分类

在 P0 trace 支撑下，将典型任务写成可复现评测：文件定位、受控编辑、测试失败修复、权限拒绝后改道、MCP 失败、上下文压缩恢复。指标包括任务完成、工具错误、人工接管、token/时延和安全违规。

### P2 — 长程任务与上下文质量

先基于 P1 的失败证据，改进压缩/记忆/计划恢复。不要先增加“永久记忆”功能；先证明当前上下文在何时丢失了何种决策。

### P3 — Provider 与多 Agent 稳定性

用契约测试统一 provider event/tool-use 语义，之后再优化子 Agent 协同、worktree 合并和预算控制。

### P4 — 工程交付与产品闭环

引入 CI 质量门禁、发布流程、bug/feedback 模板、文档化真实用户反馈流程。这个阶段将把“功能项目”变成可持续迭代的开源工程项目。

## 5. 第一阶段成功标准

| 维度 | 可验收标准 |
| --- | --- |
| 关联性 | 单次顶层任务可通过一个 `traceId` 关联所有 turn、工具、权限、重试、终止原因。 |
| 完整性 | 成功、模型错误、工具错误、用户取消、权限拒绝至少各有可解析示例。 |
| 安全性 | 默认不记录 API key；工具参数/结果遵守字段截断与敏感值脱敏规则。 |
| 韧性 | trace writer 失败时 Agent 不失败；写入采用 best-effort 且可观测。 |
| 可读性 | 一条命令或一个最小入口可将 trace 还原成按时间排序的任务叙事。 |
| 回归 | 至少 3 个 deterministic fixture 覆盖成功工具链、权限拒绝、retry/异常路径。 |
| 成本 | 记录 trace 引入的本地 I/O、内存和 token 影响；不得把 prompt/模型行为改变作为副作用。 |

## 6. 后续执行节奏

1. **设计锁定**：先完成 trace 的事件契约、存储策略、脱敏策略与调用边界；写 ADR。
2. **影响分析**：GitNexus 可用后，对 `query`、`runTools`、QueryEngine/session storage 等目标符号逐一做 upstream impact analysis；高风险先告知用户。
3. **最小实现**：只实现 P0 MVP，保持现有 UI/Agent 行为兼容。
4. **验证**：build + existing characterization/smoke + 新 trace fixture。
5. **Bad Case 复盘**：将真实失败沉淀为 case 和 regression。
6. **教学与面试材料**：每个设计决策同步进入 `docs/learning/enterprise-upgrade/`。

## 7. 当前决策日志

- **2026-07-28**：选择“可观测性 + 评测地基”作为 P0，而不是优先添加更多 agent 功能。
  - 原因：已有大量能力模块；当前最高不确定性是无法判断其在真实任务中是否可靠。
  - 替代方案：先做 Multi-Agent/Memory/更强 Sandbox。
  - 拒绝原因：这些都会放大现有不可诊断、不可评测问题，且面试中很容易被追问“你如何证明有效”。
- **2026-07-28**：采用 JSONL 本地 trace MVP，而不是云端遥测平台。
  - 原因：支持本地 CLI、快速回放、隐私可控、无运营依赖。
  - 风险：查询能力有限；到需要跨用户/跨机器分析时再抽象 exporter。

## 8. 待解决问题

- GitNexus analyzer 在本机 Node/npx 发生 segmentation fault，如何恢复或替代影响分析流程？
- 当前 session/history 的路径、保留策略与隐私语义是什么？trace 应否与 session 同生命周期？
- `AgenticLoopEvent` 与 `QueryEngineEvent` 的现有事件边界，哪个是 trace 采集的主入口？
- trace 是否需要分别对 foreground、subagent、async agent 形成 parent-child 关联？
