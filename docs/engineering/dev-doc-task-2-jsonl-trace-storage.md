# Easy-Agent 开发者文档 — Task 2：本地 JSONL Trace 存储

> 系列：企业级 Harness 升级（P0 Trace / Evaluation 路线）
> 阶段：Task 2（承接 Task 1 事件契约与脱敏）
> 日期：2026-07-30
> 分支：`feature/trace-task-2-storage` → 提交 `6950503`
> 合并：`6932280`（merge 进 main）→ 已推送 GitHub

---

## 一、本阶段做了什么

把 Task 1 定义的 Trace 事件契约**落成真实的本地文件**——一个"弹性 JSONL Trace Writer/Reader"，并复用既有 session 持久化的受控路径，让 Trace 文件安全地躺在每个项目的私有目录里。

三个交付物：

1. **Trace Writer**（`traceWriter.ts`）：把事件逐行追加写入 `<项目目录>/traces/<traceId>.jsonl`，写入失败不影响 Agent 主路径；
2. **Trace Reader**（`traceReader.ts`）：容忍坏行、截断行的 JSONL 读取器（Evaluation 回归用）；
3. **受控存储路径**（`session/storage.ts`）：复用 `getProjectPathInfo` 的项目隔离机制，Trace 文件只落在本项目目录内。

---

## 二、涉及哪些文件（简要）

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/observability/traceWriter.ts` | **新增** | JSONL 追加写、顺序队列、失败隔离 |
| `src/observability/traceReader.ts` | **新增** | 容错读取 |
| `src/session/storage.ts` | 修改 | `getTracePaths()` / `getTracePath()` 受控路径 + traceId 消毒 |
| `src/observability/index.ts` | 修改 | 导出 Writer/Reader |
| `src/scripts/test-trace.ts` | 修改 | 存储层最小测试 |

---

## 三、核心设计（面试重点）

### 1. 为什么用 JSONL 而不是单个大 JSON / SQLite？

| 方案 | 问题 |
|------|------|
| 单个大 JSON | 全量重写、追加困难、坏一处全废 |
| SQLite | 引入依赖、IO 重、对"追加型观测数据"过重 |
| **JSONL** | 每行独立事件，**天然追加、天然部分可读**、可被 `grep`/`jq` 直接分析 |

JSONL 是观测/日志领域的事实标准（OpenTelemetry Collector、V8 的 trace 等都用），零依赖、流式友好。

### 2. Writer 的"顺序 + 隔离"双保险

```ts
emit(eventType, payload) {
  // ① sequence 同步自增——保证顺序
  // ② 事件对象先过 redactForTrace 再落盘
  // ③ 追加操作串进 writeQueue（Promise 链）——保证磁盘顺序
  // ④ appendFile 失败 .catch(() => {})——吞掉，主路径不受影响
}
```

- **`sequence` 同步自增**：即使异步写还没完成，事件顺序也已经确定；
- **`writeQueue` Promise 链**：多个 `appendFile` 串行执行，避免并发交错写坏文件；
- **失败吞掉**：磁盘满、权限错等都不会抛到 Agent 主循环——观测系统"可以丢，不能砸"。

### 3. 存储路径：复用一个已有机制，而不是自己造

```ts
getTracePaths(cwd, traceId) {
  const { projectDir } = await getSessionPaths(cwd, ...);
  return { traceDir: projectDir + "/traces", tracePath: ... + sanitize(traceId) + ".jsonl" };
}
```

- **复用 `getProjectPathInfo` 的项目隔离**：同一个仓库、不同 cwd 的 trace 不会串目录；
- **traceId 消毒**：`../escape` 这类恶意 ID 会被替换成下划线，**防止路径穿越逃出 traces/ 目录**（这是独立审查发现的高危问题，见下）。

### 4. Reader 的容错哲学

```ts
// 缺文件 → 返回 []
// 坏行 / 截断行 → 跳过，继续读后面的
// 逐行独立 try/catch
```

一个 10MB 的 trace 文件里有一行被截断（进程崩溃），其余 9999 行仍然可读——**部分可读 > 全量不可读**，这是观测数据读取器的底线。

---

## 四、遇到的困难与解决（面试"来时路"重点）

### 困难 1：独立审查发现「路径穿越」高危问题

**问题**：最初 `path.join(traceDir, \`${traceId}.jsonl\`)` 直接用原始 traceId——若 traceId 是 `../escape`，`path.join` 会规范化出目录，**逃出 traces/ 目录写到别处**（任意写）。

**解决**：加 `sanitizeTraceId()`（非法字符→`_`，空→`trace`），并补回归断言：`../escape` 的 dirname 必须与正常 trace 相同。**高危问题在合入前被审查拦截**——这就是"提交前独立审查"的价值。

### 困难 2：测试重复运行导致文件行数不对（5 ≠ 2）

**现象**：测试期望 2 行，实得 5 行。根因：writer 是**追加型**，测试临时目录复用项目哈希路径，上一次运行的 trace 行残留。

**解决**：测试先 `fs.rm(tracePath, {force:true})` 清掉旧文件再写。也侧面验证了"追加语义"确实在起作用。

### 困难 3：错误注入测试太弱，不能证明"失败隔离"

**问题**：最初用"父目录不存在"模拟失败，但 `createTraceWriter` 可能已把目录建好，测试形同虚设。

**解决**：先创建 writer → 拿到路径 → **删掉整个 trace 目录** → 再 emit/close。此时 appendFile 必然失败，断言主流程不抛——真正验证了失败隔离。

### 困难 4：合并到 main 时 stash 冲突（storage.ts）

**现象**：主仓库有 270+ 未提交改动，合并 feature 分支时 `storage.ts` 出现冲突（Task 2 的 Trace 函数 vs 用户的本地中文注释）。

**解决**：stash → 干净合并 → stash pop → 手动保留**双方内容**（Trace 函数 + 注释共存），移除冲突标记。教训：**合并前先确认目标文件是否有未提交改动**。

---

## 五、验证与测试

```bash
npx tsx src/scripts/test-trace.ts   # ✅ trace DTO/redaction/storage tests passed
```

存储层覆盖：
- 写入 → 读回，事件顺序正确；
- 追加坏行/截断行后，Reader 仍只返回有效事件；
- session persistence 关闭 → 不写 trace 文件；
- writer 目录被删 → emit/close 不抛（失败隔离）；
- 路径穿越被消毒（`../escape` 回归）。

---

## 六、与 Task 1 的分工（面试可答）

| 层 | Task 1 | Task 2 |
|----|--------|--------|
| 契约 | 事件结构、17 类型、sequence 语义 | — |
| 安全 | 值级脱敏（redaction）、字段级克制（summary） | 落盘前再过一次 `redactForTrace`（纵深） |
| 存储 | — | JSONL 写/读、受控路径、失败隔离 |

Task 1 回答"**Trace 长什么样、什么能进**"，Task 2 回答"**Trace 落哪里、怎么落、坏了怎么办**"。

---

## 七、后续衔接

- Task 3：`QueryEngine.submitInternal()` 接入 Writer，发 query 生命周期事件（已用上 `createTraceWriter` 与 `getTracePath`）；
- Task 4/5：model / tool 层挂同一 traceId；
- Task 6：Evaluation 套件用 `readTraceEvents` 读回 trace 做回归基线。
