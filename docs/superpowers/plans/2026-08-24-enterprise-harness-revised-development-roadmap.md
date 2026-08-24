---
title: "Klaude-Code Enterprise Harness 未来开发路线审计与修订计划"
date: 2026-08-24
updated: 2026-08-24
status: proposed-for-adoption
plan_role: roadmap-audit-and-execution-strategy
scope: E0-E9
tags:
  - klaude-code
  - agent-harness
  - roadmap
  - observability
  - reliability
  - safety
  - evaluation
  - job-search
---

# Klaude-Code Enterprise Harness 未来开发路线审计与修订计划

> **当前状态说明：** 本文保留路线审计和设计依据；当前执行状态已进入 maintenance pause。已完成范围、延期项与未来重启协议以 [`docs/PROJECT-SNAPSHOT.md`](../../PROJECT-SNAPSHOT.md) 为准，本文末尾早期“下一步”不再构成当前授权。

> **For agentic workers:** 后续实施必须先为当前 Slice 编写 Just-in-Time Implementation Plan，并使用 `executing-plans` 或在明确授权后使用 `subagent-driven-development` 逐项执行。本文是路线级约束，不是允许一次性修改所有阶段的文件级计划。

**Goal:** 将现有 E0–E9 长期愿景收敛为一条真实、可执行、可验证、可答辩的开发路线，优先交付能够支撑实习与校招简历的 Agent Harness 核心工程闭环。

**Architecture:** 保留 Original Foundation Track 与 Enterprise Harness Track 的边界，以安全 Runtime Trace 为运行证据，以独立 Evaluation Record 和确定性 Grader 为评测基础。近期采用垂直 Slice 和证据门推进，不再把 E0–E9 解释为必须按编号串行完成的瀑布计划。

**Tech Stack:** TypeScript 6、Node.js 22、React/Ink、Anthropic SDK、MCP SDK、llm-bridge、JSONL、本地文件系统、Git/Git Worktree、GitHub Actions（规划）。

---

## 0. 文档定位与结论

### 0.1 审计结论

现有路线的技术方向总体成立：围绕 Observability、Reliability、Safety、Context、Multi-Agent、Evaluation 和 Diagnostics 对已有 Coding Agent 基础进行生产化加固，这比继续堆叠普通 Agent 功能更有独立贡献价值。

但当前路线不能直接照原顺序执行，主要原因是：

1. README 与权威 MainTask 的 E5/E6 定义相反；
2. 依赖图把“尽量完成”的 E4/E5 放在“必须完成”的 Evaluation 前面；
3. 2026 年 8 月周计划已经失效，且对单维护者明显超载；
4. `Hardening` 状态混淆了“继承能力存在”和“Klaude-Code 已完成加固”；
5. 当前隐私最小化 Trace 无法单独承担真实行为回放和 Agent 能力评测；
6. E1 已完成声明缺少 QueryEngine 真实边界上的完整集成证据；
7. Trace 的启用、保留、关闭超时和 Session Persistence 耦合尚未形成稳定契约；
8. E4、E7 的部分描述超出了实际基础：自动相关 Memory 检索仍为空实现，Plugin 生命周期也尚未进入当前实现；
9. E6 范围过大，半周内完成多仓库 Benchmark、指标、报告、Bad Case、CI 和真实模型实验不可信；
10. 缺少一个明确的“可投递 R1”完成点，容易让项目长期停留在所有阶段都进行中。

因此，本计划作出以下总决策：

- 保留 E0–E9 作为领域编号，但取消“编号等于严格执行顺序”的解释；
- 以 E1 → Evaluation Foundation → E2/E3 垂直 Slice → R1 为近期主链；
- E4 Context/Memory 与 E5 Multi-Agent 进入 R1 后的增强路线；
- E7 Extension、E8 产品化 Diagnostics、E9 Release 保留为长期路线；
- 将最小 Inspector、最小 Doctor 信息和 Evaluation 骨架提前，不等所有领域加固后再验证；
- 用证据门替代已经失效的自然周排期。

### 0.2 审计方法与限制

本结论基于：

- `README.zh-CN.md` 的 Enterprise Harness 路线；
- `docs/superpowers/mainTask/MainTask.md` 与 `Prompt.md`；
- GitNexus 对当前 worktree 的功能簇、调用链和符号上下文；
- QueryEngine、Agentic Loop、Streaming、Tool、Permission、Session、Memory、Worktree 和 Observability 源码；
- 一次独立、无前置结论的单模型反方审计。

用户已明确跳过跨模型复核。因此本文已由主 Agent 对反方发现逐条回到源码裁决，但不声称经过多模型共识。

## 1. 当前真实基线

### 1.1 可确认的运行基础

当前项目已存在可运行的本地 Coding Agent 主链：

```text
CLI / Headless / Ink UI
  → QueryEngine
  → Agentic Loop
  → Provider Streaming
  → Tool / Permission / Sandbox
  → Session / File History / State
```

同时存在 MCP、Skills、Hooks、Memory、Sub-Agent、Agent Teams 和 Worktree 等基础能力。这些能力主要来自 Original Foundation Track 的继承和延伸，不能直接计为 Klaude-Code 独立完成的 Enterprise Hardening。

### 1.2 可确认的独立 Trace Slice

当前独立实现已经覆盖：

- `HarnessTraceEvent` v1；
- 安全摘要和递归脱敏；
- 本地 JSONL Writer/Reader；
- 路径控制和 Trace ID 消毒；
- Writer 普通写入错误隔离；
- QueryEngine 的 `query.started`、`query.finished`、`query.failed`、`query.aborted`；
- 内容最小化的 Query payload。

当前只有 Query 生命周期事件在运行路径中实际 emit。Model、Retry、Stream、Tool、Permission 等事件名虽然已经进入类型契约，但尚不能当作已接入能力。

### 1.3 当前证据缺口

- `src/scripts/test-trace.ts` 主要验证 mapper、redaction 和 Writer，不足以证明 QueryEngine 四种终止路径都正确落盘；
- `package.json` 没有统一的 `test:trace` 或 `verify:core` 入口；
- `.github/workflows/` 尚不存在；
- Trace Writer 依赖 Session Persistence 开关，关闭 Session 持久化时会静默退化为 No-op；
- `close()` 会无期限等待写队列，尚未证明“Trace 永不阻塞主路径”；
- Trace 保留策略没有进入明确完成门；
- `findRelevantMemories()` 当前返回空数组，不能把自动相关 Memory 检索描述为已存在的成熟基础；
- Plugin metadata、Plugin loading 和 Plugin scope 在当前源码中被明确裁剪。

## 2. 路线一致性修复

### 2.1 统一领域编号

采用 MainTask 中已经展开完整设计的映射：

| 编号 | 统一领域 |
| --- | --- |
| E0 | Baseline & Governance |
| E1 | Observability & Core Causal Trace |
| E2 | Runtime Reliability & Recovery |
| E3 | Tool / Permission / Sandbox / MCP Safety |
| E4 | Context / Memory / Usage Governance |
| E5 | Multi-Agent / Worktree Orchestration |
| E6 | Evaluation / Benchmark / Quality Gates |
| E7 | Extension Ecosystem Governance |
| E8 | Developer Diagnostics |
| E9 | Packaging / Compatibility / Release |

README 中“E5 Evaluation、E6 Multi-Agent”的映射必须在正式采纳本计划时统一修改。MainTask、Prompt、README、阶段目录、Dev Doc 和简历材料不得继续使用两套编号。

### 2.2 领域编号不再代表严格串行依赖

新的执行关系为：

```text
E0 路线修复
  → E1 核心 Trace 与 Inspector
  → E6-A 最小 Evaluation Foundation
  → E2 可靠性 Slice ─┐
  → E3 安全 Slice   ─┼→ E6-B R1 评测闭环 → Resume Release R1
                      │
E4 Context/Memory  ───┤（R1 后按价值接入）
E5 Multi-Agent     ───┘（R1 后按价值接入）

E7 / E8 产品化 / E9 → 长期路线
```

Evaluation 仍保留 E6 编号，但 E6-A 骨架必须提前建立。这样 E2–E5 每个 Slice 都能把新证据接入同一评测入口，而不是等所有领域结束后再补测试。

### 2.3 使用双维状态

每个阶段必须同时报告两个状态：

```text
Foundation: absent | inherited | present
Klaude hardening: not-started | in-progress | evidenced | deferred
```

示例：

```text
E3 Safety
Foundation: inherited/present
Klaude hardening: not-started
```

禁止仅因基础模块存在，就把 Enterprise 阶段标成 `Hardening`。`evidenced` 必须指向实现、聚焦验证、Dev Doc 和限制说明。

## 3. 两类证据模型必须分离

### 3.1 Runtime Diagnostic Trace

用途：解释一次真实运行“发生了什么”。

约束：

- 默认内容最小化；
- 不记录 Prompt、完整消息、模型正文、完整 Tool 输入输出、命令、文件正文、stdout/stderr 或 Secret；
- Writer/Inspector 故障不改变主路径；
- 适合 Timeline、Failure Attribution、Retry/Permission/Tool 因果关系；
- 不承诺复现原始模型行为。

### 3.2 Evaluation Run Record

用途：在受控任务中判断 Agent/Harness 是否满足成功标准。

至少包含：

- `taskId`、`suiteId`、`trialId`；
- 固定或版本化的任务定义；
- 受控环境标识、初始状态和资源配置；
- Harness/Model/Profile/Commit 信息；
- Runtime Trace 的关联 ID；
- Outcome、Grader 结果、Duration、Usage；
- 失败分类和限制说明。

Evaluation Record 只用于受控 fixture 和明确实验，不能把真实用户的隐私最小化 Trace 反向扩张成完整会话采集。

Evaluation 域必须拥有独立 Artifact Store 和 Storage Policy。默认本地运行产物进入项目数据根下专用 `evaluations/` 子树；只有完全合成且不含用户内容的 Fixture 才能提交。Allowlist、报告脱敏、age/quota Retention、手动删除和安全目录约束必须在 E6-A 落盘前完成，不能借用 Trace 的隐私声明代替。

### 3.3 “Replay”术语约束

第一版只允许两种说法：

- **Trace fixture replay**：读取固定事件文件，验证 schema、顺序、生命周期和隐私不变量；
- **Task rerun**：在重建的受控环境中重新运行任务并由 Grader 判断 Outcome。

在没有完整输入、环境快照和确定性依赖时，不使用“从生产 Trace 重放 Agent 行为”的表述。

## 4. 近期必做主线：Resume Release R1

R1 的目标不是完成 E0–E9，而是形成一条面试中可以从架构、实现、失败、指标和限制完整讲清楚的闭环。

### Gate R0：路线和事实统一

**目标：** 消除文档冲突，让所有后续任务引用同一套路线。

**交付物：**

- 统一 README、MainTask、Prompt 中的 E5/E6 编号；
- 用本文第 2.2 节的新执行关系替换 MainTask 的严格串行依赖图；
- 重写 Prompt 的窗口顺序和“不得提前进入 Evaluation”约束，使 E6-A 可以在 E1 后启动；
- 修正文档目录描述，使其与 `docs/learning/`、`docs/superpowers/plans/` 和 `docs/archive/` 的实际结构一致；
- 用双维状态重写阶段状态表；
- 将 2026 年 8 月周计划标记为历史基线，改成本文的证据门；
- 明确 E0 的技术产物：能力地图、主调用链、Failure Propagation Map、Enterprise Gap Matrix。

**完成证据：**

- 每个领域只有一个编号；
- README、MainTask 和 Prompt 对近期执行顺序没有冲突；
- 所有状态都能指向代码或文档证据；
- E0 若缺少 Gap Matrix，不标记为完全完成。

**非目标：** 不在本 Gate 修改运行时代码。

**停止/延期条件：** 若三份路线文件对权威来源仍有不同定义，停止后续实现并先由用户指定唯一权威文档；不得让执行 Agent 自行选择版本。

### Gate R1-A：E1 存储与可用性契约收口

**目标：** 在继续扩展事件前，先保证 Trace 基础不会制造隐私、磁盘和主路径风险。

**必须裁决并实现：**

1. Trace 是否与完整 Session Transcript 持久化解耦；
2. Trace disabled/degraded 状态如何对 Inspector 和 Evaluation 可见；
3. Trace 文件保留上限、过期清理和安全删除边界；
4. Writer close 的时间预算和超时降级；
5. schema version 的兼容读取原则；
6. QueryEngine success/failure/abort/disabled 的真实集成证据。

**所有权与生命周期：**

- Trace Retention 由 Observability 域的独立 Storage Policy 负责，不继续隐含委托给普通 Session 顶层清理；
- Just-in-Time 设计时优先建立聚焦组件，例如 `src/observability/traceStoragePolicy.ts`，最终文件名在影响分析后确定；
- 清理入口只能接收已解析的受控 Trace 根目录，拒绝工作区根、用户目录、符号链接或 Reparse Point 越界目标；
- Retention 同时定义 age 和 quota 上限、启动/维护触发时机、Dry-run/诊断输出和失败降级；
- 删除失败不得阻塞 Query，但必须通过安全诊断暴露，不能静默宣称清理成功。

**重点边界文件：**

- `src/observability/traceWriter.ts`；
- `src/observability/traceReader.ts`；
- `src/observability/types.ts`；
- `src/session/storage.ts`；
- `src/core/queryEngine.ts`；
- `src/scripts/test-trace.ts`；
- `package.json`。

**完成证据：**

- 一个聚焦入口覆盖 finished、failed、aborted、disabled/degraded；
- 模拟挂起 Writer 时 Query 在限定时间内结束；
- Retention 只清理受控 Trace 目录；
- 假 Secret 和高风险正文不出现在文件及 Inspector 输出；
- `npm run build` 和统一 Trace 检查通过。

**非目标：** 不在本 Gate 接入 Model、Tool 或 Permission 新事件，不建设 Inspector UI，不实现云端存储。

**停止/延期条件：** 如果 Trace 与 Session Persistence 的解耦需要迁移历史用户数据或改变默认隐私语义，停止实现并先形成 ADR 与迁移边界；如果安全目录约束无法证明，Retention 删除功能保持禁用。

### Gate R1-B：E1 Model / Retry / Stream Trace

**目标：** 建立 Query → Model Request → Retry/Restart → Model Completion/Failure 的真实因果链。

**必做事件：**

```text
query.started
  → model.requested
  → retry.scheduled / stream.restarted
  → model.completed / model.failed
  → query.finished / query.failed / query.aborted
```

**关键约束：**

- 顶层 Query 共享 `traceId`；
- Model Turn、Request Span、API Attempt、Tool Use ID 不混用；
- Trace Context 对 legacy caller 可选；
- 不改变 Prompt、Provider Request、Retry、Usage 或终止语义；
- Partial Output 后未重试时，Trace 不得声称发生 Retry。

**完成证据：**

- 一条成功 Model Request Trace；
- 一条 Retry 或 Stream Restart Trace；
- 一条 Abort/Failure Trace；
- 所有示例通过内容最小化检查；
- 使用相同 Mock 输入分别运行 Trace enabled/disabled，逐项比较 Prompt、Provider Params、Loop Events、Usage、Termination 和非 Trace 返回值相等。

**非目标：** 不重写 Retry Policy，不统一全部 Provider，不接入 Tool/Permission，不加入 Context/Memory 领域事件。

**停止/延期条件：** 若为了记录事件必须改变 Streaming event contract 或 Provider 请求，停止并回到可选 Trace Context 设计；若同一 Model Attempt 无法稳定定义 span 边界，先完成语义 ADR，不继续堆事件。

### Gate R1-C：E1 Tool / Permission Trace 与最小 Inspector

**目标：** 在真实 Tool 执行边界补齐 Tool/Permission 因果关系，并证明 Trace 可以被安全消费。

**Tool/Permission 最小范围：**

- `permission.requested` 只在实际等待外部/用户决策前产生；
- `permission.resolved` 记录安全决策与来源，不记录完整参数；
- `tool.started` 只在 Permission 已允许且即将调用 `tool.call()` 时产生；
- `tool.completed`、`tool.failed` 使用安全结果摘要；
- Permission Deny/Hook Block/Unknown Tool 不伪装成已执行；
- 并发 Tool 使用独立 Span，`sequence` 不宣称并发完成顺序。

**Inspector 最小范围：**

- 输入单个 Trace ID 或受控路径；
- 按 `sequence` 输出安全时间线；
- 展示 event、turn、attempt、tool、decision、outcome、duration 等安全字段；
- 容忍坏行和未知事件；
- 不建设 Dashboard、复杂查询或诊断建议。

**完成证据：**

- 一个 Tool success；
- 一个 Tool failure；
- 一个 Permission Deny 且执行计数为 0；
- 两个并发安全 Tool 的 Span 不串线；
- Inspector 对完整示例按 sequence 输出安全 Timeline；
- Trace enabled/disabled 的非 Trace Tool/Permission 结果完全一致。

**非目标：** 不在本 Gate 统一完整 Permission 状态机，不重构 Sandbox/MCP，不建设产品化 Doctor 或诊断建议。

**停止/延期条件：** 如果现有 UI Event 与真实 Permission/Tool 边界冲突，保留 UI 行为并在核心执行边界记录 Trace；若并发关联无法通过稳定 Tool Use ID 证明，先停止并修正关联模型。

### Gate R1-D：E6-A Evaluation Foundation

**目标：** 建立后续所有 Slice 共用的确定性评测入口，不等待 E4/E5 完成。

**Evaluation Foundation 最小范围：**

- 定义 Task、Trial、Grader、Evaluation Result 的窄契约；
- 建立“R1 承诺 → 确定性断言 → Fixture/命令 → 证据文件”的 Invariant-to-Evidence Matrix；
- 输出一份机器可读结果和一份简洁 Markdown 报告；
- 增加一个统一的 `verify:core` 风格入口；
- CI 只运行构建和确定性检查，不调用真实付费模型。

**Evaluation Artifact 所有权与隐私：**

- Evaluation 域拥有独立 Artifact Store，不复用 Runtime Trace Writer；
- 本地运行产物进入项目数据根下独立 `evaluations/<run-id>/` 子树；
- 只有完全合成、无用户内容的 Fixture 才能提交到仓库；
- Allowlist 仅包含 task/suite/trial ID、版本、模型 Profile 名、Commit、资源配置、关联 Trace ID、Outcome、Grader 断言、Duration 和 Usage；
- 默认不保存真实用户 Prompt、工作区文件正文、环境变量值、完整 Tool I/O 或模型正文；
- 报告导出必须二次脱敏；Retention 明确 age/quota、手动清理和受控目录删除；
- 若某个实验确需保存完整受控输入，必须由 Fixture 自身拥有并在运行前显式声明，不从真实会话采集。

**首批不变量：**

1. Trace schema、sequence 和生命周期完整性；
2. 隐私不变量与假 Secret 泄漏检查；
3. Permission Deny 后 Tool 未执行；
4. Writer degraded/timeout 不改变 Query 主结果。

**完成证据：**

- 本地单命令可运行全部确定性检查；
- CI 使用同一命令；
- 报告能定位到失败阶段和断言；
- 每个已声明 R1 不变量在 Matrix 中都有证据或被移出 R1；
- Evaluation Artifact 的存储、Retention、删除和报告脱敏有聚焦检查；
- 不以测试数量或覆盖率充当成果。

**非目标：** 不运行真实付费模型，不做多仓库 Benchmark，不引入 LLM-as-a-Judge，不建设通用评测平台。

**停止/延期条件：** 如果一个 Grader 依赖模型随机输出或真实网络，它不得进入 Core CI；如果产物隐私边界未定义，Evaluation Artifact 落盘保持禁用。

### Gate R1-E：E2-A Error Taxonomy / Retry / Provider Slice

**目标：** 统一模型/API 失败分类和有预算的 Retry，不混入 Abort、Context Recovery 和进程恢复。

**首版范围：**

- 统一最小错误类别：transient、permanent、rate_limited、provider_protocol；
- 明确 Retry Budget、Attempt、Backoff 和 `Retry-After`；
- 明确 Partial Output 后不盲目 Replay；
- 主要 Provider 的 Tool Use、Usage、Stop Reason 和 Error Category 使用最小公共语义。

**完成证据：**

- transient retry → success；
- permanent failure → no retry；
- Retry-After/Backoff 不超过预算；
- Partial Output 后不重放请求；
- 至少两个主要 Provider Profile 对公共字段有 Characterization Evidence。

**非目标：** 不处理 Abort/Timeout、Context Overflow、进程恢复、自适应 Retry 或所有 Provider 完全一致。

**停止/延期条件：** 若某 Provider 无法映射到最小公共语义，记录显式 capability gap，不为追求统一重写整个 Provider 层。

### Gate R1-F：E2-B Streaming / Abort / Context Recovery Slice

**目标：** 证明取消、超时、流中断和上下文溢出的有界终止/恢复语义。

**首版范围：**

- Abort 后不启动新的 Model/Tool 业务动作；
- Timeout 释放可控资源并形成明确终止类别；
- Partial Output 的保留/清理规则可解释；
- Context Overflow 只允许一次受控 Reactive Compaction/Restart；
- 不可逆 Tool 不因 Model Retry 或 Stream Recovery 被重复执行。

**完成证据：**

- abort → no new action；
- timeout → bounded termination；
- context overflow → at most one recovery；
- irreversible tool execution count 不因恢复增加；
- 每项承诺都有 Trace 和确定性 Grader。

**非目标：** 不实现进程崩溃后的完整 Session Recovery，不建立自适应恢复策略，不承诺所有外部进程都能强制终止。

**停止/延期条件：** 如果安全终止依赖操作系统或子进程无法保证，明确标记 degraded/unsupported，不用无限等待伪装成功。

### Gate R1-G：E3-A Tool / Permission Contract Slice

**目标：** 先统一 Tool 输入边界和 Permission 决策状态，再处理 Sandbox 与 MCP。

**首版范围：**

- 为现有 Permission Mode、规则、Hook、用户决策和 Headless 策略建立显式映射，不假设源码已经拥有统一的 allow/deny/ask/block/bypass 枚举；
- 建立 `entry point × mode × decision source × outcome × executed` Matrix；
- Permission Deny/Block 后 Tool 不执行；
- Tool Input Schema 和结构大小有边界；
- 高风险或不可逆动作必须经过明确审批来源；
- Trace 能区分直接规则决策与真实用户请求。

**完成证据：**

- Matrix 中每个 R1 支持组合都有确定性断言；
- Deny/Block 的 Tool execution count 为 0；
- Bypass 只能由明确入口触发；
- 一个不可逆动作具有可解释审批来源；
- Tool 输入边界失败不会进入实际执行。

**非目标：** 不在本 Gate 修改 Sandbox Runtime，不治理 MCP Transport，不研究风险评分。

**停止/延期条件：** 若现有术语无法一一映射，先保留真实内部状态并修正文档，不新增虚假的统一枚举。

### Gate R1-H：E3-B Sandbox / MCP / Secret Slice

**目标：** 证明外部执行和数据泄漏的最高风险边界。

**首版范围：**

- 文件路径和工作目录边界阻止路径穿越；
- Sandbox Profile 不扩大显式 Permission；
- Tool/MCP Timeout 不拖死主 Loop；
- MCP Tool 不能绕过本地统一权限执行边界；
- 假 Secret 不进入 Trace、错误、Evaluation Artifact 和诊断输出；
- 高风险外部副作用沿用 E3-A 的审批来源。

**完成证据：**

- path traversal blocked；
- sandbox/permission 组合不发生权限升级；
- Tool/MCP timeout bounded；
- fake secret absent；
- MCP deny-no-execute；
- 每项承诺进入 Invariant-to-Evidence Matrix。

**非目标：** 不承诺跨平台 Sandbox 完全一致，不建设通用 Secret Scanner，不实现扩展 Marketplace 安全模型。

**停止/延期条件：** 若某平台缺少 Sandbox Runtime，必须显式报告 unsupported/degraded；不得把“未启用 Sandbox”描述成安全通过。

### Gate R1-I：E6-B 可投递评测闭环

**目标：** 将 E1/E2/E3 的证据整合成第一个可对外展示版本。

**首版范围：**

- 一张覆盖所有 R1 强制承诺的 Invariant-to-Evidence Matrix；
- Matrix 中每项承诺对应至少一个确定性检查，否则从 R1 声明中删除；
- 1 个真实但受控的 Coding Task；
- 1 个 Bad Case → Root Cause → Fix → Regression；
- 1 个 CI Gate；
- 1 份 Evaluation 报告；
- 1 条可现场演示的 Trace Timeline。

**真实模型实验规则：**

- 与确定性检查分开运行；
- 固定模型 Profile、Commit、任务版本和资源约束；
- R1 只报告逐 Trial Outcome；少于经过设计的重复样本时不报告成功率分布；
- 记录成本和环境限制；
- 不把几百分点差异解释为确定的模型优劣。

**R1 完成标准：**

```text
受控 Coding Task
  → Model Attempt
  → Retry / Recovery（若发生）
  → Tool Request
  → Permission Decision
  → Tool Result
  → Query Termination
  → Trace Inspector
  → Deterministic Grader
  → Evaluation Report
  → Bad Case Regression
```

并满足：

- 核心实现、证据和限制可由维护者解释；
- README 不夸大继承能力或阶段状态；
- Build、确定性检查和最小 CI 通过；
- 至少一个真实失败被定位并转化为回归；
- Invariant-to-Evidence Matrix 不存在无证据的强制承诺。

**非目标：** 不做多仓库排行榜，不用单任务宣称整体 Agent 成功率，不以简历文案是否完成判断工程 Gate。

**停止/延期条件：** 任何强制承诺若无法映射到可重复证据，必须删减承诺或回到对应 Gate；真实模型失败不得通过修改 Grader 掩盖，任务/Grader 有歧义时先修评测。

## 5. R1 后增强路线

### 5.1 E4 Context / Memory / Usage

E4 只做最高价值 Slice，不假设自动检索已经存在。

建议顺序：

1. Context Provenance：说明每类上下文从哪里来、为什么被加载；
2. Context Budget：system、project instructions、memory、history、tools、attachments 的预算；
3. Compaction Invariant：关键硬约束不静默丢失；
4. Memory Conflict：Memory 与当前源码冲突时信任源码并暴露冲突；
5. Retrieval Decision：先决定继续使用显式索引读取，还是实现窄的相关性检索；
6. Usage Accounting：先保证 Retry/Restart 不重复计数；
7. Cost Accounting：只有在建立版本化价格来源和未知价格语义后再启用。

E4 首版不承诺语义向量检索、智能动态预算或完整成本平台。

### 5.2 E5 Multi-Agent / Worktree

E5 使用一个受控并行任务证明：

- 任务 Owner 和依赖明确；
- 文件写入范围可在启动前检查冲突；
- Worktree Baseline 可解释；
- Parent/Child Trace 可关联；
- 一个子 Agent 超时或部分失败后能够交接；
- 主会话承担最终合并和验证责任；
- Worktree 删除前检查未提交、未跟踪和未合并工作。

不以 Agent 数量作为成果，不建设大规模 Agent Fleet。

### 5.3 E8 Developer Diagnostics

E1 的最小 Inspector 已经解决“Trace 可消费”。E8 只负责产品化：

- `/doctor` 的配置来源、Provider、Permission、Sandbox、MCP 和 Session 诊断；
- 面向开发者的失败解释和恢复建议；
- 安全可分享的诊断包；
- Evaluation 摘要；
- Diagnostic Correctness 与隐私检查。

若求职时间有限，E8 优先级高于 E7 和完整 E9，因为它能直接展示 Evidence → Explanation 的产品闭环。

## 6. 长期路线与降级处理

### 6.1 E7 Extension Ecosystem

当前真实基础是 Skills、Hooks、MCP、Agents 等独立扩展点，不是统一 Plugin 平台。因此 E7 状态应为：

```text
Foundation: partial
Klaude hardening: deferred
```

只有在出现至少两个需要统一治理的真实扩展生命周期问题后，才设计统一 Extension Contract。Marketplace、能力评分和扩展 Sandbox 化保留为研究方向，不进入 R1。

### 6.2 E9 Packaging / Compatibility / Release

R1 前只保持品牌和兼容性说明真实：项目名是 Klaude-Code，package/bin 仍兼容 `easy-agent` / `agent`。

完整 package 重命名、目录迁移、跨平台矩阵、升级回滚和公开贡献准备度进入长期路线。若公开投递需要安装体验，可单独做一个 Windows + 当前 Node LTS 的最小发行 Slice，不提前承诺三平台完整验证。

### 6.3 进程崩溃恢复

README 中“进程中断或崩溃后的 Session Recovery”不属于 R1 必做。正式路线必须二选一：

- 建立一个有 durability evidence 的窄 Crash/Resume Slice；或
- 明确首版只承诺 in-process retry/recovery，把 crash recovery 标为 deferred。

在没有实现和证据前，不使用笼统的“支持故障恢复”覆盖进程死亡场景。

## 7. 每个 Slice 的统一完成门

一个 Slice 只有同时满足以下条件才可标记 `evidenced`：

1. **Problem**：有具体失败或不可解释行为；
2. **Boundary**：真实调用链和责任边界已确认；
3. **Contract**：明确正常、失败、隐私和兼容语义；
4. **Implementation**：只修改解决该问题所需的最小边界；
5. **Trace/Evidence**：关键路径可观察；
6. **Verification**：风险驱动的聚焦检查通过；
7. **Bad Case**：至少记录一个失败或反例；
8. **Limitations**：明确未覆盖范围；
9. **Dev Doc**：记录问题、调用链、决策、改动和证据；
10. **Git State**：变更范围可解释，未吸收用户无关工作。

不以代码生成、文档页数、测试数量或一次真实模型成功作为阶段完成依据。

## 8. Evaluation 方法与指标

### 8.1 确定性 Harness 指标

- 生命周期完整性；
- sequence 单调性；
- Trace/Span/Tool 关联正确性；
- Permission Deny 后执行次数为 0；
- Secret 泄漏命中数为 0；
- Retry 不超过预算；
- Abort 后新业务动作数为 0；
- Writer/Tool/MCP Timeout 在预算内结束；
- Usage 不重复计数；
- Grader 能定位失败阶段。

### 8.2 真实 Agent Task 指标

- Outcome pass/fail；
- R1 报告逐 Trial Outcome，不挑选最佳一次；
- 只有在任务、环境和重复次数经过预先设计后，才汇总成功率或分布；
- 失败类别；
- Tool/Turn/Retry 数量；
- Duration；
- Token Usage；
- 已知价格时的 Cost；
- Infra Error 与 Harness Error 分离。

### 8.3 报告纪律

- 区分 Capability Eval 和 Regression Eval；
- 报告任务、环境、资源和模型版本；
- 小样本不输出虚假精度；
- 真实模型结果必须与确定性 Harness 检查分栏；
- 发现 Grader 不公平或任务歧义时，先修评测，不把问题归咎于模型；
- 把真实 Bad Case 转化为最小回归。

## 9. 求职材料交付包

R1 完成后至少准备：

- 一张从 Query 到 Evaluation 的架构图；
- 一条包含 Retry、Tool、Permission 和 Termination 的 Trace Timeline；
- 一份确定性 Evaluation 报告；
- 一个 Bad Case 修复前后对比；
- 一份安全/隐私边界说明；
- 一份项目真实限制说明；
- 2–3 条可量化、不过度声称的简历项目描述；
- 面试复盘：调用链、设计权衡、失败传播、验证策略、指标和未完成项。

推荐的项目表述是“production-oriented Agent Harness hardening”或“企业级能力加固路线”，不声称已经成为完整企业产品或 Claude Code/Codex 的生产替代品。

近期公开岗位和工程材料也强化了这一路线选择：Agent/Evals 岗位强调把模糊行为问题转成可测实验、持续 Evaluation、可靠性和跨基础设施/安全边界协作；Agent Eval 工程实践强调早期建立少量高价值任务、区分 Transcript 与 Outcome，并报告评测环境噪声。参考：

- [OpenAI — Research Engineer, Frontier Evals & Environments](https://openai.com/careers/research-engineer-frontier-evals-and-environments-san-francisco/)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic — Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise)

## 10. 主要风险与控制

| 风险 | 后果 | 控制 |
| --- | --- | --- |
| E0–E9 同时推进 | 所有阶段半成品 | 一次只授权一个 Slice |
| 继承能力被写成独立实现 | 简历可信度受损 | 双维状态与证据链接 |
| Trace 为 Eval 扩张隐私采集 | 泄漏用户内容 | Trace 与 Evaluation Record 分离 |
| Evaluation 太晚 | 改动无回归闭环 | E6-A 提前到 E1 后 |
| 真实模型结果噪声大 | 指标不可复现 | 固定环境、多个 Trial、区分 Infra Error |
| E4/E5 拖延核心交付 | 错过投递窗口 | R1 前只做 E1/E2/E3/E6 主线 |
| E7/E9 诱发范围膨胀 | 低价值重构 | 明确 deferred，按真实问题启动 |
| 文档继续漂移 | Agent 接班执行错误 | README/MainTask/Prompt 原子更新 |
| Trace I/O 阻塞主路径 | Agent 完成后卡死 | bounded close + degraded evidence |
| 持久化无限增长 | 隐私和磁盘风险 | retention owner + confined cleanup |

## 11. 推荐执行窗口

自然周排期作废，改用下列证据窗口。每个窗口完成后停止并等待下一次授权：

1. **Roadmap Repair**：统一编号、状态、目录和历史排期；
2. **E1-A Storage Contract**：Trace enablement、retention、bounded close、集成证据；
3. **E1-B Model/Retry/Stream Trace**；
4. **E1-C Tool/Permission Trace + Inspector**；
5. **E6-A Evaluation Foundation + Core CI**；
6. **E2-A Error/Retry/Provider Slice**；
7. **E2-B Streaming/Abort/Context Recovery Slice**；
8. **E3-A Tool/Permission Contract Slice**；
9. **E3-B Sandbox/MCP/Secret Slice**；
10. **E6-B Bad Case + Real Task + R1 Report**；
11. **R1 衍生材料**：仅在证据矩阵通过后更新 README、架构图、演示、简历和面试材料；
12. **R1 后选择**：E4、E5 或 E8，按求职反馈和真实 Bad Case 决定。

## 12. 下一步

本文被用户正式采纳后，下一项任务应是 **Roadmap Repair**，只修改路线和状态文档，不进入运行时代码。

Roadmap Repair 完成后，再为 **E1-A Storage Contract** 编写精确到符号、测试和命令的 Just-in-Time Implementation Plan。不得直接把本文当作一次性实现 E0–E9 的授权。
