# PR-07：Tool / Permission Safety Contract 开发记录

## 1. 问题与真实调用链

PR-07 加固的实际主链为：

```text
QueryEngine / Headless / Sub-Agent
  → query
  → runTools
  → runOneToolBlock
  → 输入校验
  → PreToolUse Hook
  → checkPermission
  → ask 消解
  → tool_use_id 执行账本
  → 文件历史备份
  → tool.call
  → PostToolUse Hook
```

改造前存在四个可复现缺口：显式 deny 可能被只读、协调工具或预批准域名快速路径跳过；Hook allow 可把 deny 升级为 allow；Tool 输入通常到 `tool.call()` 内部才校验；恢复或并发重放相同 `tool_use_id` 会重复执行。

## 2. 核心决策

- **deny 不可升级**：显式 deny 在 mode、read-only、coordination、domain、allow、Hook 与 bypass 之前决策。
- **ask 可被可信机制消解**：PreToolUse Hook allow 或显式无头 bypass 可把普通 ask 消解为单次允许；background ask 默认拒绝。
- **输入先于副作用**：轻量 JSON Schema 门禁位于 Hook、Prompt、备份和 Tool 之前，只报告字段名与错误码，不回显字段值。
- **Query 内至多执行一次**：在授权和取消检查之后、首个执行相关 await 之前同步占用 `tool_use_id`；Tool 抛错后不释放。
- **Trace 只记录白名单结构**：记录入口、策略决策、来源码、最终 outcome、是否提示和是否授权，不记录命令、路径、URL、Hook 原因或 Tool 正文。

## 3. 实际修改

- `src/permissions/permissionContract.ts`：统一入口、策略来源、原因码、结果和消解来源类型。
- `src/permissions/permissions.ts`：显式 deny 前置，并为每条策略返回稳定 provenance。
- `src/tools/inputValidation.ts`：支持 object、required、基础类型、enum 与简单 array items 的窄校验器。
- `src/core/agenticLoop.ts`：接入输入门禁、Hook/deny 合并规则、ask/bypass 消解、Query 账本与安全 Trace。
- `src/core/queryEngine*`、`src/entrypoint/headless.ts`、`src/agents/*`、`src/tools/agentTool.ts`：透传四类生产入口及父级审批来源。
- `src/scripts/test-tool-permission-contract.ts`：建立 PR-07 离线确定性矩阵并纳入 Core Gate。

## 4. 确定性证据

- deny 优先级覆盖 default/plan/auto、read-only、coordination 与预批准 WebFetch 域名。
- 非法输入的 Permission Prompt 与 Tool 调用计数均为 0。
- Hook allow 无法升级 deny，但可以消解 ask；显式 bypass 只消解 ask。
- 相同 ID 在串行、并发、Tool throw 下最多调用一次；deny/invalid 不占用账本。
- Trace 精确记录 `entryPoint/policyDecision/decisionSource/reasonCode/outcome/resolutionSource`，隐私断言确认不含动态输入值与 Hook 原因。
- `test:recovery-lifecycle`、`test:trace`、权限历史回归和 TypeScript build 已通过。

## 5. 困难与处理

GitNexus 索引落后于当前源码，部分 QueryEngine/Trace 符号无法解析；按仓库规则停止重复查询，改用当前源码、调用点搜索和聚焦回归作为事实依据。Windows 上 `test:agents` 两次都在临时目录最终清理阶段出现 `EBUSY`，此前断言均通过，属于可重复的文件锁环境限制，不作为功能回归隐瞒。

## 6. 当前限制与下一步

本 PR 不实现完整 JSON Schema，不做跨进程幂等或语义相同调用去重，也不改 Sandbox/MCP/Secret Scanner。账本只保证单次 `query()` 内相同模型 `tool_use_id` 至多执行一次；进程崩溃后的外部副作用恢复仍不在 R1-G 范围。

下一候选是 PR-08 / R1-H Sandbox / MCP / Secret Safety，需单独授权后启动。
