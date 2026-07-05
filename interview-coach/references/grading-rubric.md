# Interview Coach — 4-Dimensional Grading Rubric (v0.3)

> **Spec source**: `Information/Plan/2026-07-05-interview-coach-skill-design.md` §5
> **Version**: 0.3.0
> **Cross-references**:
> - `decision-tree.md` — defines the L1–L6 layers that feed into each dimension
> - `dialectical-template.md` — uses these dimensions in Step ① feedback
> - `jd-loading.md` — for the JD priority rules and anchor file lookup

---

## 0. Document Header

This file defines the 4-dimensional scoring rubric for `interview-coach` v0.3. The 4 dimensions (**Design / Runtime / Adversarial / Production**) align 1:1 with the decision tree's L1–L6 layers:

- **L1 + L2 + L3** → **Design（设计）**
- **L4** → **Runtime（运行时）**
- **L5** → **Adversarial（对抗性）**
- **L6** → **Production（生产）**

The rubric governs all module-end scoring outputs and the per-round Step ① dialectical feedback. Every score must be anchored to an explicit `JD.md` clause or a marked `★ 补充项` (skill-supplied supplement); no floating deductions are permitted.

---

## 1. 4-Dimension Overview Table

Verbatim from spec §5.1:

| 维度（v0.3 命名） | v0.2 旧命名 | 对应决策树层 | 对应 draft 中的面试测试维度 | 5 分定义 | 1 分定义 |
|------|------|--------------|----------------------------|----------|----------|
| **设计（Design）** | 理解深度 + 设计权衡 + 扩展能力（合并） | L1 + L2 + L3 | Design correctness | 用一句话讲清本质；能重构核心抽象；讲清输入输出边界 + 选型理由 + 工程取舍 | 只能复述函数名 / 文件名 |
| **运行时（Runtime）** | 评估能力中运行时部分 | L4 | Runtime stability | 能给出状态机、失败恢复决策表、死循环检测方案、context 溢出策略 | 完全没想过运行时会发生什么 |
| **对抗性（Adversarial）** | 评估能力中对抗性部分（v0.2 没有） | L5 | Adversarial robustness | 能防御 prompt injection、识别 tool 假数据、纠正 hallucination、清理 memory 污染、设计降级方案 | 完全没考虑过攻击场景 |
| **生产（Production）** | 评估能力中生产部分（v0.2 没有） | L6 | Production viability | 能给出 10× 成本优化、延迟约束、并发调度、多租户隔离、数据飞轮方案 | 完全没思考过上线 |

---

## 2. Detailed Rubric Per Dimension

Each dimension has:
- **5-Point Descriptor** — verbatim from spec §5.1; full credit threshold
- **3-Point Descriptor (typical)** — what a typical but shallow answer looks like
- **1-Point Descriptor (reverse signal)** — verbatim from spec §5.1; a signal that the user has not engaged this dimension at all
- **Decision-Tree Link** — which layers feed into this dimension
- **Worked Example: Good Answer** (2–3 sentences)
- **Worked Example: Bad Answer** (2–3 sentences)

---

### 1. 设计（Design） — L1, L2, L3

#### 5-Point Descriptor

用一句话讲清本质；能重构核心抽象；讲清输入输出边界 + 选型理由 + 工程取舍。

**Pass criteria**: The user's answer covers all three of: (1) what the system fundamentally is in one sentence, (2) the precise input/output boundary including error conditions, and (3) why this design choice was made over alternatives with at least one concrete trade-off named.

#### 3-Point Descriptor (typical)

The user gives a conceptually correct answer about what the component does but stays at the "what is it?" level — missing the "why this shape?" and "what are the hidden constraints?" dimensions that a hiring target must demonstrate.

> **Example of a 3-point Design answer**: "Agent Loop 就是不断循环地让 LLM 思考并调用工具，直到任务完成。" — 这句话对，但完全缺少状态机建模、终止条件、死循环防护和上下文截断策略。

#### 1-Point Descriptor (reverse signal)

只能复述函数名 / 文件名。

**Reverse-signal interpretation**: The user cannot describe the component's purpose in their own words; they either read a filename and stopped, or described only surface-level implementation details (e.g., "it uses a for loop") without explaining the design rationale.

#### Decision-Tree Link

L1（认知 — 你理解这个模块是做什么的吗？）+ L2（设计 — 你能设计出更好的方案吗？）+ L3（工程 — 你能把方案工程化落地吗？）共同构成设计维度。

- L1 → the user identifies the component's core abstraction
- L2 → the user articulates why the abstraction is shaped this way vs. alternatives
- L3 → the user maps the abstraction to concrete interfaces, error types, and extension points

#### Worked Example: Good Answer

> **Module: Agent Loop | Question (L2): 你的状态机为什么用 6 个状态而不是 4 个？**
>
> "我选 6 个状态（Pending / Running / WaitingForTool / ToolExecuting / Completed / Failed）是因为有一个独立的 `WaitingForTool` 状态，用来区分'LLM 在思考'和'工具正在执行'。如果只有 4 个状态，工具执行期间 LLM 的调用栈会与推理栈混在一起，`max_turns` 的计数语义就模糊了——你不知道它限制的是推理轮次还是工具执行轮次。用 6 个状态，每个状态的进入/退出语义单一，`max_turns` 精确限制推理次数，工具执行有独立的超时控制。"

#### Worked Example: Bad Answer

> **Module: Agent Loop | Question (L2): 你的状态机为什么用 6 个状态而不是 4 个？**
>
> "因为我参考了 LangGraph 的设计，他们也是 6 个状态。" — 只复述了外部来源，没有解释这 6 个状态的各自语义、为什么这个数量是必要的，也没有说明如果只有 4 个状态会出什么问题。设计权衡的"取舍"那一面完全缺失。

---

### 2. 运行时（Runtime） — L4

#### 5-Point Descriptor

能给出状态机、失败恢复决策表、死循环检测方案、context 溢出策略。

**Pass criteria**: The user specifies (1) the complete state machine including all terminal and error states, (2) a decision table for recovery paths on each failure mode, (3) an explicit mechanism for detecting infinite loops with bounded execution, and (4) a context overflow strategy (e.g., summarization, eviction, or hard truncation) with the trade-off rationale.

#### 3-Point Descriptor (typical)

The user acknowledges that runtime can fail but describes only one or two failure modes without a systematic treatment. They might say "it could hang" without specifying the detection logic, or mention "context is limited" without explaining the eviction policy.

> **Example of a 3-point Runtime answer**: "运行时如果 context 太长就截断。" — 缺少截断策略的具体实现（按 token count？按 message 数量？保留系统 prompt 优先？）、截断后如何保证关键信息不丢失、以及截断和工具调用历史之间的交互。

#### 1-Point Descriptor (reverse signal)

完全没想过运行时会发生什么。

**Reverse-signal interpretation**: The user's entire answer focuses on the "happy path" — the code compiles, the function returns, the loop terminates — with zero engagement with what happens when things go wrong. No mention of errors, timeouts, exceptions, or resource constraints.

#### Decision-Tree Link

L4（Runtime — 当系统跑起来之后会发生什么？）是运行时维度的唯一来源。

- L4 probes: state machine completeness, failure recovery, infinite loop detection, context overflow, concurrent access, partial output handling

#### Worked Example: Good Answer

> **Module: Agent Loop | Question (L4): 如果 LLM 返回了一个完全无效的 tool_call 格式（比如缺少 required 参数），你的 Loop 会怎么处理？**
>
> "我会用 try/catch 包裹工具调用层。如果参数校验失败，先记录一个内部 `ParseError` 事件，然后触发一个 `RETRY` 状态转换——LLM 会收到一条补充消息告诉它上一轮参数缺失，让它重新生成。最多重试 2 次；如果 2 次都失败，进入 `Failed` 状态并返回结构化的错误对象。同时我维护一个 `error_history` 列表，记录每次失败的原因和上下文，供后续的 eval harness 回放。"

#### Worked Example: Bad Answer

> **Module: Agent Loop | Question (L4): 如果 LLM 返回了一个完全无效的 tool_call 格式，你的 Loop 会怎么处理？**
>
> "应该不会发生这种情况吧，LLM 的输出应该是正常的。" — 完全没有考虑运行时失败的可能。对"输入校验"、"防御性编程"、"优雅降级"没有任何概念，是典型的"happy path only"思维。

---

### 3. 对抗性（Adversarial） — L5

#### 5-Point Descriptor

能防御 prompt injection、识别 tool 假数据、纠正 hallucination、清理 memory 污染、设计降级方案。

**Pass criteria**: The user names at least four distinct adversarial threat classes relevant to the module (e.g., prompt injection, tool-return poisoning, memory poisoning, hallucination, jailbreak via system prompt) and specifies concrete mitigations for each. Mitigations must include detection logic, not just aspiration statements.

#### 3-Point Descriptor (typical)

The user recognizes that adversarial inputs exist but names only one threat class and proposes a mitigation that is vague (e.g., "we validate the input") without specifying what validation means, what happens on failure, or how to recover.

> **Example of a 3-point Adversarial answer**: "工具返回的数据我都会检查一下。" — 缺少：检查什么字段？什么阈值算异常？异常后是跳过这条数据、警告用户、还是拒绝整个结果？是否需要回退到"无工具"模式？

#### 1-Point Descriptor (reverse signal)

完全没考虑过攻击场景。

**Reverse-signal interpretation**: The user treats all tool outputs and user inputs as trusted. No mention of sanitization, validation, rate limiting, jailbreak risk, or data poisoning. This is the clearest signal that the candidate is building for a demo environment rather than production.

#### Decision-Tree Link

L5（Adversarial — 当有人故意破坏你的系统时会怎样？）是对抗性维度的唯一来源。

- L5 probes: prompt injection defense, tool-return data poisoning, memory/history poisoning, hallucination detection and correction, graceful degradation under adversarial inputs, sandbox escape risk

#### Worked Example: Good Answer

> **Module: Tool System | Question (L5): 用户在一个 prompt 里注入了一段恶意指令，试图让 Agent 执行未经授权的操作，你的 Tool System 如何防御？**
>
> "我分三层防御。第一层是输入层：所有用户 prompt 在传给 LLM 之前，先过一遍正则规则，把已知的 injection 模式（如'忽略之前的指令'、'你现在是 DAN'）标记为 `SUSPICIOUS` 并记录日志，但不直接拒绝——因为可能有误判。第二层是工具权限层：每个工具声明自己需要哪些 permission scope，Agent 的每次工具调用必须通过权限校验，权限不足直接拒绝并返回错误码。第三层是输出层：工具返回的结果里有 JSON 或代码时，先在隔离沙箱里做格式校验，格式异常的工具返回不参与下一步推理，直接标为 `UNTRUSTED` 并通知用户。我还会定期用红队数据重新跑 eval，确保新增工具不会被绕过。"

#### Worked Example: Bad Answer

> **Module: Tool System | Question (L5): 用户在一个 prompt 里注入了一段恶意指令，试图让 Agent 执行未经授权的操作，你的 Tool System 如何防御？**
>
> "我相信用户不会这么做。我们的用户都是好人。" — 完全没有对抗性思维。把系统的安全性完全建立在"用户可信"的前提上，这是最基础的安全设计缺陷。

---

### 4. 生产（Production） — L6

#### 5-Point Descriptor

能给出 10× 成本优化、延迟约束、并发调度、多租户隔离、数据飞轮方案。

**Pass criteria**: The user addresses at least three of: (1) cost estimation and optimization path (e.g., token cost reduction, caching, batch inference), (2) latency constraints with concrete SLA numbers and mitigation strategies, (3) concurrency model (how many simultaneous agents/sessions), (4) multi-tenancy isolation guarantees, and (5) a data flywheel (how production failure signals feed back into eval/training). All claims are quantitative or structurally specific, not aspirational.

#### 3-Point Descriptor (typical)

The user gestures toward production concerns in the abstract — "we should monitor it" or "it needs to be fast" — but provides no numbers, no architecture, and no trade-off analysis. They may mention one production concern (e.g., latency) without connecting it to the other dimensions (cost, concurrency, isolation).

> **Example of a 3-point Production answer**: "部署的时候要注意性能。" — 没有给出 latency budget、没有说明如何测量性能、没有区分 P50/P99、没有提到降级策略或容灾。

#### 1-Point Descriptor (reverse signal)

完全没思考过上线。

**Reverse-signal interpretation**: The user has not thought about the system beyond a working prototype. No mention of deployment, cost, latency, monitoring, scaling, multi-user scenarios, or how to know if the system is healthy in production. This signals the candidate is a "build and ship" engineer, not a "build and operate" engineer.

#### Decision-Tree Link

L6（Production — 当系统上线到生产环境后会遇到什么问题？）是生产维度的唯一来源。

- L6 probes: cost optimization, latency/SLA, concurrency/scaling, multi-tenancy, observability/monitoring, data flywheel, incident response, rollback strategy

#### Worked Example: Good Answer

> **Module: Context Engineering | Question (L6): 你的 KV Cache 方案在大规模并发场景下（比如 1000 个并发用户）会出现什么问题？你怎么设计来避免？**
>
> "1000 并发下最大的问题是 KV Cache 的内存爆炸：每个用户的 context 不同，共享 cache 命中率会大幅下降。我的设计是两层缓存：第一层是 session 级的 LRU cache（按 user_id 路由），命中了直接返回，避免每次都重新计算；第二层是跨 session 的 semantic cache，用 embedding 相似度做路由，适合 prompt 重复率高的场景（比如客服类任务）。对于 memory 系统，我设计了一个 `TieredMemoryManager`：热数据放在内存的 KV Cache，温数据落在 Redis，冷数据落在 S3，TTL 分别设为 1h/24h/30d。多租户隔离上，每个 tenant 的 cache key 带上 `tenant_id` 前缀，Redis cluster 按 tenant 做 slot 隔离，避免 noisy neighbor 问题。成本上，我的目标是把 P50 latency 从 800ms 压到 80ms（通过 semantic cache 命中），token 成本降低 60%（通过 prompt compression）。"

#### Worked Example: Bad Answer

> **Module: Context Engineering | Question (L6): 你的 KV Cache 方案在大规模并发场景下会出现什么问题？**
>
> "应该还好吧，先上线看看效果。" — 完全没有生产环境思维。没有想过并发问题、没有 latency budget、没有成本估算、没有多租户隔离。上线后如果出问题，也没有监控和回滚方案。

---

## 3. JD Anchor Usage Rules

From spec §5.2.2.

### 3.1 基线引用规则（Baseline Citation Rule）

> **When scoring, you MUST quote `JD.md` verbatim — not paraphrase.**

Every dimension score that references a JD clause must include a direct quote from `JD.md` in the scoring output. Example:

```
Design (4/5): 
- [JD clause] "独立分析能力：能从 0 到 1 推动研究" → covered ✓
- [JD clause] "品味：模型行为有品味有判断力" → partially covered (borderline)
```

If the user challenges a scoring item, you must be able to paste the exact JD.md text as evidence. If you cannot, the item must be downgraded to a **补充项 ★** (see below).

### 3.2 补充项 ★ 机制（Skill Supplement Mechanism）

When a skill-relevant engineering concern is important but **not explicitly written in `JD.md`**, the coach may add it as a **补充项 ★**. Rules:

1. **Mark with ★**: Prefix the item with `★ 补充项` in the output.
2. **Separate from baseline**: 补充项 scores are shown separately from baseline JD scores. They do not affect the 5/5 baseline calculation.
3. **Framed as a recommendation, not a penalty**: `★ 补充项` is advisory — the coach suggests the user pay attention to it, but it does not count against the user in the baseline score.
4. **Must have a rationale**: Every ★ item needs a one-sentence explanation of why the skill considers it important for this module.

**Worked Example of ★ mechanism**:

> **Module: Memory System | 用户回答了 L5 对抗性问题，但没有提到 memory poisoning 防御。JD.md 中"长期记忆"条款未提及安全风险。**
>
> **评分输出（relevant excerpt）**:
>
> ```
> Adversarial (3/5):
> - [JD] "长期记忆：支持多轮对话的上下文保持" → ✓ 覆盖了核心功能
> - [JD] 无对抗性相关条款
> ★ 补充项：建议关注 memory poisoning 攻击——恶意工具可能向 memory store 注入虚假记忆，后续推理基于被污染的数据。推荐在 memory write pipeline 中加入来源校验（tool_id 白名单）和内容语义相似度检测。
> ```

### 3.3 不解读、不创造边界（No Interpretation, No Creation Boundary）

> **When the user challenges a JD item, you must show the original text. If you cannot, downgrade to 补充项 — no baseline penalty applies.**

**Worked Example of the boundary**:

> **User challenges**: "JD 里说'上下文管理'很重要，但我认为 session 级管理就够了，不需要长期记忆，你怎么看？"
>
> **Coach response**:
>
> ```
> JD.md §3.2 原文：
> "长期记忆：支持多轮会话的上下文保持，具备跨 session 的知识积累能力。
>  期望候选人能够设计可扩展的记忆存储与检索方案。"
>
> 我没有引用超出这段文字的内容。你的观点"session 级管理足够"是一个工程判断，
> 不违反 JD 条款本身——但 JD 明确要求"跨 session"能力，这需要你说明你的
> session 管理方案如何实现跨 session 的知识复用，而不是仅仅说"不够用再加"。
>
> → 这项评分：JD 条款 ✓ 覆盖（"跨 session"要求），但你的论证不充分 → 3/5（Design）
> → 注意：这不是 JD 没有的要求，而是你没有充分回应 JD 已有的要求。
> ```

---

## 4. Module-End Output Template

From spec §5.3. This is the full output template that the coach emits once at module end (triggered by reaching `default_depth`, 打穿, or user `pause`).

```markdown
## 模块：<模块名>（决策树根节点：<A–F>）
日期：YYYY-MM-DD
总轮数：N（达到 default_depth 上限 / 决策树打穿 / 用户暂停）
7 层覆盖：L1✅ L2✅ L3✅ L4✅ L5✅ L6⚠️（未触发 — 下次 deep 时补）
---

### ① 4 维评分（v3：对齐 draft 中的真实面试测试维度）

| 维度 | 分数 | 评语（1–2 句） |
|------|------|----------------|
| 设计（Design, L1–L3） | 4/5 | ... |
| 运行时（Runtime, L4） | 3/5 | ... |
| 对抗性（Adversarial, L5） | 2/5 | ... |
| 生产（Production, L6） | 1/5 | ... |

**总评**：...
**薄弱层定位**：例如"对抗性 1/5 是当前最关键短板，对应决策树 L5 未达打穿条件"
**JD 命中度**：
- ✅ [JD clause text] — 覆盖
- ⚠️ [JD clause text] — 部分覆盖（理由：...）
- ❌ [JD clause text] — 未覆盖
- ★ 补充项：[skill-supplied item] — 不计入 baseline

---

### ② 本模块"用户回答回顾"

- 你在本模块给出的 3 个最有价值的观点：
  1. ...
  2. ...
  3. ...
- 你在本模块出现的 2 个思维盲区：
  1. ...
  2. ...
- 决策树"打穿"事件记录：<是否打穿 / 在哪层 / 几次含糊后>

---

### ③ 7 层标准答案 + 重点记忆卡（v3：替代 v0.2 的"4 类标准答案"）

对**实际覆盖到的每一层**（不是全部 6 层），分别给出：

**L1 认知** — 标准答案：... / 记忆点：...
**L2 设计** — 标准答案：... / 记忆点：...
**L3 工程** — 标准答案：... / 记忆点：...
**L4 Runtime** — 标准答案：... / 记忆点：...
**L5 Adversarial** — 标准答案：... / 记忆点：...
**L6 Production** — 标准答案：... / 记忆点：...

（未覆盖到的层标注"未触发 — 下次复习时主动 /interview-coach start <模块> [deep]"。）

---

### ④ 下一步建议

<下一个该拷问的模块 + 1 句话理由，或薄弱层 Lx 的复习路径>

---

**v3 输出与 v0.2 输出差异**（教练内部参考）：
- 评分维度对齐 draft 4 个面试测试维度（v0.2 是"理解深度/设计权衡/扩展能力/评估能力"这种 Agent Hobbyist 视角）。
- 标准答案按**决策树的层**而非"问题类"——便于用户对照自己答到的层，复盘薄弱层。
- "薄弱层定位"指向具体决策树层号（L4–L6 之一），让复习路径可机械执行（`/interview-coach start <模块> [deep]` 即可）。

---

## 5. Scoring Decision Rules

### 5.1 Score Calculation

- **No weighted average**: The 4 dimensions are reported independently; no single aggregate score is computed.
- **Depth penalty**: If a module mapped to A–F ends with coverage of fewer than 2 of {L4, L5, L6}, the Runtime / Adversarial / Production dimensions receive an automatic annotation: `"深度不足 — L4/L5/L6 覆盖不足，参考价值有限"` alongside the score.
- **1-point signal is not failure**: A 1/5 in any dimension is framed as a **starting point**, not a failure. The coach must provide a concrete, actionable improvement path alongside every 1-point score.

### 5.2 JD Clause Coverage Rules

| Coverage status | Display | Effect on score |
|-----------------|---------|----------------|
| JD clause directly addressed | ✅ 覆盖 | Positive signal; cite verbatim |
| JD clause partially addressed | ⚠️ 部分覆盖 | Neutral-to-slightly-negative; explain gap |
| JD clause not addressed | ❌ 未覆盖 | Negative signal; note as improvement target |
| Not in JD but skill-relevant | ★ 补充项 | Advisory only; no baseline penalty |

---

## 6. Cross-References

| File | Purpose |
|------|---------|
| `decision-tree.md` | Defines the L1–L6 layers that feed into each of the 4 dimensions. The coverage map (`Map<root, Set<layers>>`) determines which dimension sections are relevant for a given module. |
| `dialectical-template.md` | Defines Step ① (dialectical feedback) and Step ② (round summary) templates that reference these 4 dimensions per round. Step ③ = this file's module-end template. |
| `jd-loading.md` | Defines how `JD.md` is located at startup, the priority rules (`--anchor` > `Information/JD.md` > `Information/deepseek_Harness_JD.md`), and how clause text is matched to scoring dimensions. |
| `SKILL.md` | Entry point that defines the 4-dim grading as a hard rule: "只评 4 维（Design / Runtime / Adversarial / Production）—— 不评其他维度。" |
