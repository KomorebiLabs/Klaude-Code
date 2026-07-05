# interview-coach

> A decision-tree-based Agent Harness interview coach. Asks deep questions (L1–L6), grades 4-dimensionally (Design / Runtime / Adversarial / Production), references JD.md for anchoring.

![version](https://img.shields.io/badge/version-0.3.0-blue)
![platforms](https://img.shields.io/badge/platforms-Cursor%20%7C%20Claude%20Code%20%7C%20Codex-lightgrey)
![license](https://img.shields.io/badge/license-MIT-green)

English | [中文](#中文摘要)

---

## Why

Most real Agent / LLM system engineering interviews probe only 30% of the dimensions that actually distinguish senior engineers. This coach surfaces the missing 70%:

- Most interviewers stop at **Design** (4-dim model: Design / Runtime / Adversarial / Production)
- Few probe **Runtime** stability — failure recovery, dead loops, context overflow, planner vs executor arbitration
- Few probe **Adversarial** robustness — prompt injection, fake tool data, hallucination, memory corruption, graceful degradation
- Few probe **Production** viability — 10× cost control, concurrent latency, multi-tenancy, data flywheel

`interview-coach` is a **拷问型 (interrogation-style) coach** that forces you to think, answer, and self-reflect across all 4 dimensions — not the easy one.

---

## How it works

The coach asks questions from a **decision tree** with **6 module roots (A–F)** and **7 layers per root (L0–L6)**. Each round, your answer is rated on a 5-tier rubric (未答 / 含糊 / 合理 / 很强 / 极强) and the tree branches accordingly. At module end you receive a 4-dimensional score and 7-layer standard answers with memory points.

```
                  ROOT
                   │
       ┌────┬────┬──┴──┬────┬────┐
       A    B    C     D    E    F   ← 6 module roots
       │    │    │     │    │    │
      L0   L0   L0    L0   L0   L0
      L1   L1   L1    L1   L1   L1
      L2   L2   L2    L2   L2   L2
      L3   L3   L3    L3   L3   L3
      L4   L4   L4    L4   L4   L4  ← Runtime layer
      L5   L5   L5    L5   L5   L5  ← Adversarial layer
      L6   L6   L6    L6   L6   L6  ← Production layer
```

**Module roots:**

| Root | Module Theme | English |
|------|--------------|---------|
| **A** | Agent Loop / Runtime | Execution loop, state machine, dead-loop detection |
| **B** | Tool System | Tool registration, sandbox, permissions, Function Calling |
| **C** | Memory System | Short/long-term memory, write, retrieve, evict |
| **D** | Planner / Reasoning | Task planning, re-plan, multi-step generation |
| **E** | Context / Prompt Engineering | Prompt orchestration, compression, KV cache |
| **F** | Evaluation / Harness | Offline eval, A/B, failure trace replay |

**Layer focus:**

| Layer | Focus | Maps to dim |
|-------|-------|-------------|
| **L0** | Trigger / start | — |
| **L1** | 认知 (Cognition) — essence, I/O, module boundaries | Design |
| **L2** | 设计 (Design) — tech-choice rationale + refactor hypothesis | Design |
| **L3** | 工程 (Engineering) — scaling + perf + testing + abstraction | Design |
| **L4** | **Runtime** ⭐ — state machines, failure recovery, dead loops | Runtime |
| **L5** | **Adversarial** ⭐ — prompt injection, fake data, hallucination | Adversarial |
| **L6** | **Production** ⭐ — 10× cost, concurrency, multi-tenancy | Production |

Modules not mapped to A–F (e.g., permissions, sandbox, ui) **fall back** to v0.2's 4-category rotation logic (A 认知 / B 设计 / C 工程 / D 评估) — see [`references/decision-tree.md`](references/decision-tree.md) §v0.2 fallback.

---

## Install

This skill ships as a folder. Drop it into your IDE's skills directory — no runtime dependencies, no installs.

### Cursor

Place `interview-coach/` in your user skills directory:

```bash
mkdir -p ~/.cursor/skills
cp -r interview-coach ~/.cursor/skills/
```

**Verify:** `ls ~/.cursor/skills/interview-coach/SKILL.md` should print the file path.

### Claude Code

Place `interview-coach/` in your Claude skills directory:

```bash
mkdir -p ~/.claude/skills
cp -r interview-coach ~/.claude/skills/interview-coach
```

**Verify:** `ls ~/.claude/skills/interview-coach/SKILL.md` should print the file path.

### Codex

Place `interview-coach/` in your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -r interview-coach ~/.codex/skills/interview-coach
```

**Verify:** `ls ~/.codex/skills/interview-coach/SKILL.md` should print the file path.

> **Tip:** Restart your IDE after copying the skill in so it re-scans the skills folder.

---

## Usage

All 10 commands (from [`SKILL.md`](SKILL.md)):

| Command | Description |
|---------|-------------|
| `/interview-coach start <module> [deep\|quick] [--anchor <file>]` | Start interrogation on a module. `[deep]` raises depth, `[quick]` shortens it; `--anchor` overrides JD lookup. |
| `/interview-coach resume` | Continue the last unfinished session. |
| `/interview-coach next` | End the current module and pick the next module by weight. |
| `/interview-coach pause` | Pause the current interrogation; resumption keeps context. |
| `/interview-coach progress` | Read session state — rounds completed, layers covered (L1–L6), running 4-dim scores, 打穿 history. |
| `/interview-coach hint [level=1\|2\|3]` | Request a hint. `level=3` triggers coaching mode (treated as "almost the answer"). |
| `/interview-coach explain` | Get the **standard answer for the current question only**, plus a standard-vs-yours diff. Returns to interrogation mode after. |
| `/interview-coach grade` | Force a full 4-dim score for the current answer. Writes to `progress.md`. |
| `/interview-coach roadmap` | Show pending modules and recommended order (derived view, no separate file). |
| `/interview-coach weak` | List your weakest modules based on historical grading (read-only). |

> **Note:** `/interview-coach answer` is **permanently disabled**. To get an answer, use `explain`, or write "我不会 / 我答不出" in your reply, or use `hint level=3`.

---

## JD Setup

The coach needs a JD.md (Job Description) file as the grading baseline. Without it the coach asks you for a path on first use.

The coach looks for JD files in this priority order (highest first):

1. `--anchor <file>` flag on the `start` command.
2. `Information/JD.md` in your project.
3. `Information/deepseek_Harness_JD.md` in your project (built-in template copy).
4. Built-in template at `references/templates/deepseek_Harness_JD.md` (ships with this skill).
5. Otherwise: the coach asks you for a path.

A **built-in JD template** ships with the skill at [`references/templates/deepseek_Harness_JD.md`](references/templates/deepseek_Harness_JD.md) (a DeepSeek-Harness-style baseline, adaptable to any team).

For the full priority list, file format, `补充项 ★` mechanism, and error handling, see [`references/jd-loading.md`](references/jd-loading.md).

---

## Module Map Setup

The coach needs a project-level `module-map.yaml` that tells it which decision-tree root (A–F) each project module maps to, plus weight, depth, and JD anchors.

**Where:** `Information/coach/module-map.yaml` in **your project** (not your skills install). This file is project-specific and does **not** ship with the skill.

**How to start:** Copy the template from this repo at `Information/coach/module-map-template.yaml` to your project, then edit it for your codebase. Each module entry needs:

- `name`, `label`, `paths` (which files define it)
- `weight` — `core` / `important` / `auxiliary`
- `tree_root` — `A` / `B` / `C` / `D` / `E` / `F`, or **leave empty** to fall back to v0.2 rotation
- `jd_anchors` — quote from `JD.md` (this is the canonical 引用锚点)
- `tags`, `default_depth` (core=5, important=3 by default)

See [`Information/coach/module-map-template.yaml`](Information/coach/module-map-template.yaml) for the full schema and the 6 easy-agent modules (`agentic_loop` → A, `tool_use` → B, `memory` → C, `planner` → D, `context_engineering` → E, `evaluation` → F) plus one unmapped fallback module (`permissions`).

> **Gitignore:** the runtime state lives next to it — `Information/coach/progress.md` and any `*.local.yaml` overrides. Add a `.gitignore` line for `Information/coach/progress.md` if you want it private; or use the template at `Information/coach/.gitignore-template`.

---

## Decision Tree Detail

The full 42-node tree (6 module roots A–F × 7 layers L0–L6 = 42 core question nodes) plus ~72 instance-level L4-L6 questions lives in [`references/decision-tree.md`](references/decision-tree.md). The skill consults this file every time it needs to know:

- which root (A–F) the active module maps to,
- what each layer (L0–L6) focuses on for that root,
- the 5-tier branching rules (未答 / 含糊 / 合理 / 很强 / 极强),
- the 打穿 mechanism (2 consecutive ≤ 含糊 rounds → module end),
- coverage / state schema, and
- L4–L6 coverage enforcement (≥2 of L4/L5/L6 required for non-penalized scores).

---

## Grading Detail

The 4-dim rubric (Design / Runtime / Adversarial / Production, 1–5 each, no weighted average) and the module-end output template (header / 4-dim score table / 总评 / 薄弱层定位 / JD 命中度 with ★ / Step ①②③ / 7-layer standard answers / next steps) are in [`references/grading-rubric.md`](references/grading-rubric.md).

Key rules:

- Each dim is fixed 1–5; no cross-dim averaging. Low scores mean **specific, named gaps** you can immediately act on.
- JD is the baseline: scores are anchored to JD.md **verbatim quotes**. Skill additions are marked `★` (补充项) and **do not** feed into baseline scores.
- L4–L6 coverage < 2 layers → "深度不足" (insufficient depth) penalty on the final grade for A–F mapped modules.

---

## Feedback Templates

The dialectical feedback templates — Step ① (4 sections: correct / insufficient / interesting / risk signal), Step ② (5 sections round summary, including v3 additions `你正在决策树哪一层 Lx` and `下一轮将问什么`), and a pointer to Step ③ (one-shot module-end output) — are in [`references/dialectical-template.md`](references/dialectical-template.md).

Strict order: Step ① → Step ② → next question. Step ③ fires only at module end.

---

## Repository Layout

```
interview-coach/
├── README.md                              ← you are here
├── SKILL.md                               ← entry point: frontmatter, hard rules, commands, workflow
└── references/
    ├── decision-tree.md                   ← 42-node tree + branching rules + instance questions
    ├── grading-rubric.md                  ← 4-dim rubric + module-end template
    ├── dialectical-template.md            ← Step ① ② ③ templates
    ├── jd-loading.md                      ← JD lookup priority + 补充项 ★ rules
    └── templates/
        └── deepseek_Harness_JD.md         ← built-in JD baseline (modifiable)
```

Project-level (placed in the project being coached, **not** the skill):

```
<your-project>/
└── Information/
    └── coach/
        ├── module-map.yaml                ← copy from module-map-template.yaml
        ├── progress.md                    ← appended by skill; gitignored
        └── .gitignore                     ← see .gitignore-template
```

---

## 中文摘要

**`interview-coach`** —— 基于决策树的 Agent Harness 面试教练。围绕 6 大模块根节点（A–F）× 7 层拷问（L0–L6）= **42 个核心拷问节点**，按"设计正确性 / 运行时稳定性 / 对抗鲁棒性 / 生产可行性" **4 维评分**。默认不直接给答案，例外由 `explain` / `hint level=3` / 用户明确求助触发。

**核心设计：**

- **问题源是决策树，不是清单** —— 每个模块根据你的回答质量（未答 / 含糊 / 合理 / 很强 / 极强）动态分叉。
- **打穿机制** —— 同一层连续 2 轮 ≤ 含糊，模块直接结束，避免漫无目的追问。
- **L4 / L5 / L6 强制覆盖** —— Runtime / Adversarial / Production 三大能力层至少触及 2 层，否则扣"深度不足"分。
- **JD 锚点 + 补充项 ★** —— 评分锚定项目级 `JD.md` 明文条款；skill 认为重要但 JD 未写的条款用 ★ 标注，不与基础条款混算。
- **模块末 Step ③** —— 给 7 层标准答案 + 4 维最终评分 + 薄弱层定位（直接告诉你下次该复习哪一层）。

**跨平台**：Cursor / Claude Code / Codex 三家 IDE 同名 skill，统一 `SKILL.md` 入口，无平台特化代码。

详见各 `references/*.md`。

---

## License

MIT — see `LICENSE` if present, or add a one-line `Copyright (c) <year> <your name>` above this section.

> Note for forks / re-publishes: this skill ships under MIT, but the JD baseline (`references/templates/deepseek_Harness_JD.md`) may reference team-specific terminology. Strip team-specific items before redistributing.
