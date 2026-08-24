# PR-08 / R1-H Sandbox / MCP / Secret Safety 设计

## 1. 目标与范围

PR-08 采用“纵向安全收口”：不重写整个外部执行系统，而是在文件路径、子进程、Sandbox、MCP 和诊断出口五个真实边界分别建立可验证的安全契约，并复用 PR-07 已完成的 Permission 与 Query 执行账本。

本阶段必须证明：

1. 文件工具不能通过 `..` 或符号链接逃出允许根；
2. Sandbox 不得扩大显式 Permission，运行时不可用时必须报告 unsupported/degraded；
3. Bash、PowerShell 和 MCP 请求具有有界 timeout/abort 行为；
4. MCP Tool 必须经过统一 Permission 链，deny 后不发送远端调用；
5. 假 Secret 不进入 Trace、Evaluation、MCP 错误、Debug/Warning 或 `/doctor`；
6. 正常文件、进程和 MCP 路径保持兼容。

## 2. 当前真实边界与缺口

### 2.1 文件路径

文件 Tool 统一调用 `src/tools/pathUtils.ts:resolveWorkspacePath`。当前实现使用 `path.resolve + path.relative` 做词法包含检查，能阻止普通 `../`，但不能阻止允许根内部已有符号链接指向根外路径。`~` 展开还依赖 `process.env.HOME`，与项目统一使用 `os.homedir()` 的路径策略不一致。

### 2.2 Bash / PowerShell

两类 Tool 都有 timeout 和结果截断，但当前行为是：

- stdout/stderr 先无限累积，结束后才截断；
- timeout 只发送一次终止信号并立即返回；
- Shell 派生的子进程可能在父 Shell 返回后继续存活；
- timeout 没有合理上下限；
- 无法确认终止时没有 degraded 状态。

### 2.3 Sandbox

Sandbox 只有 macOS `sandbox-exec` 后端。`shouldUseSandbox` 在平台不支持或 binary 不可用时返回 false，`/doctor` 会报告状态。Permission 的 sandbox auto-allow 已要求 `shouldUseSandbox === true`，因此运行时不可用不会直接触发自动允许；PR-08 需要保留并证明这一不升级性质。

### 2.4 MCP

MCP Tool 经 `fetchToolsForConnection → registerMcpTools` 进入统一 Tool Registry，再经过 `runTools → checkPermission → tool.call`，不存在独立执行旁路。但调用层仍有缺口：

- `tools/call`、`resources/list`、`resources/read` 没有显式传入 Query AbortSignal；
- SDK 虽有默认 timeout，但当前没有稳定的项目级总上限合同；
- MCP 内容在转换为字符串时没有增量大小预算；
- Tool 错误、stdio stderr、连接 URL 和 Server Error 可能原样进入 ToolResult、warning、debug 或 `/doctor`。

### 2.5 Trace / Evaluation / Diagnostics

Trace 与 Evaluation 已使用 allowlisted summary 和 `createSafeMessage`，基础边界成立。风险集中在 Trace 之外的诊断出口：`debugLog`、`logWarn`、MCP connection error 和 `/doctor`。本阶段应复用同一清洗器，而不是建设通用 Secret Scanner。

## 3. 方案选择

### 方案 A：纵向安全收口（采用）

在五个现有边界增加窄接口和确定性证据。优点是每项承诺都能映射到真实调用链，兼容 PR-07，单 PR 可审查。代价是不会获得跨平台统一 Sandbox，也不解决进程崩溃后的外部幂等。

### 方案 B：统一 Sandbox Runtime 重构（不采用）

抽象 macOS/Linux/Windows 后端并统一所有进程。长期架构更完整，但需要引入平台实现、能力探测和大量集成测试，明显超过 R1-H。

### 方案 C：只在 Agent Loop 外围包装 timeout/redaction（不采用）

改动最少，但外围 Promise timeout 无法确保子进程或 MCP 请求停止，可能在主 Loop 返回后继续产生副作用，形成虚假安全。

## 4. 路径安全契约

### 4.1 允许根保持兼容

允许根仍为：

- 当前 `cwd`；
- `~/.easy-agent`；
- 受信任配置加载出的 `additionalDirectories`。

PR-08 不把文件 Tool 突然收紧为只能访问 cwd。

### 4.2 真实路径包含检查

新增统一 canonical path 逻辑：

1. 先将输入展开为绝对路径；
2. 对已存在目标使用 `realpath`；
3. 对尚不存在目标向上寻找最近存在祖先，对祖先执行 `realpath` 后再拼回剩余片段；
4. 对允许根执行同样 canonicalization；
5. 使用 `path.relative` 判断 canonical target 是否位于任一 canonical root 内。

这会阻止 `cwd/link-to-outside/secret.txt` 一类已有 symlink traversal，同时允许在正常目录中创建新文件。

### 4.3 明确限制

Node 路径检查与后续文件系统调用之间仍存在 TOCTOU 窗口。R1-H 只承诺阻止检查时已经存在的 traversal，不宣称提供基于目录句柄的内核级原子 confinement。

## 5. 外部进程生命周期契约

### 5.1 Timeout 与输出预算

- 默认 timeout 保持 120 秒；
- 调用值规范化到明确的最小值和最大值，拒绝非有限值；
- stdout/stderr 使用有界缓冲器，超过预算后只累计 omitted count，不继续增长内存；
- ToolResult 保持现有可读结构并标记截断。

### 5.2 终止与回收

抽取共享的进程终止 helper：

- POSIX Shell 以独立 process group 启动，先终止 group，再在短 grace period 后强制终止；
- Windows 使用进程树终止能力，覆盖 PowerShell 派生进程；
- timeout/abort 只结算一次，并释放 timer/listener；
- 在有界回收窗口内无法确认退出时，ToolResult 返回 degraded termination，而不是无限等待或伪装已终止。

正常退出、spawn error、timeout、abort 和 close 竞态必须保持单一结算。

### 5.3 Sandbox 状态

ToolResult/Trace 只记录 `enabled/disabled/unsupported/degraded` 枚举，不记录编译后的 profile 或原始命令。非 macOS 平台不会被描述成“Sandbox 通过”。

## 6. MCP 安全契约

### 6.1 Permission 不旁路

MCP adapter 继续作为标准 `Tool` 注册。任何 `mcp__server__tool` 调用必须先经过 PR-07 的：

```text
input validation → PreToolUse Hook → checkPermission → ask resolution → execution ledger → tool.call
```

测试以远端调用计数器证明显式 deny 时 `client.request` 为 0。不会在 MCP 层复制第二套 Permission 引擎。

### 6.2 请求生命周期

所有 MCP Tool/Resource request 显式传入：

- 当前 `ToolContext.abortSignal`；
- 固定默认 request timeout；
- 相同的 maximum total timeout。

Timeout/Abort 被归一为稳定错误分类，不回显远端原始正文。单个 Server 失败不能破坏 Query 主循环或其他 MCP Server 的结果。

### 6.3 输入输出上限

- MCP description 保持 2048 字符上限；
- `stringifyMcpContent` 改为增量预算，达到上限后停止聚合；
- Resource list/read 在序列化前限制条目数、文本和 blob 摘要；
- 最终仍经过 Tool 层统一结果截断，形成双层防护。

### 6.4 来源摘要

MCP Tool adapter 提供稳定的外部来源元数据：server、远端 tool 名和 transport kind 的安全枚举/规范化名称。Tool Trace 可记录该摘要与 timeout/failure outcome，但不记录 URL、headers、arguments 或响应正文。

## 7. Secret Safety 契约

### 7.1 统一诊断清洗

复用并扩展 observability redaction：

- `debugLog` 的 message/details 在输出前清洗；
- `logWarn` 在 UI Notice 或 stderr 前清洗；
- MCP connection/tool/resource errors 仅保留安全分类和清洗后的短摘要；
- `/doctor` 的 endpoint 仅展示 origin/安全 URL 摘要，connection error 经过清洗；
- Evaluation 继续使用 `createSafeMessage`；Trace 继续使用 allowlisted DTO。

### 7.2 识别范围

第一版覆盖结构化敏感键、Bearer、Authorization、常见 token/query secret、`sk-*` 和 private key。它是诊断出口的纵深防御，不承诺发现任意高熵秘密，也不修改模型正常可见的成功 ToolResult 正文。

### 7.3 错误与正文边界

远端成功 Tool/MCP 内容仍需返回模型完成任务；它不会进入 Trace/Evaluation/diagnostic summary。远端失败正文视为不可信诊断数据，必须清洗并限长后再展示。

## 8. Trace 与状态模型

沿用现有 `tool.started/tool.completed/tool.failed`，补充可选、安全的 external execution summary：

- `kind: local_process | mcp`；
- `sourceName`：规范化 Server 名或本地 shell 类型；
- `sandboxState`；
- `termination: completed | timeout | aborted | degraded`。

不新增包含原始输入/输出的事件。MCP 连接阶段若当前没有 Query TraceSink，只进入清洗后的运行时诊断，不为了事件完整性建立全局 Trace 单例。

## 9. 错误处理

- Path violation：在文件 I/O 前返回稳定 `path_outside_allowed_roots`/`path_symlink_escape` 分类；
- Process timeout/abort：有界终止并返回稳定结果；回收失败标记 degraded；
- MCP timeout/abort：返回 `mcp_timeout`/`mcp_aborted`；
- MCP protocol/server failure：返回 `mcp_failure` 安全摘要；
- Redaction 自身失败：退化为固定通用消息，不抛入 Agent 主路径；
- Trace/diagnostic 写入失败仍不得改变 Tool 或 Query 主结果。

## 10. 确定性证据

新增一个 PR-08 聚焦脚本并复用现有 sandbox/MCP/Trace/Evaluation 检查，至少覆盖：

1. 普通 `../` 和 symlink traversal 在 read/write 前被阻止；
2. 正常 cwd、Easy Agent Home 和 additional root 路径仍可解析；
3. Sandbox unavailable 时不触发 sandbox auto-allow；
4. Bash/PowerShell 有界输出、timeout 与 abort 单次结算；
5. MCP deny 时远端调用计数为 0；
6. MCP timeout/abort 不挂住主 Loop，正常 Tool 可继续运行；
7. MCP 大结果按预算截断；
8. 假 API key、Bearer、query token、private key 不进入 Trace、Evaluation、warning、debug、MCP error 或 doctor；
9. Core Gate、历史 sandbox/MCP/permission/recovery 行为不回归。

## 11. 非目标

PR-08 不做：

- Linux/Windows Sandbox Runtime；
- 容器、VM 或 OS 级完整隔离；
- 通用 Secret Scanner 或熵检测；
- 成功 ToolResult 正文内容审查；
- Extension Registry、Marketplace 或插件签名；
- 跨进程幂等、崩溃恢复或外部事务回滚；
- 全量 MCP 协议特性、OAuth 或 elicitation；
- 为每个文件 Tool 和每个 MCP 方法复制同类测试。

## 12. 交付边界

PR-08 作为单个独立 PR，从已合并 PR-07 基线开发。完成后更新 Core Gate、R1 Evidence Matrix、docs 状态和 E3 Dev Doc。下一候选是 PR-09 / R1-I Evidence Closure & Resume Release，未经单独授权不启动。
