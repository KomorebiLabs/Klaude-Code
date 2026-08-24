# PR-09 / R1-I Evidence Closure 设计

## 目标

PR-09 不新增 Agent 运行时能力，而是把 PR-01～PR-08 已形成的 Trace、可靠性、权限与外部执行安全证据收敛为可重复执行、可审阅、可用于简历答辩的 R1 发布证据。

## 设计边界

- 保留 Runtime Trace 的最小化白名单，不为 Evaluation 采集 prompt、模型正文、Tool 输入输出或 Secret。
- 使用 Fake Provider 与内存 Probe Tool 运行真实 `query()`/Permission/Tool 调用链；它是单次确定性 Trial，不是外部 Benchmark，也不代表真实模型成功率。
- `verify:core` 是 R1 唯一门禁：构建、各领域确定性契约、MCP 检查、基础 Evaluation 和受控端到端 Trial 必须全部通过。
- Claim-to-Evidence Matrix 的每条声明必须给出确定性命令与仓库内证据文件；Windows 上已知不成立的 `test:sandbox` 跨平台暗示从 R1 门禁声明中移除，Sandbox 只承诺“不升级 Permission”和不支持平台显式降级。
- Bad Case 复用 PR-08 已真实发生的 symlink/junction 词法路径逃逸：保留 RED、根因、修复和回归证据，不制造新案例。

## 受控端到端任务

```text
用户消息
  → query() 第一次 Fake Provider 响应
  → tool_use
  → Permission 解析（只读 allow）
  → Probe Tool 实际执行一次
  → tool_result 回送 Fake Provider
  → 第二次响应完成
  → Evaluation JSON / Markdown Artifact
```

验收同时检查最终完成、Tool 最多执行一次、关键 Trace 顺序、span 配对、敏感 marker 不进入 Trace，以及矩阵条目/证据文件闭合。

## 诚实限制

R1 只说明这些确定性不变量在当前提交和受控 Trial 中通过。它不声明真实模型质量、跨仓库成功率、跨平台 Sandbox 等价性、TOCTOU 完全消除、正式发布就绪或 Claude Code/Codex 的完整替代。
