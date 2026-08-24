# R1-A Trace Storage & Availability Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 让 Runtime Trace 独立于 Session Transcript 持久化，并具备可见降级、有界关闭、安全 Retention 和统一验证入口。

**Architecture:** Trace Writer 保持 best-effort、内容最小化与现有调用签名兼容，通过状态快照暴露 active/disabled/degraded。独立 Trace Storage Policy 只管理项目数据目录下的 traces 子树；CLI 启动时执行一次 age/quota 清理。

**Tech Stack:** TypeScript、Node.js fs/promises、JSONL、tsx、GitNexus。

---

### Task 1: 先写高风险契约检查

**Files:**
- Modify: src/scripts/test-trace.ts

- [ ] Session persistence disabled 时，默认 Trace 仍落盘。
- [ ] 显式 enabled=false 时 Writer 状态为 disabled 且不落盘。
- [ ] 注入挂起写入时 close 在预算内返回并标记 degraded。
- [ ] 写入失败时状态为 degraded，错误正文不进入状态。
- [ ] Retention 只处理受控 traces 目录，按 age/quota 删除普通 JSONL，跳过链接和外部文件。
- [ ] 运行 npm run test:trace，确认因缺少新契约而失败。

### Task 2: 实现 Writer Availability 与有界关闭

**Files:**
- Modify: src/observability/types.ts
- Modify: src/observability/traceWriter.ts
- Modify: src/observability/index.ts

- [ ] 增加 TraceStatus、TraceWriterOptions 与 getStatus。
- [ ] 移除 Session Persistence gate，保留 createTraceWriter(cwd, traceId) 兼容。
- [ ] close 使用可配置预算；初始化、写入和超时失败只进入安全 degraded 状态。

### Task 3: 实现独立 Trace Retention

**Files:**
- Create: src/observability/traceStoragePolicy.ts
- Modify: src/observability/index.ts
- Modify: src/entrypoint/cli.ts

- [ ] 验证 traceDir 是 projectDir 的直接 traces 子目录。
- [ ] 拒绝符号链接/Reparse Point 根目录，跳过非普通文件和链接。
- [ ] 先按 age、再按 quota 删除最旧 JSONL；失败只计数，不阻塞启动。
- [ ] CLI 启动时 best-effort 调用一次。

### Task 4: 统一验证与文档

**Files:**
- Modify: package.json
- Create: docs/learning/E1/pr-01-trace-storage-contract-dev-doc.md

- [ ] 增加 test:trace 脚本。
- [ ] 运行 npm run test:trace 和 npm run build。
- [ ] 运行 GitNexus detect_changes、git diff --check 并审阅范围。
- [ ] 记录实现、证据、限制和唯一下一候选 PR-02。
