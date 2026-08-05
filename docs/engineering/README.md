---
title: "Klaude-Code 工程文档索引"
date: 2026-08-04
updated: 2026-08-04
tags:
  - klaude-code
  - engineering
  - trace
  - index
aliases:
  - 工程文档索引
  - Engineering Docs
status: active
---

# Klaude-Code 工程文档索引

> [!abstract] 工程文档的职责
> 本目录只放能够指导实现、约束设计或验收结果的工程材料：**路线 → ADR → Specs → Evaluation → Task 开发报告**。学习笔记请进入 `docs/learning/`，全局导航请从 `docs/README.md` 开始。

## P0 Trace 当前进度

| Slice | 结果 | 文档 |
|---|---|---|
| Task 1 | ✅ Trace 契约、脱敏、安全摘要 | [Task 1](./dev-docs/task-1-trace-contract-foundation.md) |
| Task 2 | ✅ JSONL Writer/Reader、受控路径、失败隔离 | [Task 2](./dev-docs/task-2-jsonl-trace-storage.md) |
| Task 3 | ✅ QueryEngine started/finished/failed/aborted | [Task 3](./dev-docs/task-3-query-lifecycle-trace.md) |
| Task 4 | 📋 模型请求、重试、流重启 Trace | 后续 E1/E2 Hardening |
| Task 5 | 📋 工具与权限事件 | 后续 E1/E3 Hardening |
| Task 6 | 📋 F1–F7 Evaluation / Regression | 后续 E5 |

## 文档导航

### 1. 路线与历史设计

- [P0–P4 企业级 Harness 升级历史总控](./roadmap/p0-p4-upgrade-master-plan.md)
  - 记录早期优先级设计、JD 能力矩阵和 P0 验收目标。
  - 当前公开长期路线以根目录 README 的 E0–E9 为准。

### 2. 架构决策记录（ADR）

- [ADR-001：本地结构化 Harness Trace](./adr/ADR-001-local-structured-harness-trace.md)
  - 记录为什么选择本地 JSONL Trace、为什么不先上云端 Observability/数据库，以及职责边界和失败隔离原则。

### 3. 技术规范（Specs）

- [Harness Trace 事件契约](./specs/harness-trace-event-contract.md)
  - 事件 envelope、标识符、eventType、字段不变量和 schema 演进。
- [Harness Trace 存储与隐私规范](./specs/harness-trace-storage-and-privacy.md)
  - 存储位置、内容分级、脱敏、大小限制、retention 和威胁模型。

### 4. 验收与评估（Evaluation）

- [Trace MVP 验收与评测计划](./evaluation/trace-mvp-acceptance-plan.md)
  - P0 范围、F1–F7 deterministic fixtures、成功标准、指标和人工验收清单。

### 5. Task 开发报告（Dev Docs）

- [Task 1：Trace 事件契约与安全基础](./dev-docs/task-1-trace-contract-foundation.md)
- [Task 2：本地 JSONL Trace 存储](./dev-docs/task-2-jsonl-trace-storage.md)
- [Task 3：QueryEngine 顶层生命周期 Trace](./dev-docs/task-3-query-lifecycle-trace.md)

每份 Task 文档记录：

```text
迭代内容 → 实现效果 → 涉及文件 → 真实困难与解决 → 验证 → 面试设计决策
```

## 三个高频面试问题

> [!faq]- 为什么选 JSONL 而不是 SQLite / 大 JSON？
> 天然追加、部分可读、零依赖、可 grep/jq 分析，适合本地 CLI 的单任务诊断和 Fixture 解析。

> [!faq]- 如何保证 Trace 不泄漏敏感信息？
> 两层防御：payload 字段级白名单/内容最小化 + writer 层递归脱敏；不依赖单一正则，也不默认采集高风险正文。

> [!faq]- Trace 写入失败会影响 Agent 吗？
> 不会。Writer 是 best-effort，初始化、序列化、目录和 I/O 失败都必须降级，不能反向破坏 Agent 主路径。

## 设计与实现关系

```mermaid
flowchart LR
    R[roadmap<br/>为什么做] --> A[adr<br/>选择什么方案]
    A --> S[specs<br/>遵守什么契约]
    S --> E[evaluation<br/>如何验收]
    E --> D[dev-docs<br/>实际怎么实现]
```

## 状态说明

- ✅ **Implemented**：已由代码、文档和聚焦验证支持。
- 🔧 **Hardening**：已有功能基础，正在补生产级边界。
- 🚧 **In Progress**：当前已进入明确实现 Slice。
- 📋 **Planned**：已规划但尚未进入当前周期。
- 🔬 **Research Direction**：需要进一步实验和证据。

## 相关入口

- 全部文档入口：[`../README.md`](../README.md)
- 对外项目路线：仓库根目录 [`README.md`](../../README.md) 的 Enterprise Harness Track E0–E9
- 学习与面试笔记：[`../learning/enterprise-upgrade/`](../learning/enterprise-upgrade/)
