---
title: Harness Trace 存储与隐私规范
status: draft
created: 2026-07-28
tags:
  - easy-agent
  - agent-harness
  - privacy
  - security
  - observability
aliases:
  - Trace Storage and Privacy
---

# Harness Trace 存储与隐私规范

> [!danger] 核心原则
> Trace 的价值是解释行为，不是把用户的工作区、提示词、命令、密钥和模型响应复制一份到磁盘。默认应记录**结构与摘要**，而不是内容。

关联：[[harness-trace-event-contract|事件契约]]、[[../adr/ADR-001-local-structured-harness-trace|ADR-001]]、[[../evaluation/trace-mvp-acceptance-plan|验收计划]]。

## 1. 与 Session Transcript 的关系

现有 `src/session/storage.ts` 已将 session transcript 持久化为 JSONL，位置由 `getSessionPaths(cwd, sessionId)` 基于 Easy-Agent home 与项目路径推导；其 retention 由 `cleanupPeriodDays` 控制，`0` 可禁用 session persistence。

Trace **不能直接扩展为 transcript entry**，原因：

1. transcript 面向 conversation resume，trace 面向任务诊断与评测；
2. transcript 中有 `message` entry，可能携带完整对话内容；
3. trace 需要 `traceId`、turn/tool causality、schema version、降级状态；
4. 二者 retention、访问权限和未来导出策略可能不同。

### P0 存储决策

```text
Easy-Agent home / projects / <project-key> /
  sessions / <sessionId>.jsonl        # 既有 transcript，保持不变
  traces / <traceId>.jsonl            # 新增 P0 trace，独立生命周期
```

> [!note]
> 上图是设计目标，不宣称现有目录中已经有 `traces/`。实际路径应复用 `getEasyAgentHome()` 与 `getProjectPathInfo()` 的项目隔离规则，而不是手写 home 目录或 cwd 编码。

## 2. 文件生命周期

| 阶段 | 规则 |
| --- | --- |
| 创建 | `query.started` 前由 writer 确保项目 trace 目录存在；创建失败进入 degraded mode，主任务继续。 |
| 写入 | append-only，一行一个 event；UTF-8；每行 JSON 必须独立解析。 |
| 崩溃 | 最后一行可能部分写入；reader 必须忽略坏行后继续读取。 |
| 正常结束 | 尝试写入一次 `query.finished`，之后关闭 writer。 |
| retention | P0 与 session `cleanupPeriodDays` 同步是默认候选，但须在实现 ADR 中明确；不能悄悄永久保留。 |
| 删除 | 必须仅删除 trace 目录内、匹配受控文件名的旧 trace；不得用不受控路径递归删除。 |

## 3. 内容分级与记录策略

| 级别 | 示例 | P0 默认行为 | 理由 |
| --- | --- | --- | --- |
| A：非敏感结构 | event type、工具名、模型名、duration、token usage、exit code、permission decision | 记录 | 对诊断价值高，泄露面较低。 |
| B：潜在敏感元数据 | cwd、相对路径、URL hostname、工具参数字段名、错误类别 | 最小化记录 / 归一化 | 可能暴露项目结构或服务关系。 |
| C：高风险内容 | prompt、system prompt、文件正文、stdout/stderr、完整命令、tool arguments、模型文本 | 默认不记录 | 可能包含源代码、商业数据、个人信息、凭据。 |
| D：秘密 | API key、Bearer token、Cookie、密码、私钥、环境变量值、Authorization header | 永不记录 | 不存在“调试方便”的例外。 |

### P0 允许字段示例

```json
{
  "eventType": "tool.completed",
  "payload": {
    "toolName": "Bash",
    "durationMs": 423,
    "outcome": "success",
    "resultSummary": {
      "exitCode": 0,
      "textLength": 1820,
      "truncated": true,
      "contentOmitted": true
    }
  }
}
```

### P0 禁止字段示例

```json
{
  "command": "curl -H 'Authorization: Bearer ...' ...",
  "environment": { "ANTHROPIC_AUTH_TOKEN": "..." },
  "prompt": "请修复客户 A 的支付问题...",
  "stdout": "...完整输出...",
  "fileContent": "...源代码..."
}
```

## 4. Redaction 规则

### 4.1 防御深度

1. **设计层**：事件 payload 不接收高风险原文。
2. **映射层**：各入口只构造 allowlisted summary DTO。
3. **writer 层**：递归 redaction 作为最后一道防线。
4. **测试层**：用真实样式假密钥、header、密码、URL query 验证绝不出现。

不能把第 3 层当作前两层的替代品：正则 redaction 无法可靠识别所有机密。

### 4.2 最低敏感字段集合

key 匹配不区分大小写，至少覆盖：

```text
apiKey, api_key, token, accessToken, refreshToken,
authorization, cookie, password, passwd, secret,
privateKey, clientSecret, credentials, env
```

匹配的值替换为：

```text
[REDACTED]
```

同时需要对常见 value 形态做兜底：

- `Bearer <value>`；
- `sk-...` / provider token 形态；
- PEM 私钥边界；
- URL query 中的 `token`、`key`、`sig`、`signature` 等参数。

> [!warning]
> 兜底 pattern 降低意外泄露概率，但不能让系统允许记录完整高风险内容。**永不采集**比“采集后试图删干净”更可靠。

## 5. 大小、性能与失败隔离

| 控制项 | P0 建议 | 原因 |
| --- | --- | --- |
| 单 `safeMessage` | ≤ 500 字符 | 防止 error 扩张。 |
| 单 event 序列化后大小 | ≤ 16 KiB | 防止工具异常输出撑爆 trace。 |
| 单 trace 文件 | ≤ 5 MiB 后进入 degraded/summary-only | 限制本地磁盘成本。 |
| 字段数组 | ≤ 20 项 | 防止输入 schema/工具字段膨胀。 |
| writer 错误 | best-effort，不抛回主 loop | Trace 不得影响任务执行。 |
| flush | 任务结束时尝试；不承诺每事件 fsync | CLI 交互性能优先。 |

实际阈值在实现前应以 fixture 和真实任务测量校准；此处是设计上限，不是假装已经压测后的事实。

## 6. 用户控制与可见性

P0 必须至少做到：

- 用户能通过文档得知 trace 的目录、默认内容范围和 retention；
- 所有 trace 都是本地文件，不进行网络上传；
- 关闭 session persistence 时，trace 的默认行为必须在设置文档中明确，不能产生“我关了持久化但仍被记录”的意外；
- trace 路径不得在普通 UI 文案中泄露高风险内容；
- 导出、共享、上传 trace 是未来能力，P0 不提供。

## 7. 威胁建模

| 威胁 | 后果 | P0 缓解 |
| --- | --- | --- |
| Trace 捕获 API key | 凭据泄露 | 永不采集 + allowlist DTO + writer redaction 测试。 |
| Shell 输出含客户代码/密钥 | 本地泄露、误提交 | 默认仅长度/退出码/摘要，不写输出。 |
| Trace 文件无限增长 | 磁盘耗尽、性能下降 | 文件上限、retention、degraded mode。 |
| 恶意工具结果制造超大/畸形 JSON | 崩溃或写入失败 | 序列化上限、错误隔离、坏行容忍。 |
| 共享 trace 时暴露项目结构 | 隐私/安全风险 | P0 不提供共享；路径仅最小化/相对化。 |
| writer 被攻击导致主任务失败 | 可用性下降 | 所有 writer 操作 best-effort、不得反向抛出。 |

## 8. 需要在实现前决定的开放项

- `cleanupPeriodDays: 0` 是否同时禁用 trace？推荐：**是**，除非后续引入独立、显式的 trace setting。
- trace 是否复用 session ID 作为路径分区？推荐：项目目录下独立 `traces/`，每个顶层 trace 独立文件。
- 是否记录绝对 cwd？推荐：仅记录已归一化 project identity；避免绝对用户路径。
- 是否给开发模式开放内容采样？推荐：不属于 P0；必须另立 ADR 和显式 opt-in。
