# PR-08：Sandbox / MCP / Secret Safety 开发记录

## 1. 问题与真实边界

PR-08 沿 PR-07 的唯一 Permission 入口纵向收口四类外部执行风险：文件 Tool 原先只做词法路径比较，工作区内 junction/symlink 可指向允许根外；Bash/PowerShell 在内存中无界累积输出，timeout 只发送一次 kill 就提前结算；MCP 请求依赖 SDK 默认超时且没有绑定调用取消信号，响应先完整聚合；MCP stderr、远端错误、Endpoint URL 和通用日志可能泄漏凭据。

实际调用链为：

```text
runTools / PR-07 Permission
  ├─ File Tool → resolveWorkspacePath → canonical containment → filesystem
  ├─ Bash/PowerShell → runManagedProcess → bounded output / tree termination
  └─ MCP adapter/resource → SDK request options → bounded content
                                  ↓
                         allowlisted external Trace

MCP client / logWarn / debugLog / doctor
  → observability redaction
  → secret-free diagnostics
```

## 2. 核心决策

- **授权不分叉**：MCP adapter 仍是普通 `Tool`，继续由 PR-07 的输入校验、deny/ask 消解和执行账本授权；显式 deny 的 transport request 计数为 0。
- **真实路径校验**：存在目标使用 `realpathSync.native`；新文件逐级寻找最近存在祖先，解析链接后拼回缺失段。校验使用 canonical path，正常调用仍返回原绝对路径。
- **进程有界结算**：timeout 夹在 100ms～10min，stdout/stderr 采集时即截断；POSIX 终止 detached process group，Windows 使用 `taskkill /T /F`，最终状态为 confirmed 或固定 deadline 后 degraded。
- **MCP 显式预算**：每次 tools/resources request 使用 30 秒 timeout 与 maxTotalTimeout，并透传当前 AbortSignal；聚合正文最多保留 100K 字符。
- **诊断统一清洗**：Log、MCP 连接错误和 Doctor 复用 observability redaction；Endpoint 只显示 origin，stdio stderr 只排空、不缓存、不写入 connection.error。
- **Trace 白名单**：外部执行只记录规范化 kind/sourceName/operationName、termination 与 sandboxState；Tool 输入、command、arguments、stdout、stderr、URL 和 headers 均不进入 Trace。

## 3. 实际修改

- `src/tools/pathUtils.ts`：canonical containment 与严格 home expansion。
- `src/tools/processLifecycle.ts`、`bashTool.ts`、`powerShellTool.ts`：统一进程生命周期、输出预算和进程树回收。
- `src/services/mcp/safety.ts`、`fetchTools.ts`、两个 MCP Resource Tool：请求 timeout/abort、失败分类、内容预算和来源元数据。
- `src/observability/redaction.ts`、`src/utils/log.ts`、`src/services/mcp/client.ts`、`diagnostics.ts`：诊断 Secret Safety。
- `src/tools/Tool.ts`、`src/core/agenticLoop.ts`、`src/observability/toolLifecycle.ts`：内部 diagnostics 与外部执行 Trace 摘要。
- `src/scripts/test-external-safety-contract.ts`：路径、进程、MCP deny-no-request、请求预算、fake Secret 和 Trace allowlist 的确定性证据。

## 4. 必要证据

- symlink/junction 逃逸测试先 RED，canonical containment 后 GREEN；普通 cwd、新文件、Easy Agent Home 和 additional roots 保持可用。
- 本地进程输出在采集阶段受限，timeout 在固定时间内返回 confirmed/degraded；真实 PowerShell/Bash Trace 不含命令 marker。
- 真实 MCP adapter 经 `runTools` 显式 deny 后 request 调用计数为 0；授权调用观察到 signal、30 秒 timeout/maxTotalTimeout，100K 超量正文带 omitted marker。
- stdio 与 HTTP MCP 历史冒烟通过；一个失败连接不会阻断其他连接，日志不再包含 raw stderr/HTTP body。
- fake Secret、Bearer、URL credentials/query 与 private-key body 不出现在捕获日志及外部 Trace；Trace/Evaluation 历史隐私测试继续通过。

## 5. 平台与限制

本 PR 不新增 Linux/Windows Sandbox 后端。现有 Sandbox 仍是 macOS `sandbox-exec`，其他平台显式报告 unsupported；Permission 不因 Sandbox 不可用而自动升级。canonicalization 缩小链接逃逸面，但无法从根本上消除“校验后、打开前”被并发替换的 TOCTOU；彻底解决需要 descriptor-relative I/O 或平台专用 API。

进程回收在权限/平台阻止进程树确认时返回 degraded，不伪装成 confirmed。MCP 成功正文是业务结果，按大小预算返回模型，不执行通用 Secret Scanner；安全承诺针对 Trace、日志、错误和诊断摘要。连接 cache 仍含运行所需原始配置，仅驻留内存，不进入诊断输出。

## 6. 验证与下一步

`verify:core`、`test:mcp` 与 `git diff --check` 已通过。`test:queryengine` 在 Windows 上从首行开始出现仓库既有 CRLF/LF 与平台 golden 差异；`test:sandbox` 的非 macOS 决策测试按设计 skip，profile 纯函数段有 3 个硬编码 POSIX 路径断言失败。两者均未通过改 golden 或放宽断言掩盖。

PR-08 合并后，下一候选是 PR-09 / R1-I Evidence Closure & Resume Release。PR-09 应消费现有矩阵完成 R1 证据闭环，不在本 PR 顺带启动 Extension Registry、跨平台 Sandbox、通用 Secret Scanner 或 Crash Recovery。
