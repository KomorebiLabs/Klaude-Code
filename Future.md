# Klaude-Code Future Roadmap

> 更新时间：2026-08-25<br>
> 当前状态：`maintenance-pause` 近期封箱，后续维护窗口再恢复开发<br>
> 本文性质：未来维护者和开发 Agent 的事实边界、问题清单与候选路线<br>
> 当前事实入口：[`docs/PROJECT-SNAPSHOT.md`](./docs/PROJECT-SNAPSHOT.md)

## 0. 先读这一节：未来 Agent 的工作边界

Klaude-Code 已完成 Resume Release R1、Developer Diagnostics、Context Provenance 和 Memory Governance v1。本轮路线按 PR-00～PR-17 的口径完成 13/18 个 Stage，约 72%；这个数字只表示路线执行进度，不表示产品成熟度或企业生产就绪度。

近期不启动新的功能开发。本文件列出的 PR-12、PR-13、PR-15、PR-16、PR-17 和其他探索方向都只是候选工作，不能因为它们出现在文档中就自动开始。

未来恢复开发时必须遵守：

1. 先同步并核对最新 `github/main`，检查分支、dirty files 和 ahead/behind；
2. 阅读本文件、`docs/PROJECT-SNAPSHOT.md`、`MainTask.md`、阶段计划和目标 Stage 的 Dev Doc；
3. 运行 `npm run verify:core`，把当前代码重新建立为基线；
4. 根据真实 Bad Case、求职展示价值和可用时间，只选择一个 Stage；
5. 获得明确授权后，为该 Stage 编写新的 JIT Implementation Plan；
6. 保持一个 Stage 一个 PR，PR 必须同时包含实现、证据、Dev Doc、限制和回滚边界。

如果代码、测试、合并提交与本文冲突，代码和合并提交优先；先核实事实，再修正文档，不得用猜测填补缺口。

## 1. 当前项目已经得到什么

### 1.1 Enterprise Harness 已形成的基础

- Trace Contract、JSONL Storage、脱敏和本地存储策略；
- Query、Model Attempt、Retry、Stream Restart、Tool、Permission 的结构化生命周期；
- Error Taxonomy、Retry Budget、Provider 最小公共语义；
- Streaming、Abort、Timeout、Context Recovery 和 Compaction 保真边界；
- `deny` 不可升级、`ask` 可被既有 Hook/bypass 消解的权限语义；
- Tool 输入校验、不可逆动作 at-most-once、Sandbox/MCP/Secret 安全边界；
- 独立 Evaluation Artifact Store、R1 Invariant-to-Evidence Matrix 和 `verify:core`；
- Developer Diagnostics、`/doctor`、安全诊断报告和恢复指导；
- Context Provenance、确定性预算估算、`context.assembled` 安全 Trace；
- Memory schema v2、source/revision/expiry/freshness、冲突保护、可恢复删除和 compaction invariant retention。

### 1.2 必须继续诚实标注的事实

- npm package 仍是 `easy-agent`，CLI 仍是 `agent`；Klaude-Code 身份、配置和用户数据迁移尚未完成；
- Token 预算是确定性估算，不是 Provider 账单；没有完整的 input/output/cache/cost 计费平台；
- Memory 仍是受治理的文件记忆，不提供向量语义检索、自动事实冲突合并或跨进程事务锁；
- Multi-Agent 继承能力可以运行，但尚未形成独立加固的任务契约、所有权、Parent/Child Trace、Worktree baseline、失败交接和主会话整合协议；
- Extension/Plugin 生命周期治理、受控真实模型 Benchmark、正式 Packaging/Release 尚未实施；
- 当前证据主要是确定性脚本和受控场景，不能外推大规模用户成功率、企业流量表现或对 Claude Code/Codex 的完整替代能力。

## 2. 现有项目仍存在的问题与改进方案

以下问题按“会不会阻碍可信使用、后续开发和面试解释”进行排序，而不是按代码量排序。

### P0：产品身份与发布闭环不完整

**事实与影响**

`package.json` 的名称仍为 `easy-agent`，可执行命令仍为 `agent`。这会让安装、文档、配置目录、用户数据和错误报告继续暴露继承项目身份，也使版本升级和回滚边界不清楚。

**建议方案**

单独实施 Packaging & Release 阶段：先定义兼容矩阵，再决定是否保留 `easy-agent` 作为兼容别名；增加版本策略、配置迁移、数据目录迁移、升级前备份、失败回滚、安装验证和变更日志。迁移必须可重复、可中断、可回滚，不能只改 package 名称。

**验收证据**

- 新安装和旧安装都能明确显示版本与产品身份；
- 旧配置、Trace、Memory 和用户命令有明确迁移或不迁移说明；
- 迁移失败不会破坏原数据；
- Windows、macOS、Linux 至少完成安装/启动/升级冒烟；
- 文档、CLI、package、配置目录和错误信息不再互相矛盾。

### P0：Multi-Agent 可运行，但责任边界还不够企业级

**事实与影响**

现有 Agent/Team/Worktree 能力来自继承基础，后台 Agent 也已有输出文件、状态通知和 Worktree 清理逻辑。但“谁负责什么、哪个文件属于谁、父任务如何判断子任务完成、失败后谁接管”尚未成为统一契约。并行修改一旦失败，最容易留下无法解释的半成品或错误合并。

**建议方案**

先做 PR-12 Multi-Agent Contract & Worktree Baseline，再做 PR-13 Recovery & Integration：

- 为任务定义 Owner、依赖、输入、输出、状态、超时和交接字段；
- 为每个子任务记录父任务 ID、子任务 ID、Worktree 路径、起始 commit、变更摘要和验证状态；
- 将“成功”“部分完成”“失败”“超时”“取消”定义为互斥且可持久化的状态；
- 主会话只接受带证据的交接，不把子 Agent 的自然语言结论直接当成事实；
- 保留失败 Worktree 和诊断材料，只有审计确认干净时才清理。

**验收证据**

至少一个受控并行任务应能证明：父子 Trace 可关联、文件归属可解释、成功和失败状态可恢复、超时不会静默丢失、主会话能基于验证结果决定合并或拒绝。

### P0：核心行为有证据，但真实使用的回归面仍需扩大

**事实与影响**

`npm run verify:core` 为确定性门禁，适合防止契约回归；但真实 Provider、不同模型、网络波动、长上下文、Windows 文件锁和多轮工具调用的组合行为仍不能由这套门禁完全覆盖。历史上部分 Windows 测试曾在临时目录清理阶段出现 `EBUSY`，这类环境限制必须与功能失败分开记录。

**建议方案**

先保持 Core CI 确定性，再增加隔离的外部 Trial 层：固定任务集、固定模型/Provider、成本上限、超时、脱敏 Artifact、噪声说明和失败分类。外部 Trial 不得反向污染 Core CI，也不得用少量成功样本声称总体成功率。

**验收证据**

- Core Gate 在无网络环境可重复通过；
- 外部 Trial 有任务版本、模型、时间、成本、环境和失败原因；
- 每个失败都能归类为产品缺陷、Provider/网络问题、环境问题或任务不适用；
- 报告同时展示样本量和限制，不只展示成功案例。

### P1：Context Provenance 能解释“装入了什么”，还不能完整解释“为什么这样取舍”

**事实与影响**

当前 Context Provenance 提供来源、类别、是否加载、字符数和确定性 Token 估算，也能生成不包含原文的 `context.assembled` 摘要。但估算不是 Provider tokenizer，系统还没有完整的来源优先级、裁剪决策、预算超限策略和可复现的上下文重放协议。长上下文问题因此仍可能表现为“结果变差但原因不够具体”。

**建议方案**

- 把 context source、priority、eligibility、omitted reason 和 truncation decision 纳入稳定契约；
- 为不同 Provider 提供可插拔 tokenizer/计费估算器，未知时明确标记估算性质；
- 将上下文装配决策与最终请求关联，但继续禁止落盘原始 Prompt/Message；
- 增加“预算不足时保留什么、舍弃什么、为什么”的确定性策略；
- 提供脱敏的 replay fixture，让同一输入能复现同一装配决策。

**验收证据**

相同输入、配置和版本下，装配结果、来源计数、裁剪原因和预算摘要一致；原文不进入 Trace；Provider 账单字段与估算字段不混用。

### P1：Memory 治理已经存在，但知识质量和并发语义仍有限

**事实与影响**

当前 Memory Governance 已覆盖 source、revision、expiry、legacy/stale、路径隔离和可恢复删除，但它仍主要依赖文件索引和显式规则。记忆越多，相关性选择、事实冲突、重复内容和多人/多进程并发写入越容易成为问题。

**建议方案**

- 保留当前文件格式作为可读、可迁移的事实源；
- 增加确定性的索引层，再按需要引入向量检索；索引损坏时必须能从文件重建；
- 将冲突处理设计为“检测—展示—人工确认/明确规则合并”，不要默认让模型静默覆盖事实；
- 增加跨进程锁、原子写、备份和恢复测试；
- 增加记忆质量检查：重复、过期、无来源、引用不存在路径和过度宽泛内容；
- 记录来源和版本，不保存可由当前仓库直接推导的内容。

**验收证据**

索引可重建、冲突不会静默丢失、并发写入不会破坏文件、删除可恢复、过期记忆不会被无提示地当作当前事实使用。

### P1：Provider 能力抽象和成本治理还不够完整

**事实与影响**

当前 API 客户端以 Anthropic SDK 为核心，并支持 Anthropic-compatible 的 `baseURL`/profile；这不是完整的 Provider 能力抽象。不同模型的上下文窗口、工具协议、流式事件、重试语义、Token 计费和错误分类仍可能存在差异。

**建议方案**

定义最小 Provider Contract：模型能力、上下文限制、工具/流式协议、错误映射、重试资格、Token/成本估算和隐私声明。适配器只负责协议差异，Harness 只依赖公共生命周期事件。对未知 Provider 使用保守降级，不把兼容端点自动宣称为完全兼容。

**验收证据**

至少两个协议/Provider 配置能通过同一组 Harness 契约；错误、重试、流式中断、工具调用和成本摘要均能解释；不支持的能力有明确错误而不是静默改变行为。

### P1：安全边界还需要从“实现安全”走向“持续验证安全”

**事实与影响**

当前已经有权限、Sandbox、MCP、Secret 和 Trace 脱敏边界，但安全问题具有组合性：路径 TOCTOU、跨平台命令差异、恶意 MCP 响应、扩展权限扩大、日志侧漏和 Worktree 清理都需要持续验证。

**建议方案**

- 为每个外部输入标出 source、normalization、validation、sink；
- 增加 Windows/macOS/Linux 的路径和进程差异测试；
- MCP/Extension 默认最小权限、能力声明和超时；
- 对 Secret 采用正向 allowlist 和结构化日志测试，不依赖黑名单；
- 对不可逆工具动作保留幂等/审计记录，并明确无法回滚的操作；
- 定期做依赖审计和安全回归，不把安全扫描结果等同于功能验证。

**验收证据**

拒绝矩阵、Secret redaction、Sandbox 边界、MCP 超时、Worktree 清理和异常路径各有可重复的负向测试与报告。

### P2：扩展生态、可观测性产品化和运维能力尚未形成

**事实与影响**

Skills、Commands、Agents、Hooks 和 MCP 已有多种扩展入口，但没有统一的 Extension Lifecycle Contract。未来扩展越多，版本兼容、权限声明、加载失败、隔离、卸载和供应链风险越难解释。

**建议方案**

实施 PR-15 Extension Governance：统一 manifest、版本/兼容范围、Capability、来源信任、加载阶段、失败降级、卸载和审计；将扩展错误隔离在扩展边界，不破坏主会话。

Diagnostics 后续再做产品化：提供稳定的报告 schema、可分享的脱敏包、基于 Trace 的时间线和常见失败的行动建议，但不能为了 UI 牺牲隐私或增加主路径耦合。

### P2：文档和代码事实需要持续防漂移

**事实与影响**

项目同时包含继承 Foundation Track 和 Klaude Enterprise Harness Track，且路线文档、Dev Doc、Evaluation 和 README 数量较多。长期维护最容易出现“旧文档写成已完成”“继承能力写成自研”“设计计划覆盖实现事实”。

**建议方案**

- 为每个 Stage 保留一个状态、证据入口和限制入口；
- 在 PR 模板中要求“实现事实、验证命令、失败/限制、未完成边界”；
- 任何状态变更都必须引用合并提交或可重复命令；
- 定期做文档链接检查和 stale claim 扫描；
- 不为远期阶段提前写死文件级方案，恢复时重新做 JIT。

## 3. 未来值得探索、且可能真正提升项目价值的内容

下面的方向不是全部都应该实现。优先选择能同时提升“真实可用性、工程厚度、可验证性和面试可解释性”的内容。

| 方向 | 价值 | 难度 | 建议时机 |
|---|---|---:|---|
| Multi-Agent Contract + Recovery | 让并行 Agent 从“能运行”变成“可审计、可接管、可恢复” | 高 | 第一优先 |
| Provider Capability + Cost Governance | 降低模型/供应商漂移，能解释延迟、Token 和成本 | 高 | 核心生命周期稳定后 |
| Context Decision Replay | 解释长上下文质量问题，形成可复现的调试材料 | 中高 | Context 治理下一步 |
| Memory Index/Conflict Workflow | 提升长期协作质量，避免记忆越积越脏 | 中高 | 有真实记忆规模后 |
| Controlled External Benchmark | 把确定性契约转成有限的真实行为证据 | 中高 | 有稳定任务集后 |
| Extension Governance | 让 Skills/Agents/Hooks/MCP 可安全扩展 | 高 | 生态需求出现后 |
| Packaging/Release/Migration | 让项目真正可安装、升级、回滚和对外使用 | 高 | 对外发布前必须做 |
| Crash-safe Session Resume | 进程崩溃或机器重启后恢复会话、任务和证据 | 高 | 生产化需求出现后 |
| Trace Timeline / Explain UI | 将诊断证据转成维护者能快速理解的时间线 | 中 | Diagnostics 稳定后 |
| 本地模型/离线模式 | 降低隐私和成本，扩大可运行环境 | 高 | Provider Contract 稳定后 |

不建议优先投入的方向：为了展示效果增加大量 UI、没有任务集支撑的“智能评分”、没有权限模型的插件市场、没有真实问题驱动的向量数据库，以及只增加配置项但没有验证证据的“大而全”抽象。

## 4. 后期最急需实现的内容

“急需”按恢复开发后的先后分为三层。封箱期间不执行这些内容。

### A. 恢复开发后第一批：先补可靠边界

1. **PR-12 Multi-Agent Contract & Worktree Baseline**
   - 统一任务状态、Owner、Dependency、Handoff 和父子关联；
   - 固化 Worktree 起始 commit、变更检测、验证结果和保留/清理条件；
   - 目标是让任何并行任务都能回答“谁改了什么、基于什么、是否验证、现在谁接管”。

2. **PR-13 Multi-Agent Recovery & Integration**
   - 覆盖 timeout、abort、partial completion、model error、merge conflict 和主会话重启；
   - 保留失败现场，防止后台任务静默失败或错误报告成功；
   - 目标是让父任务能基于结构化证据做整合决定。

3. **Provider/Context/Cost 基线补强**
   - 明确估算字段与账单字段；
   - 统一 Provider 能力与错误映射；
   - 记录可解释的 context budget、裁剪和重试原因。

### B. 对外使用前：补可交付边界

4. **PR-17 Packaging & Release**
   - 如果项目要给其他人安装或作为简历作品现场演示，这一项的优先级可以提前；
   - 完成身份迁移/兼容别名、配置与数据迁移、安装、升级、回滚和发布说明；
   - 没有这一步，项目更像一个可研究的源码快照，而不是稳定可交付工具。

5. **PR-15 Extension Governance**
   - 在扩展数量增加或允许第三方扩展前完成；
   - 没有 Capability、信任和生命周期边界，不应急于建设插件生态。

### C. 需要真实证据后：补外部可信度

6. **PR-16 Controlled External Benchmark**
   - 建立小而稳定的任务集、固定环境和成本预算；
   - 报告成功、失败、延迟、Token、重试和环境噪声；
   - 不追求漂亮单项数字，优先建立可复现、能解释失败的证据。

7. **Memory Quality 与 Session Resume**
   - 当真实使用产生足够的记忆和崩溃案例后再实现；
   - 先用真实 Bad Case 决定是否需要语义检索、冲突工作流或更强的持久化，不提前堆复杂基础设施。

## 5. 推荐的未来路线

```text
封箱维护
   │
   ├─ 必要修复：安全 / 构建 / 依赖兼容 / 文档事实
   │
   └─ 重新授权后
       │
       ├─ 重新基线 + JIT Plan
       │
       ├─ PR-12 Multi-Agent Contract
       │      └─ PR-13 Recovery & Integration
       │
       ├─ Provider / Context / Cost 治理（按真实问题拆分）
       │
       ├─ PR-15 Extension Governance（出现生态需求后）
       │
       ├─ PR-16 External Benchmark（任务集稳定后）
       │
       └─ PR-17 Packaging & Release（对外发布前）
```

这不是必须连续执行的流水线。每一阶段完成后都应重新检查真实需求、时间和证据；如果新的阶段不能提升可验证能力或解决真实 Bad Case，就不应仅为提高路线百分比而启动。

## 6. 每个未来 PR 的完成标准

未来任何阶段只有同时满足以下条件，才可以标记为完成：

- 问题边界和非目标写进 JIT Plan；
- 先写或明确可执行的验收不变量；
- 真实调用链和影响范围已核对；
- Trace、日志、诊断没有泄露 Prompt、Message、Tool 正文或 Secret；
- 主路径失败语义、权限语义和兼容行为没有被观测代码改变；
- 至少有一条成功证据和一条失败/边界证据；
- 运行与风险相称的 focused check，核心变更运行 `npm run verify:core`；
- Dev Doc 记录实际改动、验证输出、环境限制和未完成项；
- README、Evaluation、路线状态和简历事实没有超出证据；
- PR body 用中文说明背景、改动、验证、限制和后续唯一候选。

## 7. 给未来的自己和 Agent 的最后提醒

这个项目最有价值的部分，不是继续堆叠功能数量，而是能清楚证明：一个 Agent Harness 如何观察生命周期、控制副作用、处理失败、保护隐私、解释上下文，并在证据不足时承认边界。

未来开发应优先增加“可解释性、可恢复性、可交付性和真实证据”，而不是追求路线数字、复杂名词或一次性演示效果。任何新能力都必须回答四个问题：

1. 它解决了哪个真实问题？
2. 它改变了哪条调用链或系统边界？
3. 它如何证明成功、失败和安全边界？
4. 如果它失败，用户和主会话如何恢复？

在没有新的时间窗口和明确授权之前，停在当前封箱状态是合理的工程决策，不是项目失败。
