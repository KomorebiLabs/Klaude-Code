# PR-03：Tool / Permission Trace 与最小 Inspector 开发记录

## 问题与真实边界

Model Trace 已能解释模型请求与恢复，但 Tool/Permission 仍只能从延迟 UI event 推断。真实边界位于 `runOneToolBlock()`：PreToolUse Hook、`checkPermission()`、可选用户决策、`tool.call()`、PostToolUse Hook 和最终结果都在这里发生；`runTools()` 只负责安全并发分批和结果顺序。

## 决策

- 不修改 `checkPermission()` 和 `runTools()` 调度算法，只通过 `RunToolsOptions` 透传可选 TraceSink。
- 每个 Tool Use 创建独立 span，以稳定 `toolUseId` 关联 Permission 与 Tool 事件。并发 JSONL sequence 只代表写入顺序。
- `permission.requested` 只在真正调用用户决策回调前发出。规则、模式、Hook、headless 和无回调默认拒绝只记录 resolved，避免伪造用户请求。
- `tool.started` 紧贴 `tool.call()` 前；最终 `isError`、PostToolUse block 或异常记录 failed，不同时记录 completed。
- payload 只保留 Tool 名称、ID、输入字段名/长度、decision/source、结果长度、outcome 与 duration。命令、路径值、文件正文、完整 Tool I/O 和错误正文不进入 Trace。
- 所有 Tool/Permission emit 通过失败隔离包装；第三方/测试 Sink 抛错不改变执行结果。

## Inspector

`traceInspector.ts` 复用容错 Reader，按 sequence 排序，只投影 allowlist 字段。`npm run inspect:trace -- <trace.jsonl>` 提供最小只读入口。坏行继续忽略；未知 v1 event 以通用事件名显示，但其非 allowlist payload 不输出。

## 证据

- Tool success：resolved → started → completed，Trace on/off 的 Tool 返回值一致。
- Tool error：resolved → started → failed，不产生 completed。
- Permission Deny：requested → resolved(user/deny)，真实 `tool.call()` 计数为 0。
- 两个并发安全 Tool 各自使用唯一 span，且同一 Tool 的三个事件保持同 span。
- 抛错 TraceSink 不改变 Tool Result。
- Inspector 对乱序 fixture 稳定按 sequence 输出；坏 JSONL 与未知事件不阻断读取；Secret、命令、文件正文和完整 I/O 不显示。
- `npm run test:trace`、`npm run test:resilience` 与 `npm run build` 通过。
- `npm run test:stage20` 未通过：历史 task-output 路径断言有 2 项失败，随后 Windows 临时 worktree 清理因 `EBUSY` 中断；本阶段不将该脚本记为通过，且没有改动对应模块。

## 限制

- Permission source 当前保持高层稳定分类，不在 E1 固化完整规则/Classifier/Sandbox 状态机；该语义属于后续 E3 加固。
- Inspector 是开发者最小时间线，不提供查询、Dashboard、Doctor、恢复建议或诊断包。
- Evaluation Foundation 属于下一阶段 PR-04，未在本次整合 PR 中启动。
