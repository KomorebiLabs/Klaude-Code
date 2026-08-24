# PR-09 / R1-I Evidence Closure JIT 实施计划

## Slice 1：门禁与机器可读矩阵

- 扩充 `R1_CORE_EVIDENCE_MATRIX`，使其覆盖 PR-01～PR-08 的全部 R1 声明。
- 将 `test:mcp` 纳入 `verify:core`；修正文档中无法由当前跨平台门禁兑现的 Sandbox 命令描述。

## Slice 2：受控端到端 Trial

- 新增 `src/scripts/verify-r1-release.ts`。
- 用 Fake Provider 驱动真实 `query()` 完成一次 Model→Permission→Tool→Model 闭环。
- 生成独立 Evaluation JSON/Markdown，记录单 Trial 限制，不记录业务正文。

## Slice 3：Resume Release 材料

- 完成最终 Claim-to-Evidence Matrix、R1 发布报告、架构图、Bad Case 闭环、演示脚本和简历事实素材。
- 更新 README 与文档入口状态，明确 inherited foundation 与 Klaude-Code Enterprise Harness 的贡献边界。
- 编写 PR-09 Dev Doc 和下一阶段交接，只将 R2 候选交还用户选择。

## 验证

1. `npm run verify:core`
2. `git diff --check`
3. GitNexus `detect-changes --base-ref main`；若索引不兼容，则保留失败并用 Git diff/源码调用点复核。
