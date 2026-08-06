---
title: Harness Trace 事件契约
status: draft
version: 1
created: 2026-07-28
tags:
  - easy-agent
  - agent-harness
  - observability
  - event-contract
aliases:
  - HarnessTraceEvent v1
---

# Harness Trace 事件契约（v1）

> [!abstract]
> 本规范定义 P0 Trace MVP 的**内部领域事件**，不是 UI event、SDK event，也不是持久化 session transcript 格式。所有运行时代码实施必须遵守本契约；任何破坏性变更必须提升 `schemaVersion`。

关联：[[../adr/ADR-001-local-structured-harness-trace|ADR-001]]、[[harness-trace-storage-and-privacy|存储与隐私规范]]、[[../evaluation/trace-mvp-acceptance-plan|验收计划]]。

## 1. 基础事件包络

```ts
interface HarnessTraceEventV1 {
  schemaVersion: 1;
  eventId: string;              // 每个事件唯一
  traceId: string;              // 一次顶层任务唯一
  sequence: number;             // writer 为同一 trace 分配的递增序号，从 1 开始
  timestamp: string;            // ISO-8601 UTC；仅供观测，sequence 才是排序依据
  eventType: HarnessTraceEventType;
  sessionId?: string;           // 已有 ToolContext.sessionId 时才记录
  parentTraceId?: string;       // 子 Agent trace 使用
  parentSpanId?: string;        // 子 Agent 与发起调用关联；P0 主 Agent 可省略
  spanId?: string;              // turn/tool 等可关联工作单元
  payload: Record<string, unknown>;
}
```

### 不变量

1. 同一 `traceId` 内 `sequence` 严格递增且不重复。
2. `query.started` 必须为该 trace 的第一条可用事件；`query.finished` 是唯一正常终结事件。
3. 某个 trace 写出 `query.finished` 后，writer 拒绝任何后续业务事件。
4. 事件写入失败不生成另一个 trace event，避免失败递归；由 writer 的受限诊断路径处理。
5. 所有用户可控/模型可控文本经过 [[harness-trace-storage-and-privacy#内容分级与记录策略|内容分级]] 后才进入 `payload`。
6. 不允许把 `Error`、`ToolResult`、`MessageParam` 等运行时对象直接 JSON 序列化；先映射到本契约字段。

## 2. 标识符与关联关系

| 标识符 | 生成时机 | 作用域 | 用途 |
| --- | --- | --- | --- |
| `traceId` | 顶层任务开始 | 一个 QueryEngine submit | 把完整任务串起来。 |
| `spanId` | model turn / tool execution 开始 | 一个 event pair | 关联 `*.started` 与 `*.completed/failed`。 |
| `turnId` | 模型调用前 | 任务内单调整数 | 人类阅读与指标聚合。建议同时进入 `payload.turnId`。 |
| `toolUseId` | 模型产生 tool block | API/本轮工具调用 | 关联模型 tool_use 与工具执行。 |
| `parentTraceId` | 子 Agent trace 创建 | child trace | 表达主/子 Agent 关系；不能复用父 traceId。 |

> [!warning]
> `sessionId` 不是 `traceId`。一个 session 可包含多个用户任务；resume 后同一 session 也不应把不同任务混成同一 trace。

## 3. 事件目录

### 3.1 任务生命周期

| eventType | 发射边界 | 必填 payload | 禁止记录 |
| --- | --- | --- | --- |
| `query.started` | QueryEngine 调用 loop 前 | `model`, `permissionMode`, `invocationKind` (`user_prompt` / `task_notification` / `headless`) | 完整 prompt、system prompt。 |
| `query.finished` | loop 返回或顶层 finally | `reason`, `turnCount`, `usage`, `durationMs` | 完整消息、未脱敏错误对象。 |
| `query.aborted` | abort signal 触发并被确认 | `stage`, `durationMs` | 用户键盘原始输入。 |
| `query.failed` | 顶层未恢复异常 | `errorCategory`, `safeMessage`, `stage` | stack 默认不落盘；token/请求正文。 |

`reason` 必须映射现有 `LoopTerminationReason`：`completed`、`aborted`、`model_error`、`max_turns`、`blocking_limit`。未知值必须映射为 `unknown`，并在开发测试失败。

### 3.2 模型与流

| eventType | 发生位置 | 必填 payload | 说明 |
| --- | --- | --- | --- |
| `model.requested` | 每次 `streamMessage` 前 | `turnId`, `model`, `toolCount`, `messageCount`, `inputEstimate?` | 不保存 messages 内容。 |
| `model.completed` | 流成功结束 | `turnId`, `stopReason`, `usage`, `durationMs`, `contentSummary` | `contentSummary` 为 block 类型/数量，不保存原文。 |
| `model.failed` | 该轮不可恢复失败 | `turnId`, `errorCategory`, `safeMessage`, `durationMs`, `retryable` | 不能保存 provider 原始响应 body。 |
| `retry.scheduled` | API 层已决定重试 | `turnId`, `attempt`, `maxRetries`, `delayMs`, `errorCategory` | 不保存 request body。 |
| `stream.restarted` | `stream_restart` 事件 | `turnId`, `reason` | 对应 `max_tokens_escalation` / `reactive_compact`。 |

### 3.3 工具和权限

| eventType | 发射边界 | 必填 payload | 安全要求 |
| --- | --- | --- | --- |
| `tool.started` | 单工具真正开始执行前 | `spanId`, `turnId`, `toolUseId`, `toolName`, `inputSummary` | `inputSummary` 仅字段名、长度、允许的安全枚举；不落原始命令/内容。 |
| `tool.completed` | 获得 ToolResult 后 | `spanId`, `turnId`, `toolUseId`, `toolName`, `durationMs`, `outcome`, `resultSummary` | stdout/stderr/文件内容只记录长度、截断标志、hash（如启用）。 |
| `tool.failed` | executor 抛出或 ToolResult 表示失败 | `spanId`, `toolName`, `errorCategory`, `safeMessage`, `durationMs` | 禁止直接 stringify error/cause。 |
| `permission.requested` | 需要用户决策时 | `toolName`, `requestKind`, `reasonCategory` | 不保存完整执行参数。 |
| `permission.resolved` | 决策返回后 | `toolName`, `decision` (`allow`/`deny`), `source` (`user`/`rule`/`mode`/`classifier`/`headless`) | 不保存用户对话全文。 |

`outcome` 建议为：`success`、`tool_error`、`permission_denied`、`aborted`、`timeout`、`unknown`。

### 3.4 上下文、子 Agent 与运行时降级

| eventType | 触发条件 | 必填 payload |
| --- | --- | --- |
| `context.compacted` | 自动/手动压缩完成 | `trigger`, `beforeTokenEstimate?`, `afterTokenEstimate?`, `durationMs` |
| `token.warning` | 现有 `token_warning` 事件 | `level`, `tokenEstimate?` |
| `agent.spawned` | 子 Agent 启动成功 | `childTraceId`, `agentType`, `isolation`, `executionMode` |
| `agent.finished` | 子 Agent 完成 | `childTraceId`, `reason`, `durationMs`, `usage?` |
| `trace.degraded` | writer 已禁用/丢弃事件 | `reason`, `droppedEventCount`；仅允许一次 |

> [!todo]
> P0 只实现主 Agent 事件；`agent.spawned` / `agent.finished` 是 v1 预留项。实现 parent-child trace 前不得伪造这些事件。

## 4. 摘要字段的统一语义

### `inputSummary`

```ts
interface InputSummary {
  fieldNames: string[];         // 最多 20 个
  serializedLength: number;     // redaction 前仅长度
  contentOmitted: true;
  redactedFieldNames?: string[];
}
```

### `resultSummary`

```ts
interface ResultSummary {
  outcome: "success" | "tool_error" | "permission_denied" | "aborted" | "timeout" | "unknown";
  textLength?: number;
  blockTypes?: string[];
  exitCode?: number;
  truncated: boolean;
  contentOmitted: true;
}
```

### `safeMessage`

- 面向本地诊断的短句，最大 500 字符；
- 通过 redaction 后写入；
- 不能包含完整 command、URL query、header、环境变量值、文件内容或 provider response body；
- 若安全摘要无法生成，写固定分类文案，而不是回退到原始 error message。

## 5. 兼容性与演进

- 新增可选字段：不改变 `schemaVersion`；
- 修改字段含义、删除字段、改变事件排序/必填语义：升级主版本；
- reader 必须忽略未知 `eventType` 与未知字段；
- reader 遇到无效 JSONL 行或不支持的 `schemaVersion` 时记录诊断并继续扫描后续行；
- fixture 必须覆盖 v1 解析、未知字段容忍、尾行截断容忍。

## 6. 明确非目标

- 不承诺可重放模型调用；
- 不保存足以复原完整 prompt、工具 input/output 或编辑内容的数据；
- 不建立跨机器全局 trace 查询；
- 不代替现有 UI event、session transcript、debug log 或错误报告；
- 不在 P0 统计“模型思考质量”或自动判定任务质量。
