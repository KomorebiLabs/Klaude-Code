# Evaluation Foundation 规格（PR-04 / R1-D）

## Objective

为 Klaude-Code 建立可重复、无网络、隐私最小化的 Evaluation 基础：用窄 Task/Trial/Grader/Result 契约表达受控实验，以独立 Artifact Store 保存 JSON/Markdown 结果，并让 R1 不变量映射到可执行证据。

## Commands

- Core gate：`npm run verify:core`
- Evaluation 聚焦检查：`npm run test:evaluation`
- Build：`npm run build`

## Project Structure

- `src/evaluation/`：DTO、grader、report、artifact store、evidence matrix。
- `src/scripts/test-evaluation.ts`：存储、隐私、retention、报告的确定性检查。
- `src/scripts/verify-core.ts`：运行合成 fixture grader 并落盘本次报告。
- `docs/evaluation/`：Invariant-to-Evidence Matrix。
- `.github/workflows/`：调用同一 `verify:core` 命令的最小 CI。

## Contract and Style

Evaluation Result 只由 allowlisted 字段构造，不接受任意对象透传：

```ts
const result: EvaluationResult = {
  schemaVersion: 1,
  runId,
  trial,
  outcome: assertions.every((item) => item.passed) ? "passed" : "failed",
  assertions,
  durationMs,
};
```

Task 必须标记 `synthetic: true`；Core grader 不访问网络，不读取真实 Session Transcript，不保存 Prompt、模型正文、文件正文、完整 Tool I/O 或环境值。

## Testing Strategy

- 真实 runtime 不变量继续由 `test:trace` 的 Fake Stream/Fake Tool 证明。
- Evaluation 聚焦测试证明 DTO allowlist、Secret 脱敏、JSON/Markdown 一致、age/quota Retention、手动删除和 symlink root 拒绝。
- `verify:core` 顺序运行 Build、Trace runtime 证据和 Evaluation runner，任一步失败即非零退出。

## Boundaries

- Always：逐 Trial 报告；失败定位到 invariant/stage；Artifact Store 与 Trace Store 分离。
- Ask first：保存完整受控输入、引入真实 Provider、修改 CI 范围。
- Never：真实网络/付费模型进入 Core CI；生产 Trace 被描述为模型行为重放；任意目录递归删除；原始用户内容进入 Artifact。

## Success Criteria

1. Task/Trial/Grader/Result 契约可编译且只包含 allowlist 字段。
2. 四个首批不变量都映射到确定性命令和证据文件。
3. 一条命令生成 JSON 与 Markdown，并能定位失败 stage/assertion。
4. Store 支持安全写入、age/quota Retention、单 run 删除和 symlink 防护。
5. 本地与 CI 使用完全相同的 `npm run verify:core`，不访问网络。

## Open Questions

真实模型 Trial、完整 fixture 输入声明、跨仓库 Benchmark 和 LLM Grader 延后到 E6-C，不属于本规格。
