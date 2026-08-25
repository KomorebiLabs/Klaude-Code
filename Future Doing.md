# Klaude-Code Future Doing

> 更新时间：2026-08-25<br>
> 当前状态：maintenance-pause，所有工作包均为 deferred<br>
> 文件用途：未来恢复开发后，按工作包拆开、复制、改写为 JIT Plan 后执行<br>
> 当前事实入口：[docs/PROJECT-SNAPSHOT.md](./docs/PROJECT-SNAPSHOT.md)<br>
> 长期判断入口：[Future.md](./Future.md)

## 0. 重要声明：这是可执行素材，不是当前授权

本文件把未来工作拆成多个独立工作包，目的是让未来的自己或开发 Agent 能够快速恢复上下文、选择一个阶段并开始写新的 JIT Plan。

本文件不表示：

- 当前已经开始 PR-12、PR-13、PR-15、PR-16 或 PR-17；
- 未来一定按这里的顺序实施；
- 下面写出的候选文件、符号和命令不需要重新核对；
- 设计稿、工作包或验收标准本身就是实现证据。

每次恢复开发时，必须重新核对最新代码和合并提交。未来文件只能减少重新理解项目的成本，不能替代当前代码事实。

## 1. 文件之间如何配合

~~~text
docs/PROJECT-SNAPSHOT.md
    │  当前真实状态、已完成证据、限制、封箱规则
    ▼
Future.md
    │  问题判断、价值排序、未来方向、决策依据
    ▼
Future Doing.md
    │  可拆分工作包、操作顺序、验收、停止条件
    ▼
新的 JIT Implementation Plan
    │  当前唯一授权 Stage 的精确文件和任务
    ▼
代码 + focused evidence + Dev Doc + PR
~~~

使用原则：

1. 先从 Snapshot 确认项目没有活动 Stage；
2. 从本文件只选择一个工作包；
3. 把工作包复制为新的 docs/superpowers/plans/YYYY-MM-DD-<stage>-implementation-plan.md；
4. 根据最新代码删掉失效假设，补充真实符号、调用链和文件；
5. 得到用户授权后才修改运行时代码；
6. 一个工作包对应一个 PR，完成后更新 Snapshot、Future、路线状态和 Dev Doc。

## 2. 所有工作包通用的恢复操作

### 2.1 开始前：确认没有误操作范围

~~~powershell
Get-Location
git branch --show-current
git status --short
git fetch github main --prune
git rev-list --left-right --count github/main...HEAD
~~~

解释结果时必须区分：

- 当前分支是否就是未来开发分支；
- github/main 是否包含新的合并提交；
- dirty files 是否为当前用户已有文件；
- AGENTS.md、CLAUDE.md、学习笔记和临时目录是否应该排除。

不能自动 reset、checkout、clean、stash、rebase 或覆盖用户文件。需要同步时先说明差异和风险。

### 2.2 建立重启基线

~~~powershell
npm run verify:core
~~~

记录：

- 命令和 commit；
- Node/npm/操作系统；
- 通过的脚本数量或核心断言数量；
- 已知的 Windows EBUSY、网络、Provider 或临时目录限制；
- 是否存在与当前工作包相关的已有失败。

如果基线失败，先判断是历史失败、环境失败还是代码回归。没有基线就不能把后续新失败归因于新改动。

### 2.3 重新探索当前代码

只探索目标工作包相关的内容，避免一次性读取整个仓库：

1. 先读目标 Stage 的 Spec、旧 Plan 和 Dev Doc；
2. 用 rg 搜索入口、事件名、状态和测试脚本；
3. 如果涉及函数、类或方法，先运行 GitNexus impact；
4. 再读目标符号的上下游调用点；
5. 把实际调用链写进 JIT Plan；
6. GitNexus 过慢或索引落后时，记录原因并使用当前源码、调用点搜索和聚焦验证作为事实依据。

涉及代码符号时的最低阅读链：

~~~text
目标入口 → 状态/契约 → 持久化/副作用 → 失败路径 → 现有验证
~~~

### 2.4 JIT Plan 必须具备的字段

新的 JIT Plan 至少包含：

- Stage 和用户问题；
- 当前代码事实和真实调用链；
- 明确目标与非目标；
- 数据、事件、权限和兼容边界；
- 任务拆分及依赖顺序；
- 每个任务的验收标准、验证命令和预计影响文件；
- 隐私、安全、失败和回滚方案；
- 预期 Dev Doc、Evaluation 或 Artifact；
- 停止条件和唯一下一候选；
- 不确定项和需要用户确认的决策。

## 3. 工作包索引

| ID | 工作包 | 解决问题 | 前置条件 | 默认优先级 | 状态 |
|---|---|---|---|---:|---|
| F-00 | Restart Baseline | 从封箱安全恢复开发 | 用户授权一个 Stage | 必做 | deferred |
| F-12 | Multi-Agent Contract | 并行任务缺少统一责任契约 | F-00 | P0 | deferred |
| F-13 | Multi-Agent Recovery | 子任务失败、超时和交接不可解释 | F-12 | P0 | deferred |
| F-CONTEXT | Provider / Context / Cost | 预算、Provider 差异和上下文取舍解释不足 | F-00，按真实 Bad Case 拆分 | P1 | deferred |
| F-15 | Extension Governance | 扩展入口缺少能力、信任和生命周期契约 | F-00，出现生态需求 | P1/P2 | deferred |
| F-16 | External Benchmark | 缺少真实模型行为证据 | Core Gate 稳定、任务集稳定 | P1/P2 | deferred |
| F-17 | Packaging & Release | 无完整身份、迁移、升级和回滚闭环 | 发布目标明确 | P0（对外发布时） | deferred |
| F-MEMORY | Memory Quality | 记忆规模、冲突和并发质量不足 | 真实记忆 Bad Case | P1/P2 | deferred |
| F-RESUME | Crash-safe Session Resume | 进程崩溃后任务和证据恢复不足 | 生命周期契约稳定 | P1/P2 | deferred |

## 4. F-00：Restart Baseline 工作包

### 目标

把维护暂停状态安全地转换为一个经过授权、可验证、范围明确的开发窗口。F-00 不修改功能代码，也不等同于开始 PR-12。

### 操作步骤

1. 阅读 Snapshot、Future、本文件和目标 Stage 文档；
2. 执行 2.1 的 Git 状态核对；
3. 执行 npm run verify:core；
4. 选择一个真实问题并写出一句话目标；
5. 确认非目标，例如“不做 Provider 迁移、不做 UI 重构、不做向量检索”；
6. 检查目标 Stage 的旧文档是否仍与当前源码一致；
7. 新建 JIT Plan，并等待用户明确授权后再实施。

### 交付物

- 新的 JIT Plan；
- 重启基线记录；
- 当前 Git 状态和未纳入文件说明；
- 一个唯一授权 Stage；
- 如果不满足条件，输出 blocked/maintenance 状态和原因。

### 停止条件

- 没有明确问题；
- 基线失败且无法归因；
- 工作包需要同时修改两个以上独立子系统；
- 用户没有授权；
- 发现当前代码已经解决了原问题。

## 5. F-12：Multi-Agent Contract & Worktree Baseline

### 目标

为现有 Agent、Team、Background Agent 和 Worktree 能力建立统一的任务契约，让父会话能判断子任务是否真实完成，而不是只接收一段自然语言总结。

### 必须先确认的事实

- 当前 Agent 入口、后台 Agent 入口、Team 入口是否共享同一个运行生命周期；
- Worktree 创建、基线记录、变更检测和清理分别由哪些函数负责；
- 当前状态存储、通知、输出 JSONL 和 Trace 是否已有可复用字段；
- 当前哪些路径会产生 Parent/Child 关系，哪些路径仍没有 Trace；
- 现有权限和取消语义是否允许子 Agent 继续运行。

### 建议契约字段

字段必须根据当前类型系统和存储方式调整，不能直接照抄：

- taskId、parentTaskId、agentId；
- owner、dependencies、handoffTo；
- status：queued、running、succeeded、partial、failed、timed_out、cancelled；
- worktreePath、worktreeBranch、baseCommit；
- inputSummary、outputSummary、changedFiles；
- verificationStatus、verificationCommands、failureReason；
- startedAt、finishedAt、retentionPolicy。

敏感正文不能因为新增契约而落盘。Prompt、Message、Tool input/output、命令正文和 Secret 继续遵循 Trace allowlist。

### 建议任务拆分

#### F-12.1 任务状态与生命周期契约

- 定义状态集合、合法迁移和终态；
- 明确重复完成、取消后完成、超时后回报等竞态；
- 为非法状态迁移提供可诊断错误；
- 为旧调用者保留兼容默认值，不能改变现有主路径失败语义。

验收：所有合法迁移可验证，非法迁移被拒绝，终态不会被静默覆盖。

#### F-12.2 Parent/Child 与 Owner/Handoff

- 建立父子关联和 Owner；
- 明确依赖未完成时子任务是否可以启动；
- 明确交接由谁发起、谁接收、接收依据是什么；
- 输出结构化 handoff，而不是只传递文本。

验收：父任务能列出子任务状态、Owner、依赖和最后证据。

#### F-12.3 Worktree Baseline 与文件归属

- 记录起始 commit、分支、Worktree 路径和预存 dirty 状态；
- 只把基线之后的变化归因于子任务；
- 明确新 commit、未提交修改、未跟踪文件和冲突的处理；
- 清理前保留必要审计信息。

验收：至少一个并行修改场景能准确报告 changed files 和 base commit，清理不会删除未审计成果。

#### F-12.4 Contract Evidence

- 增加 focused smoke script 或沿用现有脚本风格；
- 生成不含敏感正文的结构化证据；
- 更新对应 Evaluation Matrix、Dev Doc 和 Snapshot 状态。

### 明确不做

- 不在本 PR 实现完整失败恢复；
- 不重新设计全部 Agent UI；
- 不引入新的数据库或消息队列，除非当前代码事实证明文件存储无法满足契约；
- 不把已有继承能力重新包装成已完成的 Enterprise Contract。

### 完成门槛

npm run verify:core、F-12 focused checks、至少一个受控并行成功场景和一个边界/失败场景全部有证据；否则保持 in-progress 或 blocked。

## 6. F-13：Multi-Agent Recovery & Integration

### 目标

在 F-12 契约之上，处理 Timeout、Abort、Partial Completion、Model Error、Merge Conflict、Process Restart 和失败交接，使后台 Agent 失败时不会静默丢失或伪装成功。

### 建议任务拆分

#### F-13.1 失败分类与状态落盘

- 统一错误、超时、取消、部分完成的分类；
- 记录最后安全状态、最后验证结果和未完成项；
- 区分 Agent 失败和清理失败；
- 不因诊断写入失败而改变主 Agent 的核心失败语义。

#### F-13.2 失败 Worktree 保留与恢复

- 失败时默认 fail-closed，保留 Worktree 和必要摘要；
- 明确何时可重试、何时只能人工接管；
- 重试不能重复不可逆工具动作；
- 恢复任务必须携带原任务和基线关联。

#### F-13.3 主会话整合

- 父会话读取结构化 handoff；
- 对 changed files、验证命令和失败原因做一致性检查；
- 合并冲突、验证失败和部分完成不能显示为成功；
- 只有主会话或明确 Owner 才能决定最终整合。

#### F-13.4 受控失败矩阵

| 场景 | 预期结果 |
|---|---|
| 子 Agent 成功 | 有 Parent/Child 关联、变更和验证证据 |
| 模型错误 | 状态为 failed，保留错误分类和现场 |
| 超时 | 状态为 timed_out，不伪装成 succeeded |
| 用户取消 | 状态为 cancelled，说明是否有残留修改 |
| 部分完成 | 状态为 partial，列出已完成和未完成项 |
| Worktree 冲突 | 停止自动整合，交给 Owner 判断 |
| 清理失败 | 与任务失败分开记录，保留路径和诊断 |

### 明确不做

- 不承诺自动解决所有 Merge Conflict；
- 不把模型自行生成的总结作为唯一恢复依据；
- 不删除失败 Worktree 以追求目录干净；
- 不新增跨进程分布式调度，除非有真实需求和单独 JIT Plan。

## 7. F-CONTEXT：Provider / Context / Cost 治理

### 触发条件

只有出现真实 Bad Case，例如“上下文被裁剪导致任务失败”“不同 Provider 的流式/重试语义不一致”“无法解释 Token 成本”，才启动该工作包。

### 可拆分子阶段

1. Provider Capability Contract：模型能力、上下文窗口、工具协议、流式协议、错误映射和重试资格；
2. Context Decision Replay：来源优先级、预算、裁剪、遗漏原因和可重复装配；
3. Cost Ledger：estimated tokens、provider usage、cache usage、latency 和 cost 分开记录；
4. Compatibility Matrix：至少两个配置/Provider 的统一 Harness 契约和已知差异。

### 操作原则

- 先复现 Bad Case，再决定新增哪个子阶段；
- 继续禁止落盘完整 Prompt、Message、Tool 正文和 Secret；
- 未知 tokenizer 时标记为 estimate，不伪装成账单；
- Provider 适配器隔离协议差异，Harness 生命周期不绑定具体 SDK；
- 账单字段缺失时明确 unknown，不填零制造假精确度。

### 验收

相同输入、配置、版本和预算下，Context 装配决策可复现；不同 Provider 的差异可解释；成本、Token、延迟字段来源明确；不支持能力会显式失败或保守降级。

## 8. F-15：Extension Governance

### 触发条件

只有项目确实需要允许第三方或更多内部扩展时启动。现有 Skills、Commands、Agents、Hooks、MCP 入口不能因为数量增加就自动视为统一扩展系统。

### 建议任务拆分

- Extension manifest 和 schema version；
- Capability、权限和信任来源；
- 版本兼容与加载顺序；
- 加载失败、禁用、卸载和恢复；
- 扩展隔离、超时和资源限制；
- 审计事件与 Secret/Prompt 隔离；
- 文档、示例和兼容矩阵。

### 验收

一个合法扩展、一个不兼容扩展、一个越权扩展和一个加载失败扩展都能得到明确、可解释且不会破坏主会话的结果。

## 9. F-16：Controlled External Benchmark

### 前置条件

- npm run verify:core 稳定；
- 任务集版本固定且不包含用户隐私；
- Provider、模型、环境、成本和超时可记录；
- 有独立 Artifact 存储策略和删除方式；
- 用户明确允许产生外部模型调用成本。

### 操作步骤

1. 定义任务类别和成功条件；
2. 为每个任务写 deterministic pre-check；
3. 固定模型、参数、超时、重试和成本预算；
4. 运行小规模 Trial，不把 Trial 直接混入 Core CI；
5. 记录成功、失败、延迟、Token、重试和环境噪声；
6. 对失败做 Root Cause 分类；
7. 只有重复回归后才能声称修复；
8. 输出 JSON/Markdown 报告并标注样本量和限制。

### 禁止结论

- 禁止根据少量 Trial 声称总体成功率；
- 禁止将网络/Provider 失败算成产品成功或失败而不分类；
- 禁止把模型输出正文写入默认 Trace/Artifact；
- 禁止为了分数修改任务或 Grader 而不保留版本历史。

## 10. F-17：Packaging & Release

### 目标

让项目从可研究源码快照变成可安装、可升级、可回滚、可解释的交付物。

### 建议顺序

1. 盘点 package name、CLI、配置目录、Memory、Trace、Artifact 和环境变量；
2. 定义 easy-agent 兼容策略和 Klaude-Code 新身份；
3. 设计配置/数据迁移版本与备份；
4. 实现安装、启动、升级、失败回滚和卸载说明；
5. 建立版本、变更日志和发布 Artifact；
6. 做 Windows/macOS/Linux 最小冒烟；
7. 更新 README、示例、错误提示和 Support 信息。

### 验收

- 新用户能按 README 安装并启动；
- 旧用户的配置和数据有明确兼容或迁移结果；
- 迁移失败能恢复原数据；
- 发布版本和源码 commit 可追溯；
- CLI、package、文档和目录身份一致；
- 未支持的平台和功能有明确说明。

## 11. F-MEMORY：Memory Quality

### 触发条件

收集到重复记忆、错误记忆、冲突事实、过期记忆被使用、索引损坏或并发写入失败等真实案例后再启动。

### 建议顺序

1. 先做质量检查命令：重复、过期、无来源、无效引用；
2. 再做可重建索引，不先改变文件事实源；
3. 再做冲突检测和人工确认流程；
4. 最后按并发需求增加锁、原子写、备份和恢复；
5. 有足够规模和检索 Bad Case 后，才评估向量语义检索。

### 验收

索引损坏可重建、冲突不会静默覆盖、并发写不会破坏文件、过期内容有明确状态、删除可恢复、当前仓库事实优先于旧记忆。

## 12. F-RESUME：Crash-safe Session Resume

### 触发条件

出现真实的进程崩溃、机器重启、Provider 中断或长任务恢复需求后再启动。

### 建议任务

- 定义 Session、Query、Agent Task 和 Worktree 的恢复边界；
- 记录最后安全检查点，而不是盲目重放所有工具动作；
- 对不可逆动作记录 at-most-once 状态；
- 对未确认副作用采用 ask/人工确认；
- 恢复后重新校验当前代码、配置、权限和工作区；
- 输出恢复报告和未恢复项。

### 验收

模拟进程中断后，系统能明确恢复、跳过或要求确认；不会重复执行已完成的不可逆 Tool；用户能看到未完成项和恢复原因。

## 13. 通用 PR 执行模板

未来每个工作包都按以下顺序处理：

### 阶段 A：调查

- [ ] 读 Snapshot、Future、目标 Spec/Plan/Dev Doc；
- [ ] 核对最新代码、分支和 dirty files；
- [ ] 运行 npm run verify:core；
- [ ] 建立真实调用链和影响范围；
- [ ] 找到一个真实 Bad Case 或明确需求。

### 阶段 B：计划

- [ ] 写目标和非目标；
- [ ] 写契约、不变量和失败语义；
- [ ] 拆成可在一个 PR 内完成的纵向任务；
- [ ] 为每个任务写验证命令和停止条件；
- [ ] 明确用户需要确认的决策；
- [ ] 获得本阶段授权。

### 阶段 C：实现

- [ ] 先做最小垂直切片；
- [ ] 修改符号前完成 GitNexus impact，或记录索引不可用原因；
- [ ] 保持 Trace/Diagnostics best-effort，不改变主路径；
- [ ] 保持隐私 allowlist，不落盘敏感正文；
- [ ] 不顺手扩展到相邻 Stage。

### 阶段 D：验证

- [ ] 运行 focused checks；
- [ ] 运行成功场景；
- [ ] 运行失败、取消、超时或边界场景；
- [ ] 核对隐私、权限、幂等和恢复证据；
- [ ] 必要时运行 npm run verify:core；
- [ ] 运行 git diff --check、链接检查和 GitNexus detect-changes；
- [ ] 记录环境限制，不把限制伪装成通过。

### 阶段 E：交付

- [ ] 写 Dev Doc；
- [ ] 更新 Evaluation/Matrix；
- [ ] 更新 Snapshot、Future 和路线状态；
- [ ] 检查 README 与实际能力一致；
- [ ] 只暂存本阶段文件；
- [ ] 提交前向用户报告 Git 状态和验证结果；
- [ ] PR body 使用中文，包含背景、改动、证据、限制、未完成项和唯一下一候选。

## 14. 可直接复制的 JIT Plan 骨架

~~~markdown
# JIT Implementation Plan: [Stage / 工作包]

## 1. 授权与边界

- 用户授权：
- 当前分支/基线 commit：
- 目标问题：
- 目标结果：
- 非目标：
- 唯一 PR：

## 2. 当前事实

- Snapshot 状态：
- 真实调用链：
- 相关符号与影响范围：
- 已有证据：
- 已知限制：

## 3. 契约与不变量

- 状态/事件契约：
- 成功不变量：
- 失败不变量：
- 隐私边界：
- 权限/副作用边界：
- 兼容边界：

## 4. 实施任务

### Task 1: [标题]

- 目标：
- 预计文件/符号：
- 依赖：
- 验收标准：
- focused verification：
- 失败/停止条件：

### Task 2: [标题]

- 目标：
- 预计文件/符号：
- 依赖：
- 验收标准：
- focused verification：
- 失败/停止条件：

## 5. 证据计划

- 成功场景：
- 失败/边界场景：
- 隐私证据：
- 安全/权限证据：
- 回归命令：
- Artifact/报告位置：

## 6. 交付清单

- [ ] 代码完成
- [ ] focused checks 通过
- [ ] npm run verify:core（如适用）
- [ ] Dev Doc
- [ ] Evaluation/Matrix
- [ ] Snapshot/Future 状态
- [ ] git diff --check
- [ ] GitNexus change detection
- [ ] 中文 PR body

## 7. 未完成与唯一下一候选

- 未完成：
- 环境限制：
- 不应声称的内容：
- 唯一下一候选：
~~~

## 15. 未来 Agent 的最小输出格式

当未来 Agent 执行某个工作包时，结束时至少输出：

1. 完成了什么，哪些没有完成；
2. 修改了哪些文件和符号；
3. 真实调用链和关键设计决策；
4. 成功、失败、隐私和安全验证结果；
5. 测试/构建命令的真实输出和环境限制；
6. 当前 Git 状态，未纳入哪些用户文件；
7. 当前 Stage 是否真的完成；
8. 唯一下一候选，或明确回到维护暂停。

如果没有证据，只能说“未验证”或“blocked”，不能用“应该可以”“看起来完成”替代验证。

