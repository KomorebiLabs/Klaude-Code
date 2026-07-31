# Easy-Agent 开发者文档 — Task 1：Trace 事件契约与安全基础

> 系列：企业级 Harness 升级（P0 Trace / Evaluation 路线）
> 阶段：Task 1（P0 起点）
> 日期：2026-07-28
> 分支：`enterprise-harness-upgrade` 工作树 → 提交 `c0011b4` + `ca009ce`
> 后续合并：Task 2 时并入 main

---

## 一、本阶段做了什么

为 Easy-Agent 建立「结构化 Trace」的**数据契约**和**安全地基**，让后续所有 observability（Trace、Evaluation、回归测试）都建立在一个明确、安全、可扩展的事件模型上。

三个交付物：

1. **事件契约**（`types.ts`）：定义了什么是"一条 Trace 事件"——统一的事件结构 + 17 种事件类型；
2. **脱敏引擎**（`redaction.ts`）：确保任何进入 Trace 的文本/对象，其中的密钥、口令、token 都被抹掉；
3. **安全摘要**（`summarizeToolInput` / `summarizeToolResult`）：工具调用只记录"元信息"，绝不落原文。

---

## 二、涉及哪些文件（简要）

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/observability/types.ts` | **新增** | Trace 事件 DTO：`HarnessTraceEvent`、事件类型联合、`TraceSink` 接口、摘要类型 |
| `src/observability/redaction.ts` | **新增** | 脱敏引擎（值级） |
| `src/observability/index.ts` | **新增** | observability 统一出口 |
| `src/scripts/test-trace.ts` | **新增** | 最小脱敏/摘要测试 |

---

## 三、核心设计（面试重点）

### 1. 事件契约：一个事件 = 一行 JSON

```ts
interface HarnessTraceEvent {
  schemaVersion: 1;          // 契约版本，未来演进用
  eventId: string;           // 全局唯一
  traceId: string;           // 一次顶层任务一个
  sequence: number;          // 严格顺序来源（比时间戳可靠）
  timestamp: string;         // 辅助信息
  eventType: "query.started" | "query.finished" | ... // 17 种
  sessionId?: string;
  spanId?: string;           // 后续 Task 4/5 嵌套跨度
  payload: Record<string, unknown>;  // 只放白名单字段
}
```

关键决策：

- **`sequence` 是顺序唯一来源**，`timestamp` 只是辅助——因为同毫秒多条事件时，时间戳无法排序；
- **17 种事件类型是"未来规划"**：Task 1 只实现其中一部分（query 生命周期留到 Task 3），但类型先在契约里定义好，后续任务不用改契约；
- **`schemaVersion` 是版本演进保险丝**：未来改结构时，老 trace 文件仍可被正确识别/迁移。

### 2. 脱敏引擎：三层防御

`redactString()` 处理字符串中的密钥模式：

```ts
Bearer abcdef        →  Bearer [REDACTED]        // 常见认证头
sk-XXXXXX            →  [REDACTED]               // OpenAI 风格 key
-----BEGIN PRIVATE KEY-----... → [REDACTED]      // 私钥块
password=hunter2     →  password=[REDACTED]      // 键值对（含 JSON 转义形式）
?token=abc&sig=def   →  ?token=[REDACTED]&sig=[REDACTED]  // URL 查询参数
```

`redactValue()` 处理**嵌套对象**：

- 键名命中敏感词（`apiKey`、`token`、`password`…）→ 整个值替换为 `[REDACTED]`；
- 循环引用 → `[Circular]`（防止 `JSON.stringify` 抛错）；
- `bigint` → 转字符串（否则 stringify 会抛错）。

### 3. 安全摘要：为什么"只记元信息"？

工具调用（Bash、Read 等）的输入输出可能非常大且敏感。`summarizeToolInput` 只记录：

```ts
{
  fieldNames: ["command", "path"],   // 字段名（最多 20 个）
  serializedLength: 1024,             // 序列化长度
  contentOmitted: true,               // 显式声明：内容已省略
  redactedFieldNames?: ["apiKey"]     // 哪些字段因敏感被剔除
}
```

**绝不记录** `command` 的值、文件内容、stdout/stderr。这样：

- Evaluation 可以统计"工具调用类型分布、输入规模"，但拿不到任何可泄漏的内容；
- 面试可答：这是**最小化收集（data minimization）**原则的具体实现。

---

## 四、遇到的困难与解决

### 困难 1：Task 1 修复子代理两次超时卡住

**现象**：隔离 worktree 中，子代理在同一修复任务上两次超时（0 token 进展），任务停滞。

**排查**：检查子代理的未提交状态、失败测试与实现差距，确认是上下文/隔离问题而非代码难度。

**解决**：改为在会话内直接、小步推进——只改 `src/observability` 和 `src/scripts/test-trace.ts`，每步验证后提交。后续任务不再依赖大粒度子代理编排。

### 困难 2：脱敏对"转义 JSON"的漏网

**现象**：字符串内嵌的 JSON（如 `'{\"apiKey\":\"abc123\"}'`）含转义引号，最初的正则漏过，测试捕获后修复。

**解决**：正则支持 `\\\"` 转义引号形式（`QUOTE_DELIMITER` 模式），覆盖"字符串内嵌 JSON"和"JSON 转义"两种形态，并加入回归测试用例。

### 困难 3：循环引用 / bigint 导致 stringify 崩溃

**现象**：`redactForTrace(circularObject)` 会因循环引用抛 `TypeError`；`bigint` 会抛 `TypeError: Do not know how to serialize a BigInt`。

**解决**：`WeakSet` 追踪已访问对象 → 返回 `[Circular]`；`bigint` → 字符串化。两条都在测试里覆盖。

---

## 五、验证与测试

```bash
npx tsx src/scripts/test-trace.ts   # ✅ trace DTO/redaction/storage tests passed
```

测试覆盖（最小 MVP）：
- 嵌套密钥字段、Bearer、`sk-*`、`password=`、`apiKey:`、Authorization Basic/Digest/OAuth、`env=`；
- 字面 JSON 与转义 JSON 两种形态；
- 私钥块；
- 循环对象/数组、`bigint`；
- 工具结果摘要不落原文。

---

## 六、为什么从"契约 + 脱敏"开始（路线依据）

P0 路线是 Local Structured Harness Trace + Evaluation。起步就写"事件契约"和"脱敏"而不是先接代码，因为：

1. **契约先行**：后续 Task 2/3/4/5 的事件格式统一，避免各任务各写各的格式再返工；
2. **安全先行**：任何 trace 落盘之前，先保证"能落盘的只有安全内容"——如果先实现 Writer 再补脱敏，容易漏掉某个已落盘的敏感字段；
3. **可测先行**：脱敏是纯函数，最容易被单测锁定；先把最容易被面试拷打的安全边界测死。

这符合企业级 Harness 的工程顺序：**先定边界，再填功能**。

---

## 七、后续衔接

- Task 2：把契约落成 JSONL 文件（Writer/Reader/存储路径）；
- Task 3：QueryEngine 顶层生命周期接入（已用上本阶段的 `createSafeMessage`）；
- Task 4/5：model / tool / permission 层事件（复用同一 traceId 与 spanId）。
