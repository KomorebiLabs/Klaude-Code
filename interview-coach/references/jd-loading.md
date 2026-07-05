# JD File Lookup Logic — interview-coach v0.3

> This file defines the JD (Job Description) file lookup logic for interview-coach v0.3. The JD is the anchor for scoring — every 4-dim score must reference a JD clause.

---

## 1. Lookup Priority (4-Tier)

When `/interview-coach start` is invoked, the skill resolves the JD file in the following order:

| Priority | Source | Search Path | Behavior When Found | Behavior When Missing |
|----------|--------|-------------|-------------------|---------------------|
| **1** | User-specified anchor | `--anchor <file>` from the command line | Load that exact file as JD | Error: "Anchor file not found — check the path" |
| **2** | Project root | `<project>/Information/JD.md` | Load it silently | Proceed to Tier 3 |
| **3** | Built-in template | `<project>/Information/deepseek_Harness_JD.md` | Load it silently | Proceed to Tier 4 |
| **4** | Fallback | None — prompt user | N/A | Ask: "请指定 JD 文件路径（absolute or relative to project root）" |

**Implementation notes:**

- Tier 2 and Tier 3 are resolved relative to the project root (the directory containing `package.json` or equivalent).
- If Tier 1 (`--anchor`) resolves to a non-existent path, the skill must abort and show the error rather than falling through to Tier 2/3.
- Tier 4 is blocking — the skill cannot proceed without a JD file. The user must provide a valid path before the session continues.

---

## 2. JD File Format Specification

A valid JD file must conform to the following structure. The skill parses it at session start and caches the parsed sections in memory for the duration of the session.

### 2.1 Required Sections

#### `# 团队`

Identifies the team or organization whose JD this file represents.

```
# 团队
Example Co. — Backend Engineer Team
```

#### `# 岗位能力`

A flat list of capability requirements. Each entry becomes a baseline scoring anchor. The skill matches interview responses against these entries.

```
# 岗位能力
- 能够设计高并发、低延迟的分布式服务架构
- 熟练使用 LLM API，具备 Agent Loop 实战经验
- 熟悉 Tool Use / Function Calling / MCP 机制
- 具备离线评测体系设计能力
- 理解 KV Cache、Context Compression 等运行时优化
```

#### `# 权重`

Per-capability weight, integer 1–5. Higher weight means the capability has more influence on the final module score.

```
# 权重
- 能够设计高并发、低延迟的分布式服务架构: 5
- 熟练使用 LLM API，具备 Agent Loop 实战经验: 4
- 熟悉 Tool Use / Function Calling / MCP 机制: 4
- 具备离线评测体系设计能力: 3
- 理解 KV Cache、Context Compression 等运行时优化: 3
```

### 2.2 Optional Sections

#### `# 加分项`

Bonus criteria — scoring these earns extra credit but does not penalize if absent.

```
# 加分项
- 有开源社区深度贡献记录
- 主导过 10× 成本优化项目
```

#### `# 反模式`

Anti-patterns — patterns that, if present in the response, trigger automatic deduction.

```
# 反模式
- 在评测集设计上只做 happy path 测试
- 完全不考虑 tool 假数据或 prompt injection 风险
- 没有任何并发或超时处理的意识
```

#### `# 补充项` ★

Items that are **not** in the JD but are added by the skill because they are critical for the module. Marked with ★ in all output. These are displayed separately from the baseline score and do not affect the baseline total.

```
# 补充项
- 状态机设计与死循环检测意识 ★
- 多租户数据隔离策略 ★
```

### 2.3 Worked Example: Complete JD File

Below is a fictional but complete JD file conforming to the format specification.

```markdown
# 团队
Example Co. — Backend Engineer (Agent Harness)

# 岗位能力
- 能够设计高并发、低延迟的分布式服务架构
- 熟练使用 LLM API，具备 Agent Loop 实战经验
- 熟悉 Tool Use / Function Calling / MCP 机制
- 具备离线评测体系设计能力
- 理解 KV Cache、Context Compression 等运行时优化
- 对抗鲁棒性：能防御 prompt injection、设计降级方案
- 生产意识：能给出 10× 成本优化、延迟约束、多租户隔离

# 权重
- 能够设计高并发、低延迟的分布式服务架构: 5
- 熟练使用 LLM API，具备 Agent Loop 实战经验: 4
- 熟悉 Tool Use / Function Calling / MCP 机制: 4
- 具备离线评测体系设计能力: 3
- 理解 KV Cache、Context Compression 等运行时优化: 3
- 对抗鲁棒性：能防御 prompt injection、设计降级方案: 4
- 生产意识：能给出 10× 成本优化、延迟约束、多租户隔离: 4

# 加分项
- 有开源社区深度贡献记录
- 主导过 10× 成本优化项目
- 有 MCP 协议开发经验

# 反模式
- 在评测集设计上只做 happy path 测试
- 完全不考虑 tool 假数据或 prompt injection 风险
- 没有任何并发或超时处理的意识
- 将 context overflow 问题简单归因为"模型不够强"

# 补充项 ★
- 状态机设计与死循环检测意识 ★
- 多租户数据隔离策略 ★
```

---

## 3. Error Handling

### 3.1 Malformed JD (Missing Required Section)

If the JD file is loaded but one or more required sections are absent, the skill must abort with a clear error:

```
[interview-coach] JD 文件格式错误
文件: <resolved path>
缺失必需章节: # 权重

请补全后重新执行 /interview-coach start <module>
```

**Required sections that trigger this error if missing:** `# 团队`, `# 岗位能力`, `# 权重`.

### 3.2 Multiple JD Files Conflict

This occurs when the project contains both `Information/JD.md` and a user-specified `--anchor`, or when multiple `--anchor` files exist.

- **Explicit `--anchor` takes precedence.** If `--anchor <file>` is specified, that file is used exclusively — Tier 2 (`JD.md`) is ignored.
- **If no `--anchor` and multiple JD files exist in the project**, the skill uses `Information/JD.md` (Tier 2) and emits a one-time notice: `[interview-coach] 检测到多个 JD 文件，已使用 Information/JD.md。如需切换，请用 --anchor <file> 指定。`
- **If the user explicitly asks to switch JD mid-session**, see §4 (Mid-Session JD Swap).

### 3.3 Mid-Session JD Swap

The user may request a JD change mid-session via `/interview-coach start <module> --anchor <new-file>`. The behavior is:

1. Load the new JD file and validate its format (same rules as §3.1).
2. **Restart current module scoring.** The new JD applies retroactively to all open scores — any score already committed in `progress.md` for the current module is invalidated and must be re-evaluated against the new anchors.
3. Display a confirmation: `[interview-coach] JD 已切换为 <new-file>，当前模块评分已重置，请继续。`
4. If the new JD file is invalid or missing, abort the swap and keep the current JD active.

---

## 4. 补充项 ★ Mechanism

### 4.1 When to Add a ★ Item

The skill may add a capability item that is **not** present in the JD when both conditions are met:

1. The item is **critical** for evaluating the module's 4-dim score (Design / Runtime / Adversarial / Production).
2. The item **does not appear verbatim** in the JD's `# 岗位能力` section.

### 4.2 Display Rules

- Mark with **★** in all output (grading rubric, standard answer, progress notes).
- Display ★ items **separately** from the baseline score — they do not affect the total baseline score.
- In the 4-dim score table, include a separate "★ 补充项" column:

```
| 设计（Design, L1-L3）     | 4/5 | ...              | —                    |
| 运行时（Runtime, L4）    | 3/5 | ...              | 状态机检测意识 ★      |
| 对抗性（Adversarial, L5） | 2/5 | ...              | —                    |
| 生产（Production, L6）    | 1/5 | ...              | 多租户隔离策略 ★      |
```

### 4.3 If User Challenges a ★ Item

If the user disputes a ★ item, the skill must respond with:

1. **Show the original JD text** that the ★ item was derived from (or state clearly that it was not found in JD).
2. If the original JD text **cannot be produced**, the item is **downgraded** from a baseline scoring anchor to a pure ★ 补充项 (no baseline penalty applied — the item remains in the ★ column but is clearly labeled as "skill recommendation only").

### 4.4 Worked Example: ★ Item Respected

**Scenario:** User answers the Agent Loop module. The response shows no awareness of state machine design. The JD does not mention state machines explicitly.

**Skill action:**

- Add `状态机设计与死循环检测意识 ★` as a ★ 补充项.
- Do **not** penalize baseline Design score for this.
- Display in the ★ column.

**Output snippet:**

```
| 维度 | 分数 | 评语 | ★ 补充项 |
| 设计（Design） | 3/5 | 能讲清 Agent Loop 流程，但状态边界模糊 | 状态机检测意识 ★ |
```

### 4.5 Worked Example: ★ Item Challenged

**Scenario:** User challenges the `多租户数据隔离策略 ★` item, saying it is not in the JD.

**Skill response:**

> "这个 ★ 补充项的来源是：JD 中写有「生产意识：能给出 10× 成本优化、延迟约束、多租户隔离」，其中「多租户隔离」涵盖了我提出的数据隔离策略。如果你认为理解有偏差，请告诉我，我会在下次评分时更严格地对应 JD 原文。"
>
> OR, if the item truly cannot be traced to JD text:
>
> "你说得对，这一项「多租户数据隔离策略」在 JD 中没有明文依据。它是 skill 基于工程合理性提出的 ★ 补充项，不作为基础扣分依据。我将它降级为纯粹的建议项，不影响你的基准分。"

---

## 5. Mid-Session JD Loading

When the user triggers coaching mode mid-session (via `/interview-coach explain` or `/interview-coach hint`), the standard answer output **also uses the loaded JD file** as the evaluation criteria:

1. The skill has already loaded and cached the JD at session start (per §1).
2. When generating a standard answer for a module, the skill references the JD's `# 岗位能力` entries as the **expected answer criteria**.
3. The output format for standard answers in coaching mode follows the same 4-dim structure as module-end output (§5.3 of the spec), with ★ items marked accordingly.
4. If the JD was swapped mid-session (§3.3), coaching mode must use the **new** JD for all subsequent standard answers.

---

## 6. Cross-References

| Reference | Purpose |
|-----------|---------|
| `references/grading-rubric.md` | 4-dim scoring framework that uses JD clauses as anchors for each dimension |
| `references/templates/deepseek_Harness_JD.md` | Built-in JD template (ships with the skill) |
| `SKILL.md` | Documents the `--anchor <file>` flag in the `start` command |
| `Information/Plan/2026-07-05-interview-coach-skill-design.md` | Full spec — §5.2.1, §5.2.2, §5.2.3 |
