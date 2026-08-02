---
title: Trace MVP 验收与评测计划
status: draft
created: 2026-07-28
tags:
  - easy-agent
  - agent-harness
  - evaluation
  - testing
  - observability
aliases:
  - Trace MVP Acceptance Plan
---

# Trace MVP 验收与评测计划

> [!important]
> 验收目标不是“写出了 JSONL”，而是证明 Trace 能在不改变 Agent 行为、不泄露默认敏感内容的条件下，可靠地重建一次任务的关键因果链。

关联：[[../adr/ADR-001-local-structured-harness-trace|ADR-001]]、[[../specs/harness-trace-event-contract|事件契约]]、[[../specs/harness-trace-storage-and-privacy|存储与隐私规范]]。

## 1. 验收范围

### P0 包含

- 顶层任务 trace 生命周期；
- 模型 turn、工具、权限、retry、compaction、完成/失败/取消的结构化事件；
- JSONL reader 的基本容错；
- 默认内容最小化与 redaction；
- writer 失败隔离；
- 主 Agent 的 deterministic fixture。

### P0 不包含

- 全自动 LLM judge；
- 跨机器指标平台、云端 telemetry、dashboard；
- 全量真实 API 端到端 benchmark；
- 子 Agent parent-child trace 的完整实现；
- 存储完整 prompt/模型文本/工具输出后回放。

## 2. 成功定义

一次 P0 任务完成只有同时满足以下五条才算通过：

1. 生成可解析 trace，且所有事件共享一个 `traceId`；
2. `sequence` 严格递增，`query.started` 首先出现，正常结束时有唯一 `query.finished`；
3. 必要因果事件齐全：至少能看到模型 turn、工具/权限/retry 中实际发生的事件、最终 reason；
4. 事件中不出现 fixture 注入的明文 secret、完整 prompt 或完整工具输出；
5. 即使 writer 人为失败，Agent 的原有结果、终止 reason、工具调用次数不改变。

## 3. 测试层级

```mermaid
flowchart TB
  U[Unit: DTO / redaction / JSONL reader] --> I[Integration: QueryEngine + AgenticLoop fixture]
  I --> C[Characterization: existing behavior unchanged]
  C --> M[Manual developer replay: inspect one trace]
  M --> R[Regression suite gate]
```

| 层级 | 目的 | 推荐位置 |
| --- | --- | --- |
| Unit | 验证 event schema、sequence、redaction、大小限制、坏 JSONL 行容忍 | `src/observability/*.test` 或项目当前 smoke script 风格。 |
| Integration | 用 fake stream / fake tools 验证 lifecycle 与事件关联 | 复用 `src/scripts/test-queryengine-characterization.ts`、`test-streaming.ts` 的 stub 模式。 |
| Characterization | 确保不开 trace 或 writer 失败时既有行为不变 | 现有 `test:queryengine`、`test:streaming`、`test:resilience` 等。 |
| Manual | 人工确认 trace 能回答“发生了什么” | 一个受控 demo task，检查 JSONL 和最小 reader 输出。 |

## 4. 必须实现的 Deterministic Fixtures

### F1：成功工具链

**场景**：fake provider 依次返回文本、`Read` tool_use、成功 tool result，最终 `end_turn`。

**断言**：

```text
query.started
model.requested(turn=1)
model.completed(turn=1, stopReason=tool_use)
tool.started(Read)
tool.completed(Read, outcome=success)
model.requested(turn=2)
model.completed(turn=2, stopReason=end_turn)
query.finished(reason=completed)
```

并检查：

- 相同 `traceId`；
- sequence 递增；
- `toolUseId` / tool span 能前后关联；
- `query.finished.usage` 与 loop result usage 一致；
- trace 中不包含 fixture prompt 全文或 tool result 原文。

### F2：权限拒绝

**场景**：fake model 请求受控工具；permission callback 或规则返回 deny。

**断言**：

```text
permission.requested
after that: permission.resolved(decision=deny)
tool.completed(outcome=permission_denied) OR explicit safe equivalent
query.finished(reason=<actual loop reason>)
```

还要断言：

- 未记录完整工具参数；
- 没有把“用户拒绝”误写成工具成功；
- trace 可区分 `user`、`rule`、`mode`、`headless` 决策来源。

### F3：可恢复 API retry

**场景**：fake streaming layer 首次返回可重试错误，第二次成功。

**断言**：

```text
model.requested
retry.scheduled(attempt=1)
model.requested
model.completed
query.finished(reason=completed)
```

还要断言：

- retry 的 `attempt/maxRetries/delayMs` 有效；
- 不保存 provider 原始 request/response；
- 若已有 UI `api_retry` 行为，Trace 接入不能改变其出现次数。

### F4：用户取消

**场景**：在等待模型或工具期间触发 `AbortController`。

**断言**：

```text
query.started
... optional in-flight event ...
query.aborted OR query.finished(reason=aborted)
```

还要断言：

- 不能同时标记 `completed`；
- writer 正常关闭或进入可解释降级；
- 主 Agent 不因 trace flush 卡住。

### F5：Trace writer 自身失败

**场景**：注入一个在初始化/append/flush 任一阶段抛错的 writer adapter。

**断言**：

- Agent 的 loop result、messages、工具执行数量、permission 结果与 trace disabled 基线一致；
- writer 至多产生一个受限 `trace.degraded`（若该事件无法写入，可仅写 debug signal）；
- 错误不穿透到 UI 的普通 agent error 流；
- 无递归写入/无限 retry。

### F6：隐私与格式对抗样本

**输入**：fixture 中包含：

```text
ANTHROPIC_AUTH_TOKEN=sk-test-very-secret
Authorization: Bearer abcdef
password=hunter2
https://example.test/?token=abc&signature=xyz
-----BEGIN PRIVATE KEY-----
```

**断言**：扫描 trace 文件，禁止出现上述原文或其完整值；同时仍能保留合法摘要（如 `redactedFieldNames`、长度、错误类别）。

### F7：Reader 容错

**输入**：包含未知字段、未知 event type、无效 JSON 行、最后一行截断的 JSONL fixture。

**断言**：reader 能读取其余有效行、报告/计数无效行，不因单行坏数据崩溃。

## 5. 指标与阈值

P0 以 correctness 与安全优先，不承诺成功率提升。建议报告以下数字：

| 指标 | P0 目标 | 解释 |
| --- | --- | --- |
| Fixture trace lifecycle pass rate | 100% | F1–F7 deterministic suite。 |
| Secret leakage in adversarial fixture | 0 | 明文秘密扫描必须为零。 |
| Main-path behavior difference with writer failure | 0 | 同一 fake 输入下结果等价。 |
| Event order violations | 0 | sequence 和 lifecycle invariant。 |
| Trace writer-induced uncaught errors | 0 | best-effort 承诺。 |
| Per-event serialized size | ≤ 16 KiB | 默认摘要模型。 |

> [!note]
> “Agent task success rate”是 P1 开始应量化的产品指标。P0 先建立能可信测量它的基础，不应伪造尚未运行的基准数字。

## 6. 回归命令建议

实现后应在仓库既有 npm 脚本风格中新增一个专用 trace script，并至少执行：

```bash
npm run build
npm run test:queryengine
npm run test:streaming
npm run test:resilience
npm run test:trace   # 实现时新增
```

若某些现有命令在环境中失败，报告其完整原因并区分“Trace 回归”与“既有环境失败”，不能把失败静默忽略。

## 7. 人工验收清单

- [ ] 我能拿到一个 trace 文件，并从 `traceId` 找到整个任务。
- [ ] 我能读出模型进行了几轮、调用了哪些工具、每步结果如何。
- [ ] 我能确认权限拒绝和 retry 的来源与后果。
- [ ] 我检查过 sample trace，未看到 prompt、API key、完整 command、stdout/stderr 或文件正文。
- [ ] 人为让 writer 失败后，Agent 主任务仍产生与基线一致的结果。
- [ ] 我能明确指出当前 P0 **不能**做什么：不回放、不评判模型质量、不上传、不支持完整子 Agent trace。

## 8. Bad Case → 回归规则

每个真实失败必须沉淀为：

```text
bad-cases/<slug>.md
  1. 用户任务与环境（脱敏）
  2. traceId / 脱敏事件时间线
  3. 失败分类：model / tool / permission / context / provider / UX / recovery
  4. 根因假设与证据
  5. 修复方案
  6. 新增或更新的 deterministic regression fixture
  7. 修复前后对比
```

没有 trace、没有可重放 fixture、没有验证结果的“我觉得修好了”，不能作为企业级 Harness 的完成标准。
