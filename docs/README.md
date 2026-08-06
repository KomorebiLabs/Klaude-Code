---
title: "Klaude-Code Docs"
date: 2026-08-04
updated: 2026-08-04
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

> [!abstract] 简单规则
> 当前活动文档放在 `docs/` 根目录；学习材料放在 `docs/learning/`；历史资料放在 `docs/archive/`。本文件是唯一文档入口。

## 先读这里

- [项目 README](../README.md)
- [Trace 架构决策](./trace-adr-001.md)
- [Trace 事件契约](./trace-event-contract.md)
- [Trace 存储与隐私](./trace-storage-privacy.md)
- [Trace 验收计划](./trace-acceptance.md)

## Task 1–3 实现记录

- [Task 1：Trace 契约与安全基础](./task-1-trace-contract.md)
- [Task 2：JSONL Trace 存储](./task-2-jsonl-storage.md)
- [Task 3：QueryEngine 生命周期 Trace](./task-3-query-lifecycle.md)

Task 文档记录：做了什么、改了哪些文件、遇到什么问题、如何验证，以及下一步是什么。

## 学习与面试

- [为什么先做 Trace 与 Evaluation](./learning/why-trace-first.md)
- [Trace 架构与实施推演](./learning/trace-architecture.md)

## 历史资料

- [P0–P4 历史路线](./archive/p0-p4-history.md)
- [Trace MVP 实施计划](./archive/trace-mvp-implementation-plan.md)
- [旧工程索引（历史归档）](./archive/engineering-index-history.md)

历史资料保留设计演进，不代表当前唯一有效路线。当前对外长期路线以项目根目录 README 的 E0–E9 Enterprise Harness Track 为准。

## 文档规则

```text
docs/
├── README.md                         # 唯一入口
├── trace-*.md / task-*.md            # 当前活动工程文档
├── learning/                         # 学习与面试材料
└── archive/                          # 历史计划和旧索引
```

新增当前任务文档时，直接放在 `docs/` 根目录；不再创建 `engineering/`、`adr/`、`specs/`、`evaluation/`、`dev-docs/`、`roadmap/` 等多层分类目录。只有当文档明确属于学习材料或历史资料时，才放入 `learning/` 或 `archive/`。

## 当前状态

- Task 1–3：✅ 已完成。
- Task 4：📋 下一入口，等待用户明确启动。
- Trace 模型/工具/权限事件与 F1–F7 Evaluation：后续加固和评估工作。
