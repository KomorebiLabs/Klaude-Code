---
title: "Klaude-Code 新开发窗口启动提示词"
date: 2026-08-06
updated: 2026-08-24
status: active
execution_model: one-authorized-pr-stage-per-window
---

# Klaude-Code 新开发窗口启动提示词

> 每个开发窗口只执行一个已获用户授权的 PR Stage。不得因为本文列出了后续阶段而提前修改、Commit、Push、创建 PR 或合并。

权威顺序：长期方向读 [MainTask.md](./MainTask.md)，审计依据读[修订路线](../plans/2026-08-24-enterprise-harness-revised-development-roadmap.md)，执行顺序读[阶段性 PR 安排](../plans/2026-08-24-enterprise-harness-staged-pr-plan.md)，最后读取当前 Stage 的 JIT Implementation Plan。

## 0. 所有窗口统一约定

开始时核对工作目录、分支、dirty files、相对 github/main 的 ahead/behind；阅读 AGENTS.md、CLAUDE.md、权威路线、JIT Plan 和前序交接；区分既有改动与本窗口改动。修改函数、类或方法前运行 GitNexus upstream impact，HIGH/CRITICAL 风险先告知用户。

实现时保持 Trace/Diagnostics 对 Prompt、Provider Request、Tool/Permission Result、Usage 和终止语义非干扰；默认不持久化 Prompt、完整消息、完整 Tool I/O、命令、文件正文、stdout/stderr、Secret 或 Provider 原始 Body。只做风险驱动的必要验证，一个 PR 只处理一个 Stage。

结束时报告完成目标、未完成项、修改文件/符号、验证结果、安全与非干扰证据、失败/限制、Git 状态和唯一下一候选 Stage。未经授权不得 commit、push、merge、rebase、创建 PR、删除 Worktree 或自动开始下一 Stage。

## 1. PR-00 / R0 Roadmap Repair

只修复治理文档：统一 E5 = Multi-Agent、E6 = Evaluation；将领域编号与执行顺序分离；引入 Foundation/Klaude hardening 双维状态；把失效周计划改为 PR-00～PR-09 证据门；校正 docs 实际入口。

允许修改 README.zh-CN.md、docs/README.md、MainTask.md、Prompt.md 和本 Stage 计划/交接。不得修改运行时代码，不得移动或删除学习文档。完成后下一候选是 PR-01。

## 2. PR-01 / R1-A Trace Storage & Availability Contract

只收口 Trace 启用/降级、Session Persistence 关系、age/quota Retention、安全目录删除、Writer close 时间预算、兼容读取和 Query 生命周期真实集成证据。

证明挂起 Writer 不无限阻塞 Query、Retention 不越界、假 Secret/正文不落盘、finished/failed/aborted/disabled-or-degraded 均可验证。不得接入 Model/Tool/Permission 新事件或建设 Inspector。涉及历史数据迁移或默认隐私变化时停止并先形成 ADR。完成后下一候选是 PR-02。

## 3. PR-02 / R1-B Model / Retry / Stream Trace

只建立 Query→Model Request→Retry/Restart→Completion/Failure 因果链，区分 turnId、request span、API attempt 和 sequence，Trace Context 对 legacy caller 可选。用相同 Mock 输入做 Trace on/off 成对验证。不得改写 Retry Policy、统一全部 Provider 或接入 Tool/Permission。完成后下一候选是 PR-03。

## 4. PR-03 / R1-C Tool / Permission Trace & Minimal Inspector

只在真实 Permission/Tool 边界记录 requested/resolved/started/completed/failed，并为并发 Tool 使用独立 Span；增加按 sequence 输出安全时间线的最小 Inspector。证明 Tool success/failure、Permission Deny 执行计数为 0、并发 Span 不串线和 Trace on/off 结果一致。不得重构完整 Permission/Sandbox/MCP 或建设 Dashboard。完成后下一候选是 PR-04。

## 5. PR-04 / R1-D E6-A Evaluation Foundation

只建立 Task/Trial/Grader/Result 窄契约、独立 Evaluation Artifact Store、Invariant-to-Evidence Matrix、JSON/Markdown 报告、verify:core 和 Fake Provider deterministic CI。首批不变量覆盖 Trace lifecycle、隐私、Permission Deny 和 Writer Failure Isolation。真实网络或随机模型 Grader 不进入 Core CI，隐私未定义前禁止 Artifact 落盘。完成后下一候选是 PR-05。

## 6. PR-05 / R1-E Error Taxonomy / Retry / Provider

只统一 transient/permanent/rate_limited/provider_protocol、Retry Budget/Attempt/Backoff/Retry-After，以及主要 Provider 的最小公共语义。证明 transient→retry success、permanent→no retry、预算不越界、Partial Output 不重放；无法统一的字段保留 provider-specific extension。不得处理 Abort、Context Overflow 或进程恢复。完成后下一候选是 PR-06。

## 7. PR-06 / R1-F Streaming / Abort / Context Recovery

写代码前强制复核范围；若 Streaming、Abort、Compaction 无法形成一个可独立审查 PR，停止并提议拆分，等待用户重新授权。只处理建流前/Partial Stream 区分、Restart/Continuation、Abort/Timeout 资源释放和 Context Overflow 主路径。不得做进程崩溃恢复或 E4 Memory。完成后下一候选是 PR-07。

## 8. PR-07 / R1-G Tool / Permission Safety Contract

只建立 entry point × mode × decision source × outcome × executed 矩阵、Tool 输入输出安全边界、高风险动作和不可逆动作重试边界。证明 deny/block 不执行、决策路径可解释、不可逆动作不因恢复重复。不得重构 Sandbox/MCP。完成后下一候选是 PR-08。

## 9. PR-08 / R1-H Sandbox / MCP / Secret Safety

只收口 cwd/路径穿越/进程/timeout/输出/回收、MCP Permission/Timeout/Failure Isolation 和诊断 Secret Safety。证明路径穿越阻止、Timeout 不破坏主 Loop、外部 Tool 不绕过 Permission、假 Secret 不进入诊断。不得建设 Extension Registry/Marketplace。完成后下一候选是 PR-09。

## 10. PR-09 / R1-I Evidence Closure & Resume Release

不新增能力，只关闭 R1 Claim-to-Evidence Matrix：运行受控端到端任务，汇总至少一个真实 Bad Case→Root Cause→Fix→Regression，更新架构图、限制、演示脚本、README 状态和简历事实素材。无证据声明必须删除或降级；小样本只按 Trial 报告。核心不变量失败时不得关闭 R1。

## 11. R1 后候选

PR-10～PR-14（E4 Context/Memory、E5 Multi-Agent、E8 Diagnostics）只能在 PR-09 后逐项授权。PR-15～PR-17（E7 Extensions、外部 Benchmark、E9 Release）明确延期；启动时必须另写 JIT Plan，不能复用旧自然周窗口。
