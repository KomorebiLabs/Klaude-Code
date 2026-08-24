# R1 演示脚本（约 8 分钟）

## 1. 定位项目（1 分钟）

说明 Klaude-Code 是基于 Easy Agent 功能基础持续维护的项目；本人的核心贡献是 Enterprise Harness 加固，不把 inherited Agent 功能包装成从零开发。

## 2. 展示架构与声明（2 分钟）

打开 [`r1-resume-release-report.md`](./r1-resume-release-report.md) 的架构图，再打开 [`r1-invariant-to-evidence-matrix.md`](./r1-invariant-to-evidence-matrix.md)。任选 Permission、Retry、External Safety 三行，解释“声明→命令→证据文件”的映射。

## 3. 运行统一门禁（2～3 分钟）

```powershell
npm run verify:core
```

重点观察最后两份 Artifact：基础 Core Evaluation 和 R1 Release Evaluation。后者应报告 `passed` 与 29 条断言。

## 4. 展示真实 Bad Case（1 分钟）

打开 PR-08 Dev Doc 与 `src/scripts/test-external-safety-contract.ts` 的 symlink/junction 场景，按“词法路径可逃逸→canonical ancestor 修复→正常路径兼容回归”说明。

## 5. 主动说明限制（1 分钟）

明确本演示使用 Fake Provider、单 Trial、无网络；不宣称真实模型成功率或跨平台 Sandbox 等价。随后说明 R2 候选是 Context/Memory、Multi-Agent Recovery、Developer Diagnostics，由 Bad Case 和求职价值决定优先级。
