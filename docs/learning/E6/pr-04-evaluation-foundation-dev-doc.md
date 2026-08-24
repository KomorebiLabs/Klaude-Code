# PR-04：E6-A Evaluation Foundation 开发记录

## 问题

R1 已有 Runtime Trace 和聚焦脚本，但缺少统一 Evaluation 证据模型、独立产物所有权和本地/CI 共用门禁。Runtime Trace 不能被扩张成完整会话采集，也不能被误称为生产行为重放。

## 架构决策

- Evaluation 与 Runtime Trace 分域：`src/evaluation/` 独立拥有 Task/Trial/Grader/Result、报告和 Store。
- Core 只接受 `synthetic: true` 的任务定义，使用 Fake Stream/Fake Tool 与合成 fixture，不访问真实网络。
- Result 构造器逐字段 allowlist，不使用任意对象透传；JSON 与 Markdown 对可变字符串二次脱敏。
- Store 只写 `evaluations/<run-id>/result.json|report.md`，使用 ownership marker、ID/path 校验、symlink 拒绝、age/quota Retention 和单 run 删除。
- `verify:core` 顺序执行 Build、真实 runtime 聚焦证据、Evaluation Store 检查和 deterministic grader；任一步失败即停止。
- CI 调用同一命令，并上传独立 Evaluation Artifact。

## 首批证据

Invariant-to-Evidence Matrix 覆盖：Trace schema/sequence/lifecycle、假 Secret 隐私、Permission Deny 零执行、Writer degraded/timeout 主路径隔离。

本地 `npm run verify:core` 已生成一条逐 Trial 报告，Outcome 为 passed；报告明确标注 synthetic fixture、无真实网络、不支持生产 Trace 行为重放。

## 安全验证

- 运行时额外字段不能绕过 Result allowlist。
- 假 Secret 不进入 JSON/Markdown。
- traversal run ID 被拒绝。
- 无 ownership marker 的同名目录不清理。
- symlink root 被拒绝且外部文件保留。
- age cleanup 先于 quota，手动删除只作用于直接 run 目录。

## 限制

- PR-04 只建立 Evaluation Foundation，不运行真实模型、不统计成功率、不做多仓库 Benchmark 或 LLM-as-a-Judge。
- 当前报告证明 Core Gate 的确定性基础，不代表 E2/E3 后续可靠性与安全承诺已完成；PR-05～PR-08 必须增量扩充 Matrix。
