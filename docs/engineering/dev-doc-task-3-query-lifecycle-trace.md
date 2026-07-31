# Easy-Agent 开发者文档 — Task 3：QueryEngine 顶层生命周期 Trace

> 系列：企业级 Harness 升级（P0 Trace / Evaluation 路线）
> 阶段：Task 3（上一阶段：Task 2 JSONL Trace 存储）
> 日期：2026-07-31
> 分支：`feature/trace-task-3-query-lifecycle` → 已合并 `main`
> 提交：`1385998`（功能）→ `91595e1`（merge）

---

## 一、本阶段做了什么

把 Task 2 建好的「本地 JSONL Trace Writer」接进 `QueryEngine`，让**每一个顶层用户请求**（一次完整对话轮次）自动产生一份结构化 Trace，包含 4 个生命周期事件：

| 事件 | 时机 | 记录内容 |
|------|------|----------|
| `query.started` | agentic loop 启动前 | model、permissionMode、messageCount、promptLength、hasUserPrompt |
| `query.finished` | loop 正常结束 | reason、messageCount、token 用量（input/output/cache） |
| `query.failed` | 抛出异常 | 错误类别（Error 名）、脱敏后的错误摘要 |
| `query.aborted` | abort 信号触发 | reason: "abort_signal" |

**实现效果**：

- 每次用户说话（或后台通知自动触发一轮）→ 生成一个 `<traceId>.jsonl`，位于项目 session 目录的 `traces/` 下；
- Trace 里**没有**用户 prompt、系统 prompt、消息内容、工具输出等敏感信息——只记"元信息"（长度、模型、token 数、错误类别）；
- 写入失败完全不影响 Agent 主路径（Writer 内部吞错）。

---

## 二、涉及哪些文件（简要）

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/core/queryEngine.ts` | 修改 | `submitInternal()` 接入 writer，发 started/finished/failed/aborted |
| `src/observability/queryLifecycle.ts` | **新增** | 4 个安全 payload 构造函数（隐私边界集中管理） |
| `src/observability/index.ts` | 修改 | 导出新 helper |
| `src/scripts/test-trace.ts` | 修改 | 新增 4 个 payload 断言（脱敏回归） |

---

## 三、接入点与设计决策（面试重点）

### 为什么选 `submitInternal()` 而不是别处？

`submitMessage()` 是总入口，但它会分流：斜杠命令走 `handleCommand()`，普通输入走 `submitInternal()`。而 `submitInternal()` 是**所有真正进入 agentic loop 的路径的汇聚点**：

```text
普通文本 ──────────────┐
技能展开 /xxx ──────────┤→ submitInternal() → agenticLoop.query()
用户命令展开 ───────────┤
后台通知自动轮次（空串）─┘
```

所以在这里挂生命周期事件，天然覆盖所有"真模型轮次"，且**自动排除** `/help`、`/config` 这类不需要模型参与的内建命令。这是"一个入口、全路径覆盖"的经典做法。

### 为什么把 payload 构造抽到 `queryLifecycle.ts`？

- **隐私边界集中管理**：所有"哪些字段能进 Trace"的决策收在一个文件，审查、修改、面试解释都聚焦；
- **可测试**：纯函数，不依赖 QueryEngine 实例，直接断言输出；
- 与 Task 2 的 `redaction.ts` 呼应：`redaction` 负责"值级"脱敏（密钥字符串），`queryLifecycle` 负责"字段级"克制（压根不收集敏感字段）。**两层防御**。

### traceId 的粒度：每轮一个，而非每会话一个

- 每个顶层请求一个 `traceId`（`randomUUID()`）→ 一个 `.jsonl` 文件；
- 好处：一个 trace = 一个可独立复现的单元，后续 Evaluation 可以直接按 trace 对齐"输入特征 → 输出质量"，不会和同会话其他轮次混淆；
- 后续 Task 4/5（model/tool 层）可以挂在同一个 traceId 下形成完整因果链。

### 错误处理：catch 不吞，finally 必 close

```ts
} catch (error) {
  traceWriter.emit(abortController.signal.aborted ? "query.aborted" : "query.failed", ...);
  throw error;   // 原样抛出，不改变 Agent 语义
} finally {
  await traceWriter.close();   // 确保文件写完整、句柄关闭
}
```

- `throw error` 保留原有行为（调用方该失败还是失败）；
- `query.aborted` 用 `abortController.signal.aborted` 区分"用户主动取消"和"真异常"；
- `close()` 是 await 的——即使 writer 内部失败也被 Task 2 隔离，不会抛到主路径。

---

## 四、遇到的困难与解决（面试"来时路"素材）

### 困难 1：worktree 没有独立 node_modules，tsc 编译到主仓库源码

**现象**：build 突然报出一堆"我没编辑过的文件"（`executor.ts`、`globTool.ts`、`types/*.ts`）的 `TS1127 Invalid character`。

**排查**（关键过程）：
1. 确认 worktree `git status` 只有我改的 4 个文件——说明 worktree 源码是干净的；
2. 对比主仓库这些文件——发现是**中文学习注释**（含全角破折号 `——`、`??` 等字符）导致的解析错误；
3. 查 `node_modules`：worktree 目录下**没有** `node_modules`，`tsc` 沿目录树向上找到了主仓库的依赖，而 `tsconfig` include 的 `src/` 是相对路径，于是**编译的是主仓库的源码**。

**解决**：在 worktree 里 `npm install --prefix . --ignore-scripts` 安装独立 `node_modules`（197 包），build 恢复正常。

**面试价值**：这是 git worktree 的经典坑——**worktree 共享 .git 对象库，但不共享 node_modules**。凡是依赖解析会"向上查找"的工具（tsc、tsx），在 worktree 里都会撞见主仓库文件。

### 困难 2：主仓库未提交改动挡住合并

**现象**：`git merge --no-ff feature/trace-task-3-query-lifecycle` 报 `Please commit your changes or stash them before you merge`，因为主仓库有 278 个未提交改动（用户的学习注释），其中 `queryEngine.ts` 正是合并目标。

**解决**：沿用 Task 2 的流程——
```bash
git stash push -u -m "pre-task3-main-working-tree-20260731"   # 暂存用户改动
git merge --no-ff feature/trace-task-3-query-lifecycle        # 干净合并
git stash pop                                                 # 恢复用户改动（无冲突）
```
这次 stash pop **零冲突**（Task 2 时 `storage.ts` 有过一次冲突），因为用户的注释改动（文件头、import 注释）和 Task 3 的改动（import 插入 + `submitInternal` 内部）区域不重叠。

### 困难 3：GitHub 网络不通，push 失败

**现象**：`git push github feature/...` 反复 `Failed to connect to github.com port 443`（VPN 未全局接管）。

**解决**：用户切换 VPN 为 TUN 全局模式后恢复。本地提交不受影响（`git commit` 是全本地操作）。

---

## 五、验证与测试

```bash
npx tsx src/scripts/test-trace.ts   # ✅ trace DTO/redaction/storage tests passed
npm run build                        # ✅ tsc 0 错误
```

测试覆盖（最小 MVP，不过度）：
- `createQueryStartedPayload` / `createQueryFinishedPayload` 精确字段断言；
- `createQueryFailedPayload` 对含 `password=hunter2`、`Bearer abcdef` 的错误做脱敏断言（**隐私回归**）；
- `createQueryAbortedPayload` 结构断言。

---

## 六、隐私边界（本阶段红线，面试必答）

**允许**：model 名、权限模式、消息数、prompt 长度、token 用量、结束原因、错误类别。

**绝不**：用户 prompt 原文、系统 prompt、消息内容、工具输入/输出、stdout/stderr、API key 等。

payload 里所有字段名都是显式白名单，任何新增字段必须先过 `queryLifecycle.ts` 这关。

---

## 七、后续展望

- Task 4：`agenticLoop` 层 model.requested/completed/failed（重试、流重启）；
- Task 5：tool 与 permission 层事件（复用同一 traceId → span）；
- Task 6：F1–F7 确定性 Evaluation 套件，用这些 trace 做回归基线。

Trace 事件契约、隐私规范、验收计划的完整定义见：
- `docs/engineering/adr/ADR-001-local-structured-harness-trace.md`
- `docs/engineering/specs/harness-trace-event-contract.md`
- `docs/engineering/specs/harness-trace-storage-and-privacy.md`
- `docs/engineering/evaluation/trace-mvp-acceptance-plan.md`
