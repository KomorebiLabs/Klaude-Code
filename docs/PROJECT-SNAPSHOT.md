# Klaude-Code 近期封箱快照

> 更新时间：2026-08-24  
> 状态：`maintenance-pause`  
> 作用：记录本轮集中开发结束时的真实能力、证据、限制和未来重启入口。

## 1. 封箱结论

Klaude-Code 已完成 Resume Release R1，并完成 R2 中优先级最高的 Developer Diagnostics、Context Provenance 与 Memory Governance。项目自本快照起进入近期维护暂停：没有正在执行或默认授权的下一 Stage，不承诺近期继续新增能力。

“封箱”不表示项目废弃、永久停止或已经成为完整企业产品。它表示当前成果已经形成可构建、可验证、可复盘的稳定快照；后续开发将在时间允许且重新明确授权后恢复。

## 2. 已完成范围

| 路线 | 已完成结果 | 证据状态 |
|---|---|---|
| PR-00～PR-03 | 路线治理、Trace 存储、Model/Retry/Stream、Tool/Permission Trace 与 Inspector | evidenced |
| PR-04～PR-09 | Evaluation Foundation、可靠性、恢复、安全与 Resume Release R1 | evidenced |
| PR-14 | Developer Diagnostics、安全报告与恢复指导 | evidenced |
| PR-10～PR-11 | Context Provenance、预算估算、Compaction 保真、Memory 生命周期治理 | evidenced |

按阶段计划 PR-00～PR-17 的口径，当前完成 13/18 个 Stage，约 72%。该数字只描述路线执行进度，不代表产品成熟度、真实模型成功率或企业生产就绪度。

统一确定性门禁为：

```bash
npm run verify:core
```

PR-10～PR-11 收口时，该门禁完整通过；Core Evaluation 为 passed，R1 Release Evaluation 为 passed，R1 assertions 为 29。

## 3. 当前仍然存在的边界

- npm package 仍名为 `easy-agent`，CLI 仍为 `agent`，尚未完成 E9 身份、配置和用户数据迁移。
- Context Token 为确定性估算，不是 Provider 账单；尚无完整 input/output/cache/cost 平台。
- Memory 没有向量检索、自动事实冲突合并或跨进程事务锁。
- Multi-Agent 基础能力来自继承实现；所有权、Parent/Child Trace、Worktree baseline、失败交接和恢复尚未完成独立加固。
- Extension/Plugin 治理、受控外部 Benchmark、Packaging/Release 尚未实施。
- R1 与 Post-R1 证据证明的是已登记不变量，不代表大规模真实用户、企业流量或 Claude Code/Codex 的完整替代能力。

## 4. 暂停期间规则

- 默认只接受必要的安全修复、构建修复、依赖兼容修复和文档事实校正。
- 不因路线文档列出后续任务而自动启动开发，不预写远期文件级计划。
- 不将计划项、继承能力或单次实验写成已完成成果。
- 保留 `AGENTS.md`、`CLAUDE.md` 和用户学习笔记的独立工作区边界。
- 每次修改仍需通过与风险相称的验证；涉及核心不变量时运行 `npm run verify:core`。

## 5. 未来候选顺序

恢复开发时建议按以下顺序重新评估，而不是机械连续执行：

1. **PR-12 — Multi-Agent Contract & Worktree Baseline**：任务契约、Owner/Dependency/Handoff、文件所有权和基线说明。
2. **PR-13 — Multi-Agent Recovery & Integration**：Timeout、Partial Completion、失败交接与主会话整合责任。
3. **PR-15 — Extension Governance**：扩展契约、Capability、Compatibility 和生命周期。
4. **PR-16 — External Benchmark**：受控真实模型 Trial、噪声说明和外部结果报告。
5. **PR-17 — Packaging & Release**：package/CLI 身份迁移、安装、升级、回滚、版本和发布。

PR-12 是当前建议优先级最高的候选，但不是已授权任务，也没有承诺日期。

## 6. 未来重启协议

新的开发窗口应依次执行：

1. 从 `github/main` 获取真实最新代码，核对分支、dirty files 和 ahead/behind；
2. 阅读本快照、`MainTask.md`、阶段性 PR 安排和目标 Stage 的前序 Dev Doc；
3. 运行 `npm run verify:core` 建立重启前基线；
4. 根据真实 Bad Case、求职价值和剩余时间重新选择一个 Stage；
5. 用户明确授权后，再为该 Stage 编写新的 JIT Implementation Plan；
6. 一个 Stage 一个 PR，完成代码、证据、Dev Doc 和限制说明后停止。

代码、测试和已合并提交优先于旧计划；若三者与本快照冲突，应先核实事实，再显式更新状态。
