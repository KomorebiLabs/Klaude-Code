---
title: "PR-01 Trace Storage & Availability Contract Dev Doc"
date: 2026-08-24
status: implemented-in-worktree
stage: R1-A
---

# PR-01 Trace Storage & Availability Contract Dev Doc

## 问题

Trace Writer 原先复用 Session Transcript 的 cleanupPeriodDays 开关：关闭会话持久化会静默关闭 Trace；close 无期限等待写队列；Trace 文件没有独立 age/quota owner；disabled/degraded 状态也无法被后续 Inspector/Evaluation 判断。

## 实际边界

QueryEngine.submitInternal 在每次模型 Query 前创建 Trace Writer，记录 query.started，并在 finished/failed/aborted 后于 finally 中 close。Writer 使用项目数据目录下的 traces/<trace-id>.jsonl；CLI 启动阶段原本只清理 Session 与 File History。

## 决策与实现

- Trace 默认独立于 Session Transcript persistence；
- createTraceWriter 保持原有两个必填参数兼容，新增可选 enabled、closeTimeoutMs 和测试写入适配器；
- TraceSink 通过 getStatus 暴露 active、disabled、degraded 与 droppedEvents，不暴露原始错误正文；
- write failure 与 close timeout 都 best-effort 降级，默认 close budget 为 250ms；
- 独立 Trace Storage Policy 默认保留 30 天、项目配额 50 MiB；
- Retention 只接受项目数据目录的直接 traces 子目录，拒绝链接根，跳过链接/非普通/非 JSONL 文件；
- 先按 age 清理，再按 mtime 从旧到新满足 quota；
- CLI 启动时独立、best-effort 执行 Trace Retention；
- package.json 增加统一 test:trace。

## 证据

- Session persistence disabled 时 Trace 仍落盘；
- 显式 disabled 不落盘且状态可见；
- 永久挂起写入在预算内返回并标记 close_timeout；
- 写入失败标记 write_failed，错误中的假 Secret 不进入状态；
- finished/failed/aborted 事件文件可读且正文脱敏；
- age/quota 只删除 traces 内普通 JSONL；
- 链接 Trace 根被拒绝，外部文件保留；
- npm run test:trace 与 npm run build 通过。

## 限制

- disabled 是 Writer API 的显式选项，尚未增加用户配置；当前产品默认始终启用安全 Trace；
- degraded 状态已形成稳定消费接口，但最小 Inspector 属于 PR-03；
- Retention 当前使用代码默认值，配置面与诊断输出留给后续独立需求；
- close timeout 后底层 I/O Promise 无法被 Node fs API 强制取消，但 Query 主路径不再等待它；
- 本阶段不接入 Model、Retry、Tool 或 Permission 新事件。

## 实施困难与处理

首次扩展测试沿用了旧脚本在 Git worktree 内创建临时 cwd 的方式。项目路径解析会把该 cwd 归一到真实仓库的数据目录，导致 Retention 用例误触发真实项目 Trace 清理。核对后真实 Trace 目录只剩测试文件，说明此前 Trace 可能已被删除；删除使用 fs.rm，无法由 Git 恢复。测试根已改到系统临时目录并重新验证，不再映射到真实项目数据。两个残留测试文件的自动清理被执行环境策略拦截，需要手动删除。

QueryEngine characterization 另因既有 golden 使用 CRLF、当前运行产生 LF，且会读取本机用户配置而失败；本阶段没有更新 golden 掩盖该环境漂移，核心 test:trace 与 TypeScript Build 独立通过。

## 下一候选

PR-02 / R1-B Model / Retry / Stream Trace。必须在 PR-01 合并后由用户单独授权。
