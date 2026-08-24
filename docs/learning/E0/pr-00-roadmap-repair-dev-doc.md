---
title: "PR-00 Roadmap Repair Dev Doc"
date: 2026-08-24
status: implemented-in-worktree
stage: R0
---

# PR-00 Roadmap Repair Dev Doc

## 问题

原路线存在四类冲突：根 README 将 E5/E6 反置；MainTask 把 E4/E5 设为 Evaluation 前置；已经失效的自然周排期仍被描述为当前承诺；Prompt 允许一个窗口处理多个 Slice，且 docs 入口与当前 worktree 实际目录不一致。

## 决策

- E0–E9 只表示能力域，执行使用 PR-00～PR-09 证据门；
- E5 固定为 Multi-Agent / Worktree，E6 固定为 Evaluation；
- E6-A 在 E1 核心 Trace 后建立，E6-B 在 E2/E3 后关闭 R1，E6-C 外部 Benchmark 延期到 R1 后；
- Runtime Diagnostic Trace 与 Evaluation Run Record/Artifact Store 分离；
- 状态使用 Foundation 与 Klaude hardening 两个维度；
- 一个开发窗口只执行一个已授权 PR Stage；
- 当前文档入口以实际存在的 learning、superpowers 和 archive 为准，不虚构缺失的 engineering/other 目录。

## 修改

- README.zh-CN.md：统一领域编号、双维状态、文档入口和近期证据门；
- docs/README.md：保留用户“按读者和生命周期组织”的改动，并按实际文件系统校正目录；
- MainTask.md：替换严格串行图、旧周计划、E6 大范围承诺和单维状态；
- Prompt.md：重写为 PR-00～PR-09 单 Stage 启动入口；
- 增加 R0 JIT Implementation Plan。

## 验证

- 搜索旧 E5 Evaluation / E6 Multi-Agent 映射；
- 搜索旧周标题、Task 4 下一入口和“一个窗口多个 Slice”；
- 检查 Markdown fence、相对链接和空白错误；
- 审阅 task-scoped diff，并确认未修改运行时代码。

## 限制

- 本阶段不补齐 E0 的完整能力地图、Failure Propagation Map 或 Enterprise Gap Matrix，因此 E0 整体仍为 Klaude hardening: in-progress；
- 当前 worktree 原有文档移动/删除和 untracked 目录不属于本 Stage，本次未清理或重新归属；
- 当前分支相对 github/main 存在 divergence，未自动同步；
- 尚未 commit、push 或创建 PR。

## 下一候选

PR-01 / R1-A Trace Storage & Availability Contract。必须由用户单独授权后启动。
