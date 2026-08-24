# PR-09：R1 Evidence Closure & Resume Release 开发记录

## 1. 问题

PR-04 只建立了 4 项 Evaluation 骨架，后续 PR 已增加大量可靠性与安全证据，但代码矩阵、统一门禁和 README 仍停留在旧状态；文档还把 Windows 当前不能兑现的 `test:sandbox` 放入统一证据口径。R1 因此“能力已实现，但声明没有完全闭环”。

## 2. 决策与修改

- 将机器可读矩阵扩展到 25 项 R1 不变量，并与最终 Markdown 矩阵对齐。
- `verify:core` 增加已通过的 MCP 验证和 R1 Release Trial；Sandbox 声明缩窄为可跨平台证明的 Permission no-upgrade，不宣称后端等价。
- 新增 Fake Provider + Probe Tool 受控任务，走真实 `query → permission → tool → provider completion` 路径并输出独立 Artifact。
- 复用 PR-08 symlink/junction 逃逸作为真实 Bad Case 闭环。
- 增加 R1 架构、限制、演示脚本和简历事实素材，明确 Original Foundation 与 Enterprise Harness 归属。

## 3. 证据

- 基线 `npm run verify:core` 在修改前通过。
- 新增脚本独立执行通过，生成 29 条断言：25 条矩阵映射与 4 条端到端断言。
- Probe Tool 执行 1 次；Provider 调用 2 次并收到配对结果；Trace 顺序为 Model→Permission→Tool→Model，输入/结果 marker 不进入 Trace。
- 最终 `npm run verify:core` 通过：Build、Trace、Evaluation、Resilience、Recovery Lifecycle、Tool/Permission、External Safety、Provider Stream、MCP、基础 Evaluation Artifact 与 R1 Release Artifact 全部成功；R1 报告为 `passed`、29 条断言。

## 4. 限制与交接

本 PR 不增加运行时能力，不运行真实模型，不产生成功率推断，也不处理 package/CLI 迁移。PR-09 合并后 R1 才正式标记为 evidenced；下一阶段不是自动启动，而是由维护者在 PR-10 Context Provenance、PR-12 Multi-Agent Contract、PR-14 Developer Diagnostics 中选择。
