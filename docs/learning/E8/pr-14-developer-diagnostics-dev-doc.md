# PR-14：Developer Diagnostics 开发记录

## 1. 问题与真实边界

R1 已产生安全 Trace、Evaluation Artifact 和最小 Inspector，但用户仍需自己寻找 JSONL、按事件推断失败阶段，再手工关联 Evaluation。既有 `/doctor` 只检查 Node、认证、Endpoint、MCP、Sandbox 与 Settings，不能回答任务为何失败、是否重试、Permission 是否拒绝、Tool 是否执行以及下一步如何恢复。

实际读取链路为：

```text
~/.easy-agent/projects/<project>/traces/*.jsonl ──┐
                                                  ├─ safe artifact reader
~/.easy-agent/projects/<project>/evaluations/*/result.json ┘
                                                           ↓
                                                 diagnostic analyzers
                                                           ↓
                                                 DiagnosticReport v1
                                                 ├─ /doctor
                                                 └─ npm run diagnose [-- --json]
```

诊断只消费已经落盘的白名单证据，不向 Query、Provider、Permission 或 Tool 主路径写回状态。

## 2. 核心决策

- **R1 矩阵冻结**：R1 的 25 项发布声明保持不变；PR-14 证据进入独立 Post-R1 Matrix。
- **纯分析与 I/O 分离**：Trace 分析函数不访问文件系统；Artifact Reader 只选择当前项目目录中的最新普通文件，拒绝 symlink。
- **读取预算**：诊断最多读取 5 MiB Trace 和 1 MiB Evaluation；超限标记 incomplete，避免 `/doctor` 被异常 Artifact 拖垮。
- **固定解释模型**：Finding 使用稳定 code、stage、severity、summary、recovery 和 sequence/span/invariant 引用，不复制原始 payload。
- **诚实缺口**：Context Provenance、Memory Lifecycle 和 Sub-Agent Lifecycle 在 PR-10～PR-13 前标记为 evidence gap，不用“没有事件”推断“没有发生”。
- **Doctor 非干扰**：`/doctor` 仅 best-effort 追加项目摘要；聚合失败被折叠为 unavailable，既有环境检查仍然有效。
- **安全分享而非压缩包**：第一版提供 stdout 文本/JSON，可由用户显式重定向；不默认写文件、不上传、不创建含未知文件的归档。

## 3. 实际修改

- `src/diagnostics/types.ts`：版本化报告、Finding、Trace/Evaluation Summary 契约。
- `src/diagnostics/traceAnalysis.ts`：Retry/Restart、Permission、Tool、Query、Abort、Trace 完整性与恢复建议。
- `src/diagnostics/artifactReader.ts`：最新普通 Trace/Evaluation 的窄读取和损坏降级。
- `src/diagnostics/projectDiagnostics.ts`：项目级状态聚合与 Evaluation 失败解释。
- `src/diagnostics/render.ts`：安全文本和 JSON 报告。
- `src/core/queryEngine/commands/diagnostics.ts`：在 `/doctor` 末尾 best-effort 追加报告。
- `src/scripts/diagnose-project.ts`、`test-diagnostics.ts`：显式 CLI 与确定性证据。
- `package.json`：`diagnose`、`test:diagnostics`，并将后者接入 `verify:core`。

## 4. 必要证据

- Retry→Success 能显示次数、错误类别并说明已经恢复。
- Permission Deny 显示安全决策来源和 Tool 未启动；若同一 `tool_use_id` 同时出现 `tool.started`，报告升级为错误。
- Tool Failure、Stream Restart、Query auth failure 和 Abort 均产生对应解释。
- Trace 截断保留可读事件并标记 incomplete；缺少终止事件不伪装成功。
- Evaluation 只输出 outcome、断言数量、失败 invariant 与 limitation code。
- Artifact 缺失、损坏、symlink 或读取异常不会使 `/doctor` 失败。
- 文本/JSON 报告不包含 fake Secret、原始 payload、绝对测试路径，文件名/span/Tool/invariant 引用也经过安全标识符收窄。

## 5. 限制

- 第一版只分析当前项目最新一份 Trace 和最新一份 Evaluation，不提供历史查询 UI。
- 报告基于已有事件，不能解释尚未结构化的 Context 来源、Memory 冲突或父子 Agent 生命周期。
- `/doctor` 仍保留原有 Endpoint reachability 网络探测；独立 `npm run diagnose` 完全离线。
- 本 PR 不自动修复、重试任务、修改配置或上传诊断材料。

## 6. 验证与下一步

聚焦 `build`、`test:diagnostics` 与文本/JSON CLI 已通过。最终 `npm run verify:core` 全部通过，包括 Trace、Evaluation、Diagnostics、Resilience、Recovery Lifecycle、Permission、External Safety、Provider Stream、MCP，以及含 29 项断言的 R1 Release Evaluation。`git diff --check` 通过。

单独运行 `test:queryengine` 仍在 Windows 第 1 行因仓库既有 CRLF/LF golden 差异失败；Doctor 新增段已经写入 golden，本 PR 不通过全量改写平台 golden 掩盖该问题。GitNexus 索引落后于当前代码，因此变更检测结果只作为辅助证据，最终范围以 Git diff、构建与聚焦测试为准。

PR-14 合并后，下一候选是 PR-10 / Context Provenance & Budget，让 Diagnostics 能进一步解释上下文来源、预算与裁剪决策。
