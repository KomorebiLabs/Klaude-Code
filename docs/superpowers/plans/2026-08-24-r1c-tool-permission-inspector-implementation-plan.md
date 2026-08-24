# PR-03 / R1-C Tool / Permission Trace 与最小 Inspector 实施计划

## 目标

在真实 Permission/Tool 边界补齐因果链，并提供按 sequence 消费单份 Trace 的安全只读时间线。与当前 R1-B 变更合并交付，但不扩展到 Evaluation、完整 Permission 状态机或 Sandbox/MCP 重构。

## 任务

1. 新增 Tool/Permission allowlist mapper：只记录 toolName、toolUseId、输入字段摘要、决策/来源、结果长度与 outcome，不记录命令、文件正文或完整 I/O。
2. `RunToolsOptions` 可选透传 `TraceSink`；`runOneToolBlock()` 为每个 block 建立独立 span，并在真实 requested/resolved/started/completed/failed 边界旁路 emit。
3. 保持 `runTools()` 分批、并发、结果顺序和 UI events 不变；Trace emit 失败不得改变执行结果。
4. 新增最小 Trace Inspector 模块与只读脚本入口，复用 Reader、按 sequence 排序、仅输出 allowlist 字段并容忍坏行/未知事件。
5. 在现有 `test:trace` 中证明 success、tool error、permission deny 零执行、并发 span 不串线、Trace on/off 一致、Inspector 隐私与容错。
6. 记录 Dev Doc，并执行聚焦 Tool/Permission 测试、Trace 测试、Build、diff check 与 change detection。

## 停止条件

稳定 `toolUseId` 无法关联并发事件，或接入要求改变 Tool/Permission 结果与 UI 行为时停止。本阶段不建设 Dashboard/Doctor。
