# PR-10～PR-11：Context Provenance 与 Memory Governance 设计

## 1. 目标

在一个纵向治理 PR 中连续完成两个 Slice：先为进入模型请求的 Context 建立不含正文的来源和预算清单，再让 Memory 的写入、更新、过期、冲突、删除与 Compaction 保真建立在该清单之上。现有 Prompt、Tool、Permission、Retry 和失败语义保持兼容。

## 2. 真实现状

- `buildSystemPrompt()` 返回字符串数组，调用方只能看到最终 Prompt，无法解释每个组成部分的来源、资格和规模。
- `MemoryWrite` 将模型输出直接交给 `writeProjectMemory()`；可选 `file_name` 缺少完整 canonical containment，更新依赖名称/描述的模糊包含匹配。
- Memory frontmatter 只有 `name/description/type`，无法说明来源、修订、写入时间和过期时间。
- `findRelevantMemories()` 是空实现；当前系统只把 `MEMORY.md` 索引注入 Prompt，再由模型主动读取正文。
- Compaction 由模型生成自由文本摘要，虽然保留最近消息和 Tool 配对，但没有独立的关键约束保真清单。

## 3. Slice A：Context Provenance & Budget

新增 `ContextManifest`，每个条目只记录：稳定 source ID、类别、资格原因、加载状态、字符数、估算 Token 和省略原因。类别覆盖 static instructions、environment、project instructions、memory guidance/index、session instructions、skills、agents/team、output style 和 language。

`buildSystemPromptBundle()` 返回 `{ parts, manifest }`；既有 `buildSystemPrompt()` 继续返回 `parts`，从而保持调用兼容。预算是确定性估算，不冒充 Provider billing。Query 提交时将 manifest 以白名单 Trace Event 记录，Diagnostics 只消费聚合数值和类别，不保存 Prompt 正文、路径或 Memory 内容。

Usage 继续以现有 `usageAnchorIndex` 为权威；新增证据只证明 Retry/Restart 后不把相同前缀重复估算为新的 Context 来源，不建设价格平台。

## 4. Slice B：Memory Governance

### 4.1 版本化元数据

Memory schema v2 在旧字段之外增加：`schema`、`source`、`created_at`、`updated_at`、可选 `expires_at` 和 `revision`。旧文件继续可读，状态为 `legacy/unknown`，不得伪造来源或时间。

允许的来源为 `user`、`project`、`external`、`inference`。只保存安全枚举和可选的安全相对引用；不默认保存 Prompt、完整 URL、命令、文件内容或绝对路径。

### 4.2 写入与冲突

- 文件名必须是 Memory 目录内的相对 `.md` 路径；拒绝绝对路径、`..`、NUL、入口文件、`.trash` 和 symlink 逃逸。
- revision 由规范化后的治理字段和正文计算，不包含绝对路径。
- 更新已有文件必须提供当前 revision；缺失或不匹配返回结构化 conflict，不静默覆盖。
- 明确的 `replace` 冲突策略仍需匹配 revision；它表示用户接受内容替换，不表示可以覆盖并发更新。
- 当前仓库事实优先于 Memory。Repository 自动语义比对不在本 PR 实现；冲突通过显式 revision、来源和过期状态被暴露，而不是伪装成自动理解源码。

### 4.3 过期与读取

`expires_at` 使用 ISO 时间。读取时计算 `active/stale/legacy`；过期内容仍可列出和人工检查，但从模型可依赖的 active manifest 中排除。`MEMORY.md` 保留为导航入口，运行时生成的治理摘要才是可信状态来源。

`findRelevantMemories()` 继续明确延期。首版不引入向量检索、模糊语义评分或自动读取正文。

### 4.4 删除

删除是可恢复归档：校验目标 revision 后将普通文件移动到 Memory 目录内的 `.trash/`，再原子重建索引。禁止删除 `MEMORY.md`、目录、链接或 Memory 根目录外对象。永久 purge 不在范围内。

### 4.5 Compaction 保真

新增确定性的 `CompactionInvariantSnapshot`，从会话中提取用户硬约束、当前任务、未完成项和关键工程状态的安全摘要，作为总结请求中的保真要求；压缩结果附带 snapshot digest 和保留计数。不得把原始内容写入 Trace。若保真校验失败，Full Compaction 不替换原消息。

## 5. Diagnostics 与证据

Post-R1 Matrix 增加 Context manifest、预算、Memory path isolation、revision conflict、expiry、recoverable delete 和 Compaction invariant。Diagnostics 展示来源类别/Token 合计、active/stale/legacy/invalid 数量和治理缺口；revision 冲突由 Tool 结果即时返回，不伪装成持久化目录状态。所有输出均不包含正文。

## 6. 非目标

- 不实现语义向量 Memory 检索或自动相关性承诺。
- 不实现 Provider 价格数据库或成本账单。
- 不自动判断任意自然语言 Memory 与源码语义是否冲突。
- 不永久清空 `.trash`，不自动修复 Memory 内容。
- 不修改 Permission 的 deny/ask 既有语义。

## 7. 验收

- Context 条目可解释来源、资格和预算且不含正文。
- 旧 Memory 可读，新 Memory 具有来源、revision 和时间。
- 路径穿越、绝对路径、symlink、过期依赖、并发覆盖和误删除均被确定性测试阻止。
- 删除可从 `.trash` 恢复，索引不保留已归档条目。
- Compaction 未保留关键约束时保持原消息并报告 degraded。
- `npm run verify:core` 和增量 Post-R1 证据通过。
