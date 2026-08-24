# PR-14 / E8 Developer Diagnostics 设计

## 目标

把 R1 已有的 Trace 与 Evaluation 证据转化为用户可直接阅读的失败解释、阶段定位和恢复建议。用户无需自行解析 JSONL，也不会因为诊断功能改变 Query、Provider、Permission 或 Tool 的运行语义。

## 现状与问题

- `/doctor` 只检查 Node、认证、Endpoint、MCP、Sandbox 和 Settings。
- Trace Inspector 只按 sequence 输出安全字段，没有“为什么失败、是否重试、是否执行 Tool、还能否恢复”的结论。
- Evaluation Artifact 独立存储，用户必须自行寻找并阅读结果文件。
- Context Provenance、Memory 和 Multi-Agent 的结构化证据尚未在 PR-10～PR-13 实现，PR-14 不能伪造这些结论。

## 方案

新增独立 `src/diagnostics/` 领域，保持三个边界：

1. **纯分析层**：只接受已验证的 Trace Event / Evaluation Result，生成固定枚举的 Finding、Summary 和 Recovery Guidance。
2. **安全读取层**：只读取当前项目数据目录中最新的普通 Trace 文件和 Evaluation `result.json`；拒绝 symlink，不输出绝对路径，只保留 basename/runId 等安全引用。
3. **消费层**：`/doctor` 在环境检查后 best-effort 追加项目证据摘要；独立 CLI 输出同一份文本或 JSON 安全报告。

```text
project traces/*.jsonl ──┐
                         ├─ safe artifact discovery
evaluations/*/result.json┘
                                  ↓
                         diagnostic analyzers
                         ├─ query/model/retry
                         ├─ permission/tool
                         ├─ recovery/trace health
                         └─ evaluation summary
                                  ↓
                         DiagnosticReport v1
                         ├─ /doctor summary
                         └─ diagnose CLI text/json
```

## 诊断契约

报告只包含：状态枚举、计数、阶段、稳定错误类别、Tool 名称、Permission 决策来源、sequence/span 引用、Evaluation invariant ID、相对证据引用和固定恢复建议。

报告不得包含 Prompt、模型正文、Tool 输入输出、命令、文件正文、stdout/stderr、原始 Provider Body、环境变量值、API Key、URL credentials/query 或绝对项目路径。

## 失败与降级

- 没有 Artifact：返回 `unavailable`，不视为运行失败。
- Trace 截断或损坏：保留可读事件，报告 ignored line 数和 `incomplete`。
- Evaluation 损坏：报告不可用，不猜测结果。
- `/doctor` 聚合失败：只显示诊断证据不可用，原环境检查仍正常返回。
- 缺少 Context/Memory/Sub-Agent 事件：明确写为“当前证据无法判断”，不声称未发生。

## 验收

- 受控 Trace 可解释 Retry→Success、Permission Deny、Tool Failure、Timeout/Abort 和缺失终止事件。
- Permission Deny 报告能回答 Tool 是否执行。
- 最新 Evaluation 的 outcome、失败 invariant 和 limitations 可安全摘要。
- fake Secret 与绝对测试路径不进入文本/JSON 报告。
- `/doctor` 在 Artifact 缺失、损坏和读取失败时不抛出。
- `verify:core` 增加确定性 Diagnostics 检查，不访问真实模型。

## 非目标

- 不新增 Trace 事件和运行时遥测。
- 不实现 PR-10 Context Provenance、PR-11 Memory Governance 或 PR-12～13 Multi-Agent 生命周期。
- 不自动修复配置、重试任务或修改 Artifact。
- 不创建压缩归档，不上传诊断数据，不建设 Dashboard。
