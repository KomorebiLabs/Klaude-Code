# Klaude-Code

**Klaude-Code 是基于 [ConardLi/easy-agent](https://github.com/ConardLi/easy-agent) 的独立延伸项目，正在向生产型 Agent Harness 演进。**

![](./public/img/banner.jpeg)

> **项目身份：** Klaude-Code 不是官方 `easy-agent` 仓库，也不代表原作者的立场。它是在开源基础上独立维护和继续演进的项目，拥有自己的工程路线，重点关注可观测性、可靠性、安全、评估和多 Agent 工作流。

Klaude-Code 探索如何通过 **Agent Harness**，将 Coding Model 转化为可靠、可观测、可扩展的本地开发系统。项目由一名在读本科生独立维护，在实践中持续学习 Agent 工程与开源协作。

如果你发现问题、产生了想法，或希望讨论项目方向，欢迎在 [Issues](https://github.com/KomorebiLabs/Klaude-Code/issues) 中留言。

Klaude-Code 是一个长期演进的 TypeScript / Node.js 本地 Agentic Coding System 项目。仓库保留了原始 Easy Agent 实现路线所建立的功能基础，同时新增独立的企业级 Harness 路线：把已有 Agent 能力逐步变成适合真实编码工作流的、可观测、可恢复、可评估、安全且可维护的系统。

> English version: see [README.md](./README.md)

## 致谢

本项目受到 [ConardLi](https://github.com/ConardLi) 及其 [easy-agent](https://github.com/ConardLi/easy-agent) 项目的启发，并建立在其优秀工作之上。

原项目提供了重要的功能基础，也提供了一条学习 Agent 架构与工程实践的宝贵路径。Klaude-Code 在此基础上作为独立维护的项目继续推进，逐步扩展、加固、记录和评估这个继承而来的系统。

非常感谢原作者将这份工作分享给开源社区。也欢迎支持原项目。

## 项目愿景

Klaude-Code 的目标，是成为一个严肃的、开源的、面向生产的本地 Coding Agent Harness。

我们并不声称已经完成了 Claude Code 或 Codex 的替代品。项目的目标是通过持续的工程证据逐步走向这一类系统，而不是进行一次性的大规模重写，也不是只在 API 外面包一层 Prompt。

核心目标：

- 保留并继续扩展已有的本地 Coding Agent 功能基础；
- 让模型、工具、权限、上下文和多 Agent 行为可观测；
- 通过明确的重试、超时、取消和恢复语义提升运行时可靠性；
- 建立关注隐私的结构化 Trace 和确定性 Evaluation / Regression；
- 加固工具、权限、Sandbox 边界、MCP 集成和扩展点；
- 让并行 Agent 与 Worktree 工作流具备可解释、可恢复、可合并的工程纪律；
- 在不隐藏兼容性问题和未完成工作的前提下，演进为可维护的本地 Agent CLI。

## 当前状态

Klaude-Code 当前包含两条相互连接、但性质不同的路线：

| 路线 | 含义 | 当前位置 |
|---|---|---|
| **Original Foundation Track** | 继承并持续加工的功能基础，逐步构建本地 Coding Agent | 阶段 0–34 已实现/持续维护；阶段 35–36 计划中 |
| **Enterprise Harness Track** | Klaude-Code 独立开展的企业级升级工作 | R1 的 Trace、可靠性、安全与 Evaluation 纵向闭环已完成；R2/R3 待逐项推进 |

当前实现已经包含终端 CLI、流式模型通信、本地工具、权限、Sandbox、会话、上下文管理、MCP、Skills、Sub-Agent、后台执行、Agent Teams、Hooks、多 Provider、多模态输入以及 Extended Thinking 控制等能力。

第一条企业级 Harness 纵向链路已经闭合：Trace 契约与脱敏、本地弹性 JSONL 存储，Query、Model Attempt、API Retry、Stream Restart、Tool、Permission 的真实边界事件，以及 Retry/Abort/Recovery、Tool/Permission、文件/进程/MCP 外部安全契约。E6 以独立 Artifact Store、25 项证据矩阵和受控端到端 Trial 提供确定性 `verify:core` 门禁。R1 只代表这些不变量有证据，不代表真实模型成功率或完整企业产品交付。

当前运行时仍然保留从原始实现继承而来的兼容标识，包括 npm package 名称 `easy-agent` 和可执行命令 `agent`。完整的 package、CLI、配置和用户数据迁移被有意放在后续 E9 兼容性项目中；本次 README 品牌重定位不声称这项迁移已经完成。

Klaude-Code 当前应被理解为一个正在积极加固的严肃开源工程，而不是已经面向终端用户完全交付的成品。

## 架构设计

Klaude-Code 按照五层架构推进：

```text
+---------------------------------------------------+
| 1. 交互层                                          |
|    终端 UI、输入处理、渲染输出                        |
+---------------------------------------------------+
| 2. 编排层                                          |
|    多轮会话流转、usage、命令控制                      |
+---------------------------------------------------+
| 3. 核心 Agentic Loop                               |
|    推理 -> 调工具 -> 观察结果 -> 继续推理              |
+---------------------------------------------------+
| 4. 工具层                                          |
|    文件、Shell、搜索、Web、MCP 等本地行动能力            |
+---------------------------------------------------+
| 5. 通信层                                          |
|    Provider Profile 与多模型流式通信                   |
+---------------------------------------------------+
```

这种分层方式让系统更容易持续演进：

- **通信层**负责 Provider 选择、请求格式转换与模型流式输入输出；
- **工具层**负责向模型暴露行动能力；
- **核心循环层**负责单轮自主执行闭环；
- **编排层**负责多轮状态与控制流；
- **交互层**负责把整个运行时变成可用的终端产品。

## 仓库结构

```text
Klaude-Code/
├── src/
│   ├── entrypoint/      # CLI 启动入口
│   ├── ui/              # React/Ink 终端界面
│   ├── core/            # agentic loop 与 query orchestration
│   ├── agents/          # 子 Agent 定义、注册表与运行器
│   ├── tools/           # 本地工具与工具注册系统
│   ├── services/        # Provider API、MCP 与 Skills 服务
│   ├── permissions/     # 权限与安全控制
│   ├── context/         # system prompt 与上下文管理
│   ├── sandbox/         # Bash 沙箱 profile 与命令包装
│   ├── session/         # 会话持久化与历史
│   ├── state/           # Todo、Task、Agent 等运行时状态
│   ├── types/           # 共享领域类型
│   └── utils/           # env、config、log、辅助函数
├── step/                # 教程化的基础路线快照
├── docs/                # 工程与学习文档
├── package.json
├── tsconfig.json
├── README.md
└── README.zh-CN.md
```

## 路线图总览

项目路线分为两个层次：

1. **Original Foundation Track** —— 继承并持续加工的原始 Easy Agent 功能基础路线。
2. **Klaude-Code Enterprise Harness Track** —— 让这些能力更安全、更可靠、更可观测、更容易评估和运维的独立加固路线。

## 状态表达

Enterprise Harness 阶段使用两个维度，避免把继承能力误报为 Klaude-Code 已完成的独立加固：

- **Foundation:** `absent | inherited | present`
- **Klaude hardening:** `not-started | in-progress | evidenced | deferred`

`Foundation` 说明运行基础是否存在；`Klaude hardening` 只有在实现、聚焦验证、Dev Doc 和限制说明形成闭环后才能标记为 `evidenced`。

## 原始基础路线：Original Foundation Track

### 继承的实现里程碑：Inherited Implementation Milestones

这条路线记录从原始 Easy Agent 实现路径继承并在当前仓库中持续推进的功能基础。保留它既是为了记录项目历史，也是为了提供可复现的学习路径。这里的阶段表不应被理解为当前维护者在本仓库中从零完成了每一个里程碑。

| 阶段 | 模块 | 核心代码 | 状态 |
|---|---|---|---:|
| 0 | 项目脚手架 | `planned in step series` | ✅ Implemented |
| 1 | LLM 通信层 | [`step/step1.js`](./step/step1.js) | ✅ Implemented |
| 2 | React/Ink 终端 UI | [`step/step2.js`](./step/step2.js) | ✅ Implemented |
| 3 | Tool 接口与第一个工具 | [`step/step3.js`](./step/step3.js) | ✅ Implemented |
| 4 | 核心 Agentic Loop | [`step/step4.js`](./step/step4.js) | ✅ Implemented |
| 5 | 完整核心工具集 | [`step/step5.js`](./step/step5.js) | ✅ Implemented |
| 6 | System Prompt 与上下文工程 | [`step/step6.js`](./step/step6.js) | ✅ Implemented |
| 7 | 权限控制系统 | [`step/step7.js`](./step/step7.js) | ✅ Implemented |
| 8 | QueryEngine 多轮编排 | [`step/step8.js`](./step/step8.js) | ✅ Implemented |
| 9 | 会话持久化与恢复 | [`step/step9.js`](./step/step9.js) | ✅ Implemented |
| 10 | 项目记忆系统 | [`step/step10.js`](./step/step10.js) | ✅ Implemented |
| 11 | 上下文压缩 | [`step/step11.js`](./step/step11.js) | ✅ Implemented |
| 12 | Token 预算精细管理 | [`step/step12.js`](./step/step12.js) | ✅ Implemented |
| 13 | Plan Mode | [`step/step13.js`](./step/step13.js) | ✅ Implemented |
| 14 | TodoWrite 会话任务跟踪 | [`step/step14.js`](./step/step14.js) | ✅ Implemented |
| 15 | 任务管理系统（V2） | [`step/step15.js`](./step/step15.js) | ✅ Implemented |
| 16 | MCP 协议支持 | [`step/step16.js`](./step/step16.js) | ✅ Implemented |
| 17 | Skills 系统 | [`step/step17.js`](./step/step17.js) | ✅ Implemented |
| 18 | Sandbox | [`step/step18.js`](./step/step18.js) | ✅ Implemented |
| 19 | Sub-Agent 与 Agent 定义系统 | [`step/step19.js`](./step/step19.js) | ✅ Implemented |
| 20 | 后台执行与 Worktree 隔离 | [`step/step20.js`](./step/step20.js) | ✅ Implemented |
| 21 | Agent Teams / 多 Agent 协作 | [`step/step21.js`](./step/step21.js) | ✅ Implemented |
| 22 | Hooks 生命周期系统 | [`step/step22.js`](./step/step22.js) | ✅ Implemented |
| 23 | Output Styles 与用户命令 | [`step/step23.js`](./step/step23.js) | ✅ Implemented |
| 24 | 渲染体验升级 | [`step/step24.js`](./step/step24.js) | ✅ Implemented |
| 25 | 配置系统完善 | [`step/step25.js`](./step/step25.js) | ✅ Implemented |
| 26 | 文件历史与回滚 | [`step/step26.js`](./step/step26.js) | ✅ Implemented |
| 27 | 错误处理与韧性 | [`step/step27.js`](./step/step27.js) | ✅ Implemented |
| 28 | 管道模式 / 非交互执行 | [`step/step28.js`](./step/step28.js) | ✅ Implemented |
| 29 | Auto Mode 分类器 | [`step/step29.js`](./step/step29.js) | ✅ Implemented |
| 30 | 多 Provider 支持 | [`step/step30.js`](./step/step30.js) | ✅ Implemented |
| 31 | 核心工具补全：Web、MultiEdit、MCP Resources、PowerShell | [`step/step31.js`](./step/step31.js) | ✅ Implemented |
| 32 | 多模态输入：图片与截图 | [`step/step32.js`](./step/step32.js) | ✅ Implemented |
| 33 | 内置命令补全 | [`step/step33.js`](./step/step33.js) | ✅ Implemented |
| 34 | Extended Thinking 控制与展示 | [`step/step34.js`](./step/step34.js) | ✅ Implemented |
| 35 | Plugins 与 Marketplace | `planned` | 📋 Planned |
| 36 | 打包发布与文档 | `planned` | 📋 Planned |

[`step/`](./step/) 目录中包含教程化的里程碑快照，因此每个已完成章节都可以从聚焦的独立文件和主源码两处学习。

当前基础路线补充说明：

- 阶段 33 已在源码、文章主线和 step 快照中完成；
- 阶段 34 已完成 thinking 三态控制、多 Provider 请求与事件适配、安全历史回放、effort 控制和终端折叠展示；
- 阶段 35 和阶段 36 仍是基础路线中的后续计划；在公开插件分发和打包能够被视为生产级能力之前，下面的 Enterprise Track 会进一步加固其安全、生命周期和运维基础。

## Klaude-Code 企业级 Harness 路线

Enterprise Harness Track 并不是再次声称基础功能不存在，而是新增的工程层：让已有功能变得可观测、可恢复、安全、可评估和可维护。领域编号 E0–E9 表示能力域，不再被解释为必须按编号串行完成的瀑布顺序。

### E0 —— 项目基线与工程治理

**状态：** R1 evidenced · 后续领域评测持续演进

项目已经建立独立延伸关系、工程记录、Task 1–3 Trace 文档、Worktree 隔离实践和接班材料。下一步治理工作是让这些实践可以被未来的贡献者和 Agent 稳定复用。

任务：

- ✅ 保留上游署名，并区分继承的基础与独立延伸；
- ✅ 记录 Worktree 隔离、分支边界、合并纪律和安全清理；
- ✅ 将 ADR、事件契约、验收笔记和实现教学文档放在可追踪的位置；
- 🔧 统一 `Implemented`、`Hardening`、`In Progress`、`Planned`、`Research Direction` 的状态表达；
- 🔧 让变更影响审查、聚焦验证、交接和合并证据变成可重复流程；
- 📋 建立公开发布、贡献和维护约定。

### E1 —— 可观测性与 Trace 基础

**状态：** Foundation: present · Klaude hardening: in-progress

Task 1–5 已经建立本地结构化 Trace 核心因果链，并把现有模型、重试、工具和权限边界接入同一个证据模型；这些改动观测继承运行时能力，而不是重新实现它们。

任务：

- ✅ 定义 Trace 事件契约和共享标识符；
- ✅ 脱敏敏感值，并让生命周期 payload 遵守内容最小化原则；
- ✅ 通过带顺序控制、路径约束和失败隔离的 JSONL 读写落盘；
- ✅ 记录 QueryEngine 的 `query.started`、`query.finished`、`query.failed` 和 `query.aborted`；
- ✅ 记录模型请求、完成、失败、重试和流重启的元信息；
- ✅ 通过安全摘要记录工具调用和权限决策；
- ✅ 校验 schema 版本、sequence 单调性以及 query/span 关系；
- 🔧 在顶层 query 和嵌套运行时 span 之间保持统一的 `traceId`；
- 📋 增加 Trace 检查/导出 CLI 和诊断包格式；
- 📋 定义 Trace schema 迁移和保留规则。

当前证据：Task 1–3 的契约、存储、隐私和 QueryEngine 生命周期工作见 [`docs/`](./docs/)。当前生命周期 payload 不记录 prompt 内容、system prompt、消息正文、工具输入/输出正文、stdout/stderr 或 API key。

### 文档

项目文档保持有意的简洁结构：

```text
docs/
├── README.md                         # 文档入口与组织规则
├── learning/E0/                      # 当前阶段汇报与既有 Trace 文档
├── superpowers/mainTask/             # 权威长期任务书与窗口提示
├── superpowers/plans/                # 审计路线、阶段 PR 与 JIT 计划
└── archive/                          # 历史计划和旧索引
```

当前 worktree 不存在 `docs/engineering/` 入口，不能继续引用它作为有效目录。阅读从 [`docs/README.md`](./docs/README.md) 开始；长期方向以 [`MainTask.md`](./docs/superpowers/mainTask/MainTask.md) 为准，执行顺序以 [阶段性 PR 安排](./docs/superpowers/plans/2026-08-24-enterprise-harness-staged-pr-plan.md) 为准。

### E2 —— 运行时可靠性与恢复加固

**状态：** Foundation: inherited · Klaude hardening: not-started

基础实现已经包含 API 错误分类、可重试判断、流式重试、abort 处理、韧性路径和上下文溢出处理。E2 将统一这些机制的语义，并通过证据建立可验证的恢复保证。

任务：

- 🔧 统一 transient/permanent 错误类别和重试策略；
- 🔧 明确 attempt 编号、重试预算、退避和 `Retry-After` 行为；
- 🔧 在不泄漏请求内容的前提下记录现有重试和流重启决策；
- 🔧 定义连接断开、部分输出和重复输出风险下的流式恢复；
- 🔧 统一 abort、timeout、前台、后台和资源释放语义；
- 🔧 在一个恢复状态模型中区分模型、API、上下文、工具和权限失败；
- 🔧 在重试不可逆工具动作前明确幂等边界；
- 📋 支持进程中断或崩溃后的 session recovery；
- 📋 度量成功率、恢复率、重试成本和尾延迟；
- 🔬 只有在确定性策略形成证据后，才研究自适应恢复策略。

### E3 —— 工具与权限安全加固

**状态：** Foundation: inherited · Klaude hardening: not-started

工具、Permission Mode、Auto Mode 和 Sandbox 控制已经存在。E3 的目标是让它们形成更加一致、可治理、可审计的安全边界。

任务：

- 🔧 加固工具输入 schema、参数校验和输出大小限制；
- 🔧 统一不同入口下 allow、deny、ask、block 和 bypass 的语义；
- 🔧 记录权限决策和原因，但不记录敏感正文；
- 🔧 分类危险命令、路径、权限变更和外部副作用；
- 🔧 验证 Sandbox 的工作目录、路径穿越、进程、超时和输出边界；
- 🔧 明确 MCP server 和外部工具的信任边界；
- 🔧 防止 secret 出现在环境处理、错误、日志或 Trace 中；
- 🔧 将真实安全问题转化为聚焦的安全回归测试；
- 📋 增加安全策略诊断命令和高风险审批证据；
- 🔬 只有在不绕过显式用户权限策略的前提下，才研究风险评分。

### E4 —— 上下文、记忆与成本治理

**状态：** Context Provenance + Memory Governance v1: present · 完整 Usage/Cost 与语义检索: deferred

上下文加载、Compaction、Memory、项目指令、会话历史和 Token Budget 已经存在。E4 让它们的信息流和成本行为变得可解释、可测试。

任务：

- ✅ 记录上下文来源、纳入资格、加载状态和确定性 Token 估算，且不复制正文；
- 🔧 明确 system prompt、项目指令、memory、会话历史、工具和附件之间的边界；
- ✅ 以 invariant snapshot 校验 compaction 对用户硬约束和当前任务的保留，遗漏时失败关闭；
- ✅ 为 Memory 增加来源、revision、过期状态、路径隔离与可恢复删除；
- ✅ 让 stale/legacy 状态进入治理清单和 Diagnostics，不声称已有语义相关性检索；
- 🔧 统计 input/output/cache usage 和模型调用成本；
- 🔧 为长会话、工具输出、文件和图片治理上下文预算；
- 🔧 从上下文溢出或 compaction 失败中可预测地恢复；
- 📋 增加 context/memory 检查命令和评估 fixtures；
- 🔬 只有在拥有来源追踪和回归证据后，才研究基于任务的动态上下文预算。

### E5 —— 多 Agent 与 Worktree 编排

**状态：** Foundation: inherited · Klaude hardening: deferred

Sub-Agent、后台执行、Agent Teams 和 Worktree 隔离已经提供并行执行原语。E5 为其补充所有权、基线、恢复、合并和交接纪律。

任务：

- 声明 Task Goal/Input/Output/Owner/Dependency/Handoff；
- 在启动前检查 File Ownership 与重叠写入；
- 明确 `fresh`、`head` 或特定 commit 的 Worktree baseline；
- 解释 Parent/Child snapshot 与 Trace；
- 保留 Timeout/Partial Completion 的状态和交接证据；
- 将 worker 证明与主会话最终整合责任分离；
- 删除 Worktree 前审计未提交、未跟踪和未合并工作。

### E6 —— Evaluation、Benchmark 与质量门禁

**状态：** Foundation: present · Klaude hardening: in-progress

E6 使用独立 Evaluation Run Record 与 Artifact Store 判断受控任务是否满足成功标准，不把隐私最小化 Runtime Trace 扩张成完整会话采集。E6-A 骨架在 E1 后提前建立，E6-B 在 E2/E3 后关闭 R1 证据闭环。

任务：

- ✅ 定义 Task、Trial、Grader、Evaluation Result 的窄契约；
- ✅ 建立 R1 Claim/Invariant-to-Evidence Matrix 基线；
- ✅ 校验 Trace 生命周期、隐私、Permission Deny 和 Writer Failure Isolation；
- ✅ 输出机器可读结果和 Markdown 报告；
- ✅ 只将确定性 Fake Provider/fixture 检查接入 Core CI；
- ✅ 关闭 25 项 R1 Claim-to-Evidence Matrix，并运行 Model→Permission→Tool→Completion 受控 Trial；
- 将真实模型实验与 CI 分离，并按 Trial 如实报告；
- 不声称生产 Trace 可以重放原始模型行为。

### E7 —— 扩展与插件生态加固

**状态：** Foundation: inherited · Klaude hardening: deferred

Skills、Hooks、MCP、Agent 定义和未来 Plugin 已经形成多个扩展点。E7 在扩大分发之前，先建立统一的生命周期和能力边界。

任务：

- 🔧 统一 Skills、Hooks、MCP、Agents 和 Plugins 的扩展契约；
- 🔧 隔离扩展的加载、运行、超时和失败行为；
- 🔧 通过显式权限治理扩展能力；
- 🔧 定义兼容性和版本检查；
- 🔧 保留本地加载或外部提供扩展的来源信息；
- 📋 增加本地扩展注册表和安装、更新、停用、诊断流程；
- 📋 定义插件元数据和分发要求；
- 📋 只有在安全、生命周期和兼容性门禁通过后，才评估 Marketplace readiness；
- 🔬 研究扩展 Sandbox 化和能力评分。

### E8 —— 开发者体验与诊断

**状态：** Foundation: inherited · Klaude hardening: deferred

E8 将内部证据转化为能够帮助开发者理解和恢复运行的反馈。

任务：

- 📋 解释配置来源、优先级和最终生效设置；
- ✅ 扩展 `/doctor`，聚合环境检查、最新安全 Trace 摘要与 Evaluation 结果；
- ✅ 提供 retry、stream restart、permission、tool、query failure 和 recovery guidance；
- 📋 提供 session resume 和失败恢复指引；
- ✅ 增加 Trace 生命周期摘要和文本/JSON 安全诊断报告；
- ✅ 让诊断输出可以安全分享，不暴露 prompt、secret、绝对项目路径或文件内容；
- 📋 在 PR-10～PR-13 证据建立后增加 Context/Memory/Sub-Agent 与 usage/cost 解释；
- 🔬 基于反复出现且有证据支持的失败模式，研究主动诊断。

交互会话中运行 `/doctor` 可同时查看环境健康与当前项目的最新安全证据摘要；开发者也可以在仓库中生成同源的文本或 JSON 报告：

```bash
npm run diagnose
npm run diagnose -- --json
```

报告只包含状态、计数、稳定分类、证据引用和恢复建议，不输出 Prompt、模型/Tool 正文、命令、环境变量值或绝对项目路径。

### E9 —— 打包、兼容性与运行准备

**状态：** Foundation: inherited · Klaude hardening: deferred

E9 才是谨慎迁移运行时身份的阶段。本次 README 品牌重定位不包含这项迁移。

任务：

- 📋 在兼容性方案下，将 package 身份从 `easy-agent` 迁移到 `klaude-code`；
- 📋 决定保留 `agent` 作为兼容别名，还是进行分阶段迁移；
- 📋 在不丢失数据的前提下迁移配置、Session、Memory 和 Trace 目录；
- 📋 验证 Windows、macOS 和 Linux 的安装与运行行为；
- 📋 自动化版本、构建、发布产物和发布前检查；
- 📋 提供升级、回滚和配置迁移路径；
- 📋 完善安装、架构、故障排查和贡献者文档；
- 📋 在维护和质量门禁成熟后，建立公开贡献准备度；
- 🔬 研究不同操作系统之间的分发和 Sandbox 差异。

## 当前企业级位置

```text
Original Foundation Track
  阶段 0–34  ✅ Implemented / continued
  阶段 35–36 📋 Planned

Enterprise Harness Track
  E0 治理           Foundation: present   · Klaude hardening: in-progress
  E1 Trace          Foundation: present   · R1 evidenced
  E2 可靠性         Foundation: inherited · R1 evidenced
  E3 安全           Foundation: inherited · R1 evidenced
  E4 上下文/记忆    Foundation: inherited · Governance v1 present
  E5 多 Agent       Foundation: inherited · Klaude hardening: deferred
  E6 Evaluation     Foundation: present   · R1 evidenced
  E7 扩展           Foundation: inherited · Klaude hardening: deferred
  E8 诊断           Foundation: inherited · R2 Diagnostics v1 present
  E9 发布           Foundation: inherited · Klaude hardening: deferred
```

当前定位有意比长期愿景更窄：Klaude-Code 已经拥有本地 Coding Agent 的功能基础，也已经部分完成结构化 Trace 基础。Enterprise Harness Track 是一项正在进行的加固与评估计划，并不声称项目已经成为 Claude Code 或 Codex 的完整生产替代品。

## Klaude-Code 是什么，以及它不是什么

**Klaude-Code 是：**

- 建立在开源基础上的独立维护延伸项目；
- 一个面向本地 Coding Agent Harness 的系统工程项目；
- 一个拥有功能型 Agent CLI，并正在扩展可靠性、安全、可观测性和评估层的公开代码库；
- 一个记录实现、加固决策、实验和真实工程经验的项目。

**Klaude-Code 不是：**

- `ConardLi/easy-agent` 官方仓库；
- 声称所有继承的里程碑都在本仓库中从零完成；
- 一个单文件 Demo 或只包了一层 Prompt 的 API 壳子；
- 一个已经完成的 Claude Code 或 Codex 生产替代品；
- 任何私有课程内容的公开镜像。

## 快速开始

### 环境要求

- Node.js 22+
- npm
- 至少一种受支持模型 Provider 的访问能力：Anthropic、OpenAI 兼容 API、Gemini，或 Ollama 这类本地 OpenAI 兼容端点

### 模型 Provider

Klaude-Code 默认支持多 Provider。原始 Claude/Anthropic 模型名仍可直接使用；OpenAI 兼容 API 与 Gemini 通过 `settings.json` 中的命名模型 Profile 配置，再用 `--model` 或 `/model` 选择。

用户级或项目级 settings 示例：

```json
{
  "defaultModel": "gpt",
  "models": {
    "gpt": {
      "protocol": "openai-chat",
      "model": "gpt-5.1",
      "baseURL": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}"
    },
    "gemini": {
      "protocol": "gemini",
      "model": "gemini-2.5-pro",
      "apiKey": "${GEMINI_API_KEY}"
    },
    "ollama": {
      "protocol": "openai-chat",
      "model": "qwen2.5-coder",
      "baseURL": "http://localhost:11434/v1"
    }
  }
}
```

常用环境变量：

- `ANTHROPIC_AUTH_TOKEN` —— 原始 Claude/Anthropic 模型名使用的 API Token
- `ANTHROPIC_BASE_URL` —— 可选的 Anthropic 兼容 API Base URL
- `ANTHROPIC_MODEL` —— 旧式/默认原始 Anthropic 模型名
- `OPENAI_API_KEY` —— `${OPENAI_API_KEY}` Profile 使用的 OpenAI 兼容 API Key
- `GEMINI_API_KEY` —— `${GEMINI_API_KEY}` Profile 使用的 Gemini API Key
- `WEB_SEARCH_API_KEY` —— 可选的 WebSearch Provider Key

### 安装

```bash
npm install
```

### 开发运行

```bash
npm run dev
```

### 构建运行

```bash
npm run build
npm start
```

### CLI 示例

当前兼容性可执行命令仍然是 `agent`：

```bash
agent --help
agent --model claude-sonnet-4-20250514
agent --model gpt
agent --model gemini
echo "summarize this repo" | agent --print --output-format json
agent --plan
agent --auto
agent --dump-system-prompt
```

## 近期重点

近期重点将遵循 Enterprise Harness Track，而不是把原始基础路线误认为已经完成的产品工作：

1. PR-00～PR-09 已形成 Trace→Reliability→Safety→Evaluation 的 Resume Release R1 证据闭环；
2. R1 后按 Bad Case 与求职价值，在 E4 Context/Memory、E5 Multi-Agent、E8 Diagnostics 中逐项选择；
3. E7 Extension Governance、E6-C External Benchmark 与 E9 Packaging/Release 保持长期路线。

## 贡献策略

Klaude-Code **当前暂不接受外部贡献**。

项目仍处于积极加固阶段。随着 Enterprise Harness Track 产生新的证据，运行时行为、package 身份、目录结构和开发约定都可能发生变化。等项目拥有稳定的贡献模型、质量门禁、安全边界和发布流程后，再考虑开放外部贡献。

在此之前，欢迎关注公开路线图、学习实现并参考上游项目，但暂时不会接收 Pull Request 或外部代码贡献。

## License

MIT
