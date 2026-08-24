# PR-04 / R1-D Evaluation Foundation 实施计划

1. 建立 Evaluation DTO 与 deterministic grader，限制为 synthetic Task 和 allowlisted Result。
2. 建立 JSON/Markdown report renderer，二次脱敏所有可变字符串。
3. 建立独立 Artifact Store：`evaluations/<run-id>/result.json|report.md`，包含 root/run 路径校验、symlink 拒绝、age/quota Retention 和单 run 删除。
4. 建立首批四项 Invariant-to-Evidence Matrix，并实现 `test:evaluation` 聚焦检查。
5. 建立 `verify-core.ts` 与 `npm run verify:core`，先运行 Build/Trace runtime 证据，再生成本次 Evaluation Artifact。
6. 增加最小 GitHub Actions，仅执行 `npm ci` 与 `npm run verify:core`。
7. 更新 Dev Doc/README 状态，执行 Build、Core Gate、diff check 和 GitNexus change detection。

非目标：真实模型、多仓库 Benchmark、LLM-as-a-Judge、通用插件式 Grader、生产 Trace 行为重放。
