# Interview Coach — Decision Tree (v0.3)

> **Spec source**: `Information/Plan/2026-07-05-interview-coach-skill-design.md` §4
> **Upstream template**: `Information/Plan/Decision_Tree.md`
> **Version**: 0.3.0

---

## 0. Document Header

This file is the question source for `interview-coach` v0.3. The question source is a **decision tree**, not a list. The tree has **6 root nodes (A–F)**, each with **7 layers (L0–L6)**. Each round, the coach evaluates the user's response against a 5-tier rubric and branches accordingly. The coach defaults to silence; it asks, the user answers, the coach evaluates and drills. The goal is to drill through the user's design boundary until the tree "打穿" (breaks through).

---

## 1. The 6 Root Nodes

| 根节点 | 模块主题 | JD 命中（典型） | module-map.yaml 里的对应 |
|--------|----------|------------------|--------------------------|
| **A. Agent Loop / Runtime** | 执行循环、状态机、死循环检测 | "从 0 到 1 设计 Agent 框架" | `tree_root: A`（如 `agentic_loop`） |
| **B. Tool System** | Tool 注册、沙箱、权限、Function Calling | "Tool Use / Function Calling"、"Skills / MCP" | `tree_root: B`（如 `tool_use`） |
| **C. Memory System** | 短期/长期记忆、写入、检索、清理 | "长期记忆" | `tree_root: C`（如 `memory`） |
| **D. Planner / Reasoning** | 任务规划、Re-plan、多步生成 | "Planning"、"Reasoning" | `tree_root: D`（如 `planner`） |
| **E. Context / Prompt Engineering** | Prompt 编排、压缩、KV Cache | "Context Engineering"、"上下文管理" | `tree_root: E`（如 `context_engineering`） |
| **F. Evaluation / Harness** | 离线评测、A/B、失败信号回放 | "评测体系"、"数据飞轮" | `tree_root: F`（如 `evaluation`） |

---

## 2. 5-Tier Branching Rules

After each user answer, the coach evaluates it against this rubric and decides the next branch:

| 用户回答档位 | skill 行为 | 决策树动作 |
|--------------|------------|-----------|
| **未答**（沉默 / "我不知道"） | 触发辅导模式，下一轮在同层（**Lx**）重问 | 留在 Lx |
| **含糊**（答得浅、有遗漏） | 在 **Lx 同层**追问 input/output 或 edge case | 留在 Lx，不升级 |
| **合理**（基本对但不够深） | **升级**到下一层 Lx+1 | Lx → Lx+1 |
| **很强**（有洞察且完整） | **升级**到 Lx+1 **+** 同层横向"跨层打击"问题 | Lx → Lx+1 + Lx（换角度） |
| **极强**（直接指出了隐藏权衡） | **模态切换** | 跳出框架问："你现在重写，最大风险点是什么？" |

### 打穿机制

用户在任意一层**连续 2 轮**回答档位 ≤ "含糊"（包括未答）→ 决策树在该模块"打穿" → 触发模块结束 → 输出 Step ③（标准答案 + 4维评分）。

### 5-Tier Rubric Definitions

| 档位 | 中文名 | 含义 |
|------|--------|------|
| 1 | 未答 | 用户沉默、说"不知道"、或完全跑题 |
| 2 | 含糊 | 答了但停留在浅层（"是什么"层面），缺少输入/输出边界或 edge case |
| 3 | 合理 | 基本覆盖了核心要素，但深度不足（缺少 trade-off 或隐藏权衡） |
| 4 | 很强 | 有洞察，指出了一个非显而易见的权衡，且覆盖了边界情况 |
| 5 | 极强 | 直接点出当前设计的根本性局限，或提出了替代方案的核心矛盾 |

---

## 3. Unified Node Format

Each node in the tree follows this naming convention: **`<root>.<layer>`** (e.g. `A.L4`, `C.L2`).

- **Root**: One of A, B, C, D, E, F — corresponds to the 6 root nodes above.
- **Layer**: L0 through L6.

### Layer Definitions

| 层 | 中文名 | 焦点 | 对应评分维度 |
|----|--------|------|-------------|
| **L0** | 触发 | 用户在回答中提到这个模块 / 用户主动 `/interview-coach start <module>` | — |
| **L1** | 认知 | 本质 + 输入输出 + 与相邻模块的边界 | Design (L1–L3) |
| **L2** | 设计 | 技术选型理由 + 重构假设 + 抽象层次 | Design (L1–L3) |
| **L3** | 工程 | 扩展性 + 性能 + 测试 + 抽象 + 跨平台 | Design (L1–L3) |
| **L4** | 运行时 | 状态机、失败恢复、死循环、上下文溢出 | Runtime |
| **L5** | 对抗性 | prompt injection、tool 假数据、hallucination、memory 污染、降级 | Adversarial |
| **L6** | 生产 | 成本、并发延迟、多租户、数据飞轮 | Production |

### Node Template

For each `<root>.<layer>` node, the entry format is:

```
### <root>.<layer>: <Focus Name>
- **Trigger input**: <what the user just said, or the module start command>
- **Question goal**: <what we are testing at this layer>
- **5/5 criteria**: <1–3 key things a full answer covers>
- **Failure signal**: <what indicates the user is stuck or still at a shallower layer>
```

For **L4, L5, L6**, each node additionally includes **instance questions** — concrete, root-specific questions that the coach can select from. At least 3 per root per layer (≥18 total).

---

## 4. The 42 Nodes

---

### A. Agent Loop / Runtime

#### A.L0: Trigger

- **Trigger input**: User mentions `agentic_loop`, `agent`, `runtime`, `执行循环` in their answer, or runs `/interview-coach start agentic_loop`.
- **Question goal**: Match the module to root A of the decision tree.
- **5/5 criteria**: User correctly identifies that the agent loop is the module being discussed; names at least one file or class in the loop.
- **Failure signal**: User describes a feature (e.g. tool use or memory) as "the agent loop" — no file references to loop-related code.

#### A.L1: Cognitive

- **Trigger input**: User has just been asked about the agent loop, or has mentioned it.
- **Question goal**: Verify the user can articulate the loop's essence: what enters, what transforms, what exits, and where it terminates.
- **5/5 criteria**: (1) Names the core loop function/class. (2) Describes the input (user query + context) and output (tool calls / final response). (3) States the loop termination condition explicitly.
- **Failure signal**: User describes the loop as "the LLM calls tools" without naming termination, state transitions, or input/output boundaries.

#### A.L2: Design

- **Trigger input**: User has described what the agent loop does (L1).
- **Question goal**: Test whether the user chose this design deliberately — why a loop, not a DAG; why not LangChain; why planner/executor separation.
- **5/5 criteria**: (1) Articulates at least one trade-off of the loop architecture. (2) Explains why this design beats at least one alternative (DAG, chain, single-step). (3) Names a concrete scenario where the chosen design wins.
- **Failure signal**: User says "that's how we did it" or "it was already there" — no rationale for the design choice.

#### A.L3: Engineering

- **Trigger input**: User has defended the loop design (L2).
- **Question goal**: Test extensibility, testability, and error handling at the engineering level.
- **5/5 criteria**: (1) Describes how to add a new tool without modifying the loop core. (2) Describes how to write a unit test for the loop termination condition. (3) Names the concurrency model (single-threaded event loop, thread pool, async/await, etc.).
- **Failure signal**: User says "just add it to the registry" without explaining the extension point; or describes no testing strategy.

#### A.L4: Runtime

- **Trigger input**: User has described the loop's engineering structure (L3).
- **Question goal**: Verify the user can think through runtime behavior — state machines, failure recovery, and the most dangerous failure mode: infinite loops.
- **5/5 criteria**: (1) Draws or describes the loop state machine (states + transition conditions). (2) Gives a concrete decision table for each failure type. (3) Proposes a dead-loop detection or circuit-breaker mechanism.
- **Failure signal**: User has no answer for "what happens when the loop doesn't terminate" — or describes no guardrail.

#### A.L5: 对抗性 / Adversarial

- **Trigger input**: User has described the loop's runtime behavior (L4).
- **Question goal**: Test whether the user has considered adversarial inputs — prompt injection, model jailbreak into the loop, tool-returned fake data causing bad loop state.
- **5/5 criteria**: (1) Identifies at least one prompt injection vector into the loop. (2) Describes how corrupted tool output can corrupt loop state. (3) Proposes a containment strategy (sandbox, output validation, loop-count limit).
- **Failure signal**: User says "the LLM is trusted" or has no answer for corrupted inputs.

#### A.L6: Production

- **Trigger input**: User has described loop runtime and adversarial robustness (L4–L5).
- **Question goal**: Push the user to think about scale, cost, and multi-agent production concerns.
- **5/5 criteria**: (1) Gives a concrete cost model for the loop (tokens/call, latency/call). (2) Describes how to support N concurrent agents with the same loop architecture. (3) Proposes a strategy to keep cost within 10× of baseline while scaling 10×.
- **Failure signal**: User says "we'll just scale the servers" without a concrete cost or concurrency plan.

#### A.L4 Instance Questions (≥3 required per root, all root-specific)

- **A.L4-1**: Agent 执行过程中，step-by-step 状态如何变化？给出状态机的输入/转移条件。
- **A.L4-2**: 如何检测并中断模型重复调用同一 tool 的死循环？给出具体的检测阈值和中断策略。
- **A.L4-3**: 如果 executor 报告执行结果与 planner 预期不一致（比如 tool 返回了意外格式），loop 如何回退？给出决策表。
- **A.L4-4**: Loop 在高并发场景下（100+ 客户端同时发起请求），如何保证状态一致性？是否需要锁？给出你的并发模型。

#### A.L5 Instance Questions

- **A.L5-1**: 如果 tool 返回的 JSON 被注入了一段隐藏的系统指令（prompt injection），你的 loop 会执行它吗？在哪里做拦截？
- **A.L5-2**: 模型在 loop 中持续 hallucinate 工具名（比如调用一个不存在的 tool），你的检测和降级机制是什么？
- **A.L5-3**: 恶意用户通过精心构造的 tool 返回数据，造成 loop 内部 memory state 污染，你如何发现和清理？
- **A.L5-4**: 如果模型在 loop 中被 jailbreak，持续调用 tool，你的 containment 策略是什么？

#### A.L6 Instance Questions

- **A.L6-1**: 如何把 cost 控制在当前水平的 10× 之内？请给出 Agent Loop 结构上的修改方案。
- **A.L6-2**: 1000 个并发 Agent 同时跑，每个都有独立的 loop 实例，你的调度策略是什么？给出资源隔离方案。
- **A.L6-3**: Loop 的 latency p99 是多少？如果 planner 或 tool 调用有抖动，你如何做超时和熔断？
- **A.L6-4**: 当 loop 需要支持多租户时（不同用户的 Agent 不能互相看到状态），你的隔离边界怎么划？

---

### B. Tool System

#### B.L0: Trigger

- **Trigger input**: User mentions `tool`, `function calling`, `MCP`, `skills` in their answer, or runs `/interview-coach start tool_use`.
- **Question goal**: Match the module to root B of the decision tree.
- **5/5 criteria**: User correctly identifies the tool system as the module; names at least one tool or tool-related file.
- **Failure signal**: User conflates tool use with the agent loop — describes "how the agent works" when asked about tools.

#### B.L1: Cognitive

- **Trigger input**: User has been asked about or has mentioned the tool system.
- **Question goal**: Verify the user understands the tool system's contract — what a tool is, its input/output schema, and where it sits in the execution pipeline.
- **5/5 criteria**: (1) Names the tool registry or tool definition files. (2) Describes the tool input/output format (JSON schema, function signature, etc.). (3) Explains how a tool call is dispatched from the agent to the tool executor.
- **Failure signal**: User describes tools as "things the LLM can call" without naming the schema, registry, or dispatch mechanism.

#### B.L2: Design

- **Trigger input**: User has described what the tool system is and how it dispatches (L1).
- **Question goal**: Test the user's rationale for the tool architecture — why a registry vs direct binding; sync vs async; CLI/API/Code tool uniformity.
- **5/5 criteria**: (1) Articulates why the system uses a tool registry rather than direct LLM-to-function binding. (2) Justifies the sync/async choice. (3) Explains how CLI, API, and Code tools are handled uniformly (or explains why they aren't).
- **Failure signal**: User says "we added tools as we needed them" — no architectural rationale for the tool system design.

#### B.L3: Engineering

- **Trigger input**: User has defended the tool design (L2).
- **Question goal**: Test extensibility (adding new tools), isolation (sandboxing), and testability.
- **5/5 criteria**: (1) Describes how a developer adds a new tool without touching core loop code. (2) Names the sandboxing mechanism for each tool type. (3) Describes at least one test strategy for a tool (mock, integration, contract testing).
- **Failure signal**: User says "just add it to the list" without describing extension points, sandbox, or testing.

#### B.L4: Runtime

- **Trigger input**: User has described the tool system's engineering structure (L3).
- **Question goal**: Test runtime failure handling — network error, timeout, permission denial, invalid output, and the recovery strategy for each.
- **5/5 criteria**: (1) Provides a decision table for each failure type (retry / rollback / skip / abort). (2) Describes the timeout strategy per tool class. (3) Explains how tool results are validated before being fed back to the LLM.
- **Failure signal**: User says "we just try again" without specifying retry policy, backoff, or circuit-breaker.

#### B.L5: 对抗性 / Adversarial

- **Trigger input**: User has described tool runtime failure handling (L4).
- **Question goal**: Test whether the user has considered adversarial tool scenarios — fake data, malicious input, dangerous code execution.
- **5/5 criteria**: (1) Describes how to verify tool result authenticity (signature, schema validation, sandbox output inspection). (2) Explains how malicious tool input is sanitized. (3) Names at least one dangerous tool type and its containment boundary.
- **Failure signal**: User says "we trust the tools" — no answer for fake data, malicious input, or code execution safety.

#### B.L6: Production

- **Trigger input**: User has described tool system runtime and adversarial robustness (L4–L5).
- **Question goal**: Push to production scale — 1000 concurrent tool calls, cost per call, permission model, multi-tenant isolation.
- **5/5 criteria**: (1) Describes the tool runtime scheduler for 1000 concurrent agents. (2) Gives a cost model per tool call (compute + LLM tokens + I/O). (3) Proposes a permission model and sandbox isolation strategy for multi-tenant.
- **Failure signal**: User says "tools run on demand" without describing concurrency limits, cost accounting, or tenant isolation.

#### B.L4 Instance Questions

- **B.L4-1**: Tool 调用失败后（network error / timeout / 权限拒绝），系统是重试、回滚、继续还是终止？给出每种情况的决策表。
- **B.L4-2**: 工具执行超时后，loop 如何处理？是等待、取消、还是降级到 fallback？给出超时配置策略。
- **B.L4-3**: Tool 返回的数据格式不符合预期（比如 JSON 解析失败），你的 loop 如何处理这个中间态错误？
- **B.L4-4**: 如果一个 tool 在执行中被外部资源占用（比如文件锁），并发场景下如何避免死锁？

#### B.L5 Instance Questions

- **B.L5-1**: Tool 返回伪造数据（攻击者构造的假数据），你的系统如何验证真实性？
- **B.L5-2**: 一个被污染的 tool（开发者密钥泄露、被植入恶意代码）如何被检测和隔离？
- **B.L5-3**: Tool 的输入如果被 prompt injection 污染（比如用户消息里藏了一段 system prompt），你在哪个阶段做过滤？
- **B.L5-4**: 恶意用户通过反复调用耗时的 tool 进行 DoS，你的限流和熔断策略是什么？

#### B.L6 Instance Questions

- **B.L6-1**: 1000 个并发 Agent 同时调用工具，tool runtime 如何调度？给出沙箱隔离策略和并发上限配置。
- **B.L6-2**: Tool 调用成本如何核算？不同 tool 类型（本地 CLI vs 远程 API vs MCP）成本差异如何建模？
- **B.L6-3**: 多租户场景下，tool 访问权限如何精细化控制？role-based vs resource-based 的边界在哪里？
- **B.L6-4**: Tool registry 如何热更新？在不重启 Agent 的情况下注册/注销一个 tool 的机制是什么？

---

### C. Memory System

#### C.L0: Trigger

- **Trigger input**: User mentions `memory`, `history`, `context window`, `vector DB`, `retrieval` in their answer, or runs `/interview-coach start memory`.
- **Question goal**: Match the module to root C of the decision tree.
- **5/5 criteria**: User correctly identifies the memory system as the module; names at least one memory-related file or component.
- **Failure signal**: User describes memory as "context" without distinguishing it from the context engineering module (root E), or has no file references.

#### C.L1: Cognitive

- **Trigger input**: User has been asked about or has mentioned the memory system.
- **Question goal**: Verify the user understands the memory system's structure — short-term vs long-term, write path vs retrieval path, and the boundary with context (E root).
- **5/5 criteria**: (1) Names the memory components (short-term buffer, long-term store, vector index, etc.). (2) Describes the write path (when and what gets stored). (3) Describes the retrieval path (when and how it is queried).
- **Failure signal**: User says "we store conversation history" without distinguishing short-term vs long-term, or without describing retrieval.

#### C.L2: Design

- **Trigger input**: User has described the memory system's structure (L1).
- **Question goal**: Test the user's rationale — why vector DB, why not just use the context window; how memory and context interact.
- **5/5 criteria**: (1) Explains the decision to use (or not use) a vector database. (2) Describes the boundary between memory (C root) and context (E root). (3) Justifies the memory retention policy (TTL, relevance threshold, etc.).
- **Failure signal**: User says "we needed to store things" without explaining the architectural decision or the context/memory boundary.

#### C.L3: Engineering

- **Trigger input**: User has defended the memory design (L2).
- **Question goal**: Test embedding update strategy, retrieval ranking, write/read concurrency, and testability.
- **5/5 criteria**: (1) Describes how embeddings are updated (full re-index vs incremental). (2) Describes the retrieval ranking strategy (similarity score + re-rank + filter). (3) Names the write/read concurrency model.
- **Failure signal**: User describes no embedding update strategy, or says "we just store everything and search it" without ranking or filtering.

#### C.L4: Runtime

- **Trigger input**: User has described the memory system's engineering (L3).
- **Question goal**: Test memory write/read timing, lazy vs eager semantics, and conflict resolution.
- **5/5 criteria**: (1) Provides a timing diagram for write vs read (sync/blocking vs async/non-blocking). (2) Describes whether retrieval is lazy or eager. (3) Explains how memory conflicts are resolved (concurrent writes, stale reads).
- **Failure signal**: User has no answer for "when exactly does memory get written" — or describes no conflict resolution.

#### C.L5: 对抗性 / Adversarial

- **Trigger input**: User has described memory runtime behavior (L4).
- **Question goal**: Test memory poisoning, corruption, and rollback under adversarial conditions.
- **5/5 criteria**: (1) Describes how to detect memory poisoning (incorrect information stored long-term). (2) Proposes a cleanup mechanism for corrupted memory entries. (3) Explains how to roll back memory to a known-good state.
- **Failure signal**: User says "we trust the data" — no answer for memory poisoning, staleness, or rollback.

#### C.L6: Production

- **Trigger input**: User has described memory system runtime and adversarial robustness (L4–L5).
- **Question goal**: Push to cost, storage tiering, and multi-user isolation at scale.
- **5/5 criteria**: (1) Describes storage tiering (what goes to vector DB vs KV vs disk). (2) Gives a cost model for memory storage at scale. (3) Proposes multi-user memory isolation boundaries.
- **Failure signal**: User says "we have enough storage" without a tiering strategy, cost model, or isolation boundary.

#### C.L4 Instance Questions

- **C.L4-1**: Memory 写入是同步阻塞还是异步？检索是 lazy 还是 eager？给出时序图说明。
- **C.L4-2**: 当 memory retrieval 结果与当前 context 矛盾时（过时数据），你的仲裁逻辑是什么？
- **C.L4-3**: 如果 memory 写入过程中 Agent 被中断（比如服务重启），如何保证不丢失数据？给出持久化策略。
- **C.L4-4**: Memory 检索结果过多（top-K 太大），你如何做重排和过滤？

#### C.L5 Instance Questions

- **C.L5-1**: Memory 被污染（错误信息被长期记住），你的清理机制是什么？给出具体的过期策略。
- **C.L5-2**: 恶意用户通过构造特殊的 tool 返回数据，让 memory embedding 被注入错误语义，你如何检测？
- **C.L5-3**: Memory 中的敏感信息（用户密码、API key）被意外存入，你的清理和隔离机制是什么？
- **C.L5-4**: 如果 memory retrieval 被对抗性地触发（adversarial query 诱导取出错误记忆），你如何防御？

#### C.L6 Instance Questions

- **C.L6-1**: Memory cost 占总成本 30%，如何分层存储？哪些放 vector DB、哪些放 KV、哪些放归档存储？
- **C.L6-2**: 10000 个用户同时使用，每个用户的 memory 互相隔离，存储层如何做 tenant isolation？
- **C.L6-3**: Memory embedding 的更新频率如何控制？频繁更新 embedding 的成本如何摊薄？
- **C.L6-4**: 如何对 memory 做冷热分层？热数据放内存还是 vector DB 的缓存层？

---

### D. Planner / Reasoning

#### D.L0: Trigger

- **Trigger input**: User mentions `planner`, `planning`, `reasoning`, `task decomposition`, `replan` in their answer, or runs `/interview-coach start planner`.
- **Question goal**: Match the module to root D of the decision tree.
- **5/5 criteria**: User correctly identifies the planner as the module; names at least one planner-related file or function.
- **Failure signal**: User conflates planning with the agent loop — describes "how the agent decides" without naming the planner's I/O contract.

#### D.L1: Cognitive

- **Trigger input**: User has been asked about or has mentioned the planner.
- **Question goal**: Verify the user understands the planner's contract — input (what triggers planning), output (what a plan looks like), and the boundary with the executor.
- **5/5 criteria**: (1) Names the planner's input (user query, available tools, memory, etc.). (2) Describes the planner's output format (step list, task graph, etc.). (3) Explains the boundary between planner and executor (who decides, who executes).
- **Failure signal**: User says "the planner decides what to do" without describing the I/O contract or the planner/executor separation.

#### D.L2: Design

- **Trigger input**: User has described the planner's contract (L1).
- **Question goal**: Test the rationale — why a planner, why not a single LLM call; what planning granularity is chosen and why.
- **5/5 criteria**: (1) Explains why a separate planner is needed vs a single-step LLM. (2) Justifies the planning granularity (step-level, task-level, goal-level). (3) Describes the re-planning trigger (when does the planner re-plan mid-execution).
- **Failure signal**: User says "the planner just generates steps" without justifying the separation or re-planning strategy.

#### D.L3: Engineering

- **Trigger input**: User has defended the planner design (L2).
- **Question goal**: Test the planning prompt design, multi-step generation strategy, and evaluation of plan quality.
- **5/5 criteria**: (1) Describes the planning prompt structure and key instructions. (2) Explains how multi-step plans are generated (chain-of-thought, decomposition, etc.). (3) Describes how plan quality is evaluated before execution.
- **Failure signal**: User says "we just prompt the LLM" without describing the prompt engineering, step ordering, or plan validation.

#### D.L4: Runtime

- **Trigger input**: User has described the planner's engineering (L3).
- **Question goal**: Test runtime failure handling — executor reports an unexecutable step, planner/executor conflict, and the recovery loop.
- **5/5 criteria**: (1) Describes how the executor signals an unexecutable step back to the planner. (2) Explains the planner's re-planning strategy after a failure. (3) Provides a decision table for when to retry vs abort vs escalate.
- **Failure signal**: User says "the planner just tries again" — no description of the recovery protocol between planner and executor.

#### D.L5: 对抗性 / Adversarial

- **Trigger input**: User has described planner runtime behavior (L4).
- **Question goal**: Test adversarial planning scenarios — hallucinated steps, redundant planning loops, prompt injection into the planner.
- **5/5 criteria**: (1) Describes how to detect planner hallucination (nonexistent files, unavailable tools in steps). (2) Explains how to compress a plan without losing valid steps (hallucination filtering). (3) Proposes a containment strategy for prompt injection into the planning prompt.
- **Failure signal**: User says "the LLM is smart enough" — no answer for hallucinated steps or plan compression.

#### D.L6: Production

- **Trigger input**: User has described planner runtime and adversarial robustness (L4–L5).
- **Question goal**: Push to production cost, latency, and multi-agent planning coordination.
- **5/5 criteria**: (1) Describes a cost model for planning (token cost per plan, latency per step). (2) Proposes a strategy to reduce planning cost (pruning, caching, smaller planner model). (3) Explains how multiple agents coordinate when they have competing plans.
- **Failure signal**: User says "planning is fast enough" without a cost model, pruning strategy, or multi-agent coordination plan.

#### D.L4 Instance Questions

- **D.L4-1**: Planner 输出步骤不可执行（比如要求读不存在的文件），executor 如何回退给 planner 重排？
- **D.L4-2**: Planner 生成了一个包含 50 个步骤的长计划，执行到第 10 步时 context window 爆了，你的重排策略是什么？
- **D.L4-3**: 如果 executor 报告成功但结果与 planner 预期不符（比如 step 返回了意外数据），planner 如何调整后续步骤？
- **D.L4-4**: Planner 与 executor 之间如何做状态同步？如果 executor 在执行中暂停，planner 能否感知并介入？

#### D.L5 Instance Questions

- **D.L5-1**: Planner hallucination 生成冗余步骤（比如重复调用同一 tool 3 次），你如何压缩并保留有效规划？
- **D.L5-2**: 恶意用户在 prompt 中注入隐藏指令，诱导 planner 生成危险步骤，你的防御机制是什么？
- **D.L5-3**: 如果 planner 被对抗性地诱导生成大量无意义步骤（资源耗尽攻击），你如何做 plan 预算控制？
- **D.L5-4**: Planner 生成的步骤依赖了已被撤销的 tool 版本，你如何检测和回滚？

#### D.L6 Instance Questions

- **D.L6-1**: Planning token 占总成本 50%，如何降本（剪枝 / 缓存 / smaller planner）？给出具体的成本优化方案。
- **D.L6-2**: 多个 Agent 同时调用同一个 planner 实例，如何做并发控制和资源隔离？
- **D.L6-3**: 如何做 planning 的 A/B 测试——比较不同 planner prompt 或模型的规划质量？
- **D.L6-4**: Planner 的 latency p99 是多少？如果 planning 慢影响整体响应，你的优化方案是什么？

---

### E. Context / Prompt Engineering

#### E.L0: Trigger

- **Trigger input**: User mentions `context`, `prompt`, `compression`, `KV cache`, `system prompt` in their answer, or runs `/interview-coach start context_engineering`.
- **Question goal**: Match the module to root E of the decision tree.
- **5/5 criteria**: User correctly identifies context engineering as the module; names at least one context-related file or component.
- **Failure signal**: User conflates context with memory (C root) — describes "things the agent remembers" without distinguishing retrieval vs compression.

#### E.L1: Cognitive

- **Trigger input**: User has been asked about or has mentioned context engineering.
- **Question goal**: Verify the user understands what context consists of, how it is structured, and how it differs from memory (C root).
- **5/5 criteria**: (1) Lists the components of context (system prompt, user message, tool results, memory retrieval, etc.). (2) Describes how context is assembled and ordered. (3) Explains the boundary with the memory system (C root).
- **Failure signal**: User says "context is everything the LLM sees" without decomposing it or distinguishing it from memory.

#### E.L2: Design

- **Trigger input**: User has described the context's components (L1).
- **Question goal**: Test the rationale for context management decisions — compression strategy, ordering, KV cache usage, and what gets in vs out.
- **5/5 criteria**: (1) Explains the context compression strategy (summarization, truncation, importance weighting). (2) Justifies the ordering of context components. (3) Describes the role of KV cache or context caching.
- **Failure signal**: User says "we just send all the history" — no compression strategy, ordering rationale, or cache rationale.

#### E.L3: Engineering

- **Trigger input**: User has defended the context design (L2).
- **Question goal**: Test the implementation — how context is built per request, how compression is triggered, and how the context is tested.
- **5/5 criteria**: (1) Describes how context is built at request time (pipeline, transformers, etc.). (2) Explains the compression trigger (threshold-based, model-based, etc.). (3) Describes testing strategy for context quality (regression tests on key prompts).
- **Failure signal**: User describes no compression implementation or testing strategy for context quality.

#### E.L4: Runtime

- **Trigger input**: User has described the context system's engineering (L3).
- **Question goal**: Test context overflow behavior — what gets dropped, what gets kept, and how the overflow policy is decided.
- **5/5 criteria**: (1) Gives the exact context overflow policy (what is dropped first, second, last). (2) Explains how critical information (tool results, memory retrieval) is prioritized. (3) Describes what happens when even system prompt is too long.
- **Failure signal**: User says "we handle it" without a concrete overflow policy or prioritization logic.

#### E.L5: 对抗性 / Adversarial

- **Trigger input**: User has described context runtime behavior (L4).
- **Question goal**: Test adversarial context scenarios — prompt injection, context pollution, information leakage.
- **5/5 criteria**: (1) Describes how prompt injection in user messages is 削弱 by context placement (system vs user vs tool). (2) Explains how to detect and remove context pollution. (3) Proposes a strategy to prevent information leakage between sessions or tenants.
- **Failure signal**: User says "the LLM knows what to ignore" — no answer for prompt injection or context pollution.

#### E.L6: Production

- **Trigger input**: User has described context system runtime and adversarial robustness (L4–L5).
- **Question goal**: Push to token cost, dynamic context trimming, and latency management.
- **5/5 criteria**: (1) Gives a cost model for context construction (token cost per context build, compression cost). (2) Describes a dynamic trimming strategy that keeps task success rate high. (3) Explains how context building latency is profiled and optimized.
- **Failure signal**: User says "context is cheap" without a cost model, trimming strategy, or latency analysis.

#### E.L4 Instance Questions

- **E.L4-1**: Context window 爆了之后，你的丢弃规则是什么（什么先丢、什么保留）？给出优先级表。
- **E.L4-2**: 如果 memory retrieval 返回的内容与当前 context 冲突（过时信息），你的仲裁逻辑是什么？
- **E.L4-3**: Context 重建时（session resume），如何保证不丢失关键中间状态？
- **E.L4-4**: Tool 返回的 JSON 结果很长，塞入 context 后容易触发 window 上限，你的选择性嵌入策略是什么？

#### E.L5 Instance Questions

- **E.L5-1**: Prompt injection 攻击（用户消息里塞了一段隐藏指令），你放在 system / user / tool 段的位置如何削弱它？
- **E.L5-2**: 如果 tool 返回结果中包含恶意指令，你的上下文是否会被污染？如何在放入 context 前清洗？
- **E.L5-3**: 恶意用户通过 session resume 机制注入历史 context，你的防御机制是什么？
- **E.L5-4**: Context 中的敏感信息（密码、API key）如何防止被 LLM 在后续输出中泄露？

#### E.L6 Instance Questions

- **E.L6-1**: 如何动态裁剪 context，把 token 控制在 30k 以内但保 task 成功率？给出具体的裁剪算法。
- **E.L6-2**: Context 构建的 token 成本占总成本比例是多少？如何优化（KV cache、prompt caching、选择性检索）？
- **E.L6-3**: 如何对不同类型的 context component（system prompt / history / tool results / memory retrieval）做成本分摊？
- **E.L6-4**: Context 构建的 latency 如何 profiling？如果 context build 成了 pipeline 瓶颈，优化方案是什么？

---

### F. Evaluation / Harness

#### F.L0: Trigger

- **Trigger input**: User mentions `evaluation`, `benchmark`, `metric`, `harness`, `A/B test`, `data flywheel` in their answer, or runs `/interview-coach start evaluation`.
- **Question goal**: Match the module to root F of the decision tree.
- **5/5 criteria**: User correctly identifies evaluation as the module; names at least one eval/harness-related file or concept.
- **Failure signal**: User describes evaluation as "testing" without naming metrics, benchmarks, or the evaluation pipeline.

#### F.L1: Cognitive

- **Trigger input**: User has been asked about or has mentioned evaluation.
- **Question goal**: Verify the user understands the evaluation system's structure — what metrics are collected, how sessions are recorded, and how signals are extracted.
- **5/5 criteria**: (1) Names the key success metrics (task completion rate, tool call accuracy, latency, etc.). (2) Describes how a session trace is recorded. (3) Explains how failure signals are extracted from traces.
- **Failure signal**: User says "we measure how well it works" without naming specific metrics, trace schema, or signal extraction logic.

#### F.L2: Design

- **Trigger input**: User has described the evaluation system's metrics and traces (L1).
- **Question goal**: Test the rationale — why these metrics, why not accuracy; how metric validity is ensured.
- **5/5 criteria**: (1) Justifies the chosen metrics (why they are proxies for actual quality). (2) Explains why accuracy alone is insufficient. (3) Describes how metrics are validated against ground truth.
- **Failure signal**: User says "we use accuracy" without explaining why it is insufficient, or has no answer for metric validity.

#### F.L3: Engineering

- **Trigger input**: User has defended the evaluation design (L2).
- **Question goal**: Test the engineering of offline evaluation, benchmark construction, and regression testing.
- **5/5 criteria**: (1) Describes the offline evaluation pipeline (how traces are replayed). (2) Explains how benchmarks are constructed and maintained. (3) Describes how regression tests are run against new model/prompt versions.
- **Failure signal**: User describes no offline eval pipeline, or says "we test in production" without describing the regression strategy.

#### F.L4: Runtime

- **Trigger input**: User has described the evaluation system's engineering (L3).
- **Question goal**: Test how failed session traces are recorded, replayed, and turned into feedback signals.
- **5/5 criteria**: (1) Describes the trace recording schema (what data is captured per session). (2) Explains how failed sessions are identified and replayed. (3) Describes how feedback signals are extracted from replay and fed back into training or prompt tuning.
- **Failure signal**: User says "we look at the logs" without a structured trace schema, replay mechanism, or feedback loop.

#### F.L5: 对抗性 / Adversarial

- **Trigger input**: User has described evaluation runtime behavior (L4).
- **Question goal**: Test adversarial evaluation scenarios — eval overfitting, benchmark leakage, model cheating.
- **5/5 criteria**: (1) Describes how to detect eval overfitting (benchmark too narrow, model gaming the metric). (2) Explains how to detect model cheating on benchmarks. (3) Proposes a strategy to prevent benchmark data from leaking into training.
- **Failure signal**: User says "we trust the benchmarks" — no answer for overfitting, cheating, or data leakage.

#### F.L6: Production

- **Trigger input**: User has described evaluation system runtime and adversarial robustness (L4–L5).
- **Question goal**: Push to production A/B testing, data flywheel design, and evaluation cost management.
- **5/5 criteria**: (1) Describes the A/B testing framework for comparing prompts, planners, or models. (2) Explains how the data flywheel operates (eval → signal → training → eval). (3) Gives a cost model for running evaluation at scale.
- **Failure signal**: User says "we run evals occasionally" without describing an A/B framework, data flywheel, or eval cost model.

#### F.L4 Instance Questions

- **F.L4-1**: 一次失败会话的 trace 怎么记录、回放、提取反馈信号？给出 trace schema 和回放 pipeline。
- **F.L4-2**: 如何从 trace 中自动提取"成功"和"失败"的边界条件（critical decision points）？
- **F.L4-3**: Trace 数据量大了之后（百万级 session），你的存储和检索策略是什么？
- **F.L4-4**: 如何在 runtime 实时监控 Agent 的健康度（而不只是事后 eval）？

#### F.L5 Instance Questions

- **F.L5-1**: Eval overfitting（benchmark 太窄）你怎么检测？给出具体的方法。
- **F.L5-2**: Model cheating 怎么识别？例如模型在 benchmark 上记住了答案而不是真正推理。
- **F.L5-3**: Benchmark 数据集泄露到训练集的风险如何管控？给出具体的隔离策略。
- **F.L5-4**: 如果攻击者通过构造特殊输入让 eval 指标虚高，你的防御机制是什么？

#### F.L6 Instance Questions

- **F.L6-1**: 如何做 A/B 实验评估新 prompt / 新 planner？给出实验设计框架和统计显著性判断方法。
- **F.L6-2**: 数据飞轮怎么运作？Eval → Signal → Training → Eval 的闭环如何设计避免退化？
- **F.L6-3**: 大规模 eval 的成本如何控制？如果每次 model 改动都要跑完整 benchmark，如何做分层 eval 加速？
- **F.L6-4**: 多模型 A/B 测试时，如何控制 confounding variables（不同模型的 token 效率差异如何排除）？

---

## 5. v0.2 Backward-Compatibility

> **Note**: v0.2 used a linear list of 22 questions (A1–C5 + D1–D5) organized into 4 categories: A=认知 / B=设计 / C=工程 / D=评估. These codes are **NOT used in v0.3**. This section exists only as a historical reference.

| v0.2 Category | v0.3 Decision Tree Location |
|---------------|----------------------------|
| A 类（是什么 / 认知） | L1 认知层 across all 6 roots (A–F).L1 |
| B 类（为什么 / 设计） | L2 设计层 across all 6 roots |
| C 类（怎么做 / 工程） | L3 工程层 across all 6 roots |
| D 类（怎么评估） | F root L4–L6（Evaluation module）；但 D 类"度量成功"被拆为 Runtime / Adversarial / Production 三个可计算指标层 |

**Fallback behavior**: For modules with `tree_root: null` in `module-map.yaml` (i.e., not mapped to A–F), the coach falls back to v0.2's 4-category rotation (A→B→C→D). This ensures backward compatibility for unmapped modules (e.g., `permissions`, `sandbox`).

---

## 6. Coverage and End Conditions

### Internal State Schema

The coach maintains this state during a module session:

- **`current_root`**: `"A" | "B" | "C" | "D" | "E" | "F"` — the active decision tree root node.
- **`current_layer`**: `0 | 1 | 2 | 3 | 4 | 5 | 6` — the active layer.
- **`coverage`**: `Map<root, Set<layer>>` — records which layers have been covered for each root node. Used to compute "7 层覆盖" status in module-end output.
- **`consecutive_含糊_count`**: Integer — counts consecutive rounds where the user's answer is ≤ 2 (未答 or 含糊). Resets to 0 on any answer ≥ 3.
- **`round_count`**: Integer — total rounds in the current module session.
- **Note**: `coverage` tracks L1–L6 (6 layers). L0 is the Trigger layer and is not graded; it does not appear in `coverage` and does not count toward the "≥2 of L4/L5/L6" depth requirement.

### 4 End Conditions

A module session ends when **any one** of these conditions is met:

1. **`default_depth` reached**: `round_count >= module.default_depth` (core modules: 5; important: 3; configurable via `[deep]` / `[quick]`).
2. **打穿**: `consecutive_含糊_count >= 2` — user gave ≤ 2-tier answers for 2 consecutive rounds at the same layer.
3. **User pause**: User runs `/interview-coach pause`.
4. **Coverage complete**: `coverage[root]` includes all 6 layers (L1–L6). This is the strongest end condition — the module has been fully traversed.

### Depth Insufficiency Penalty Rule

When a module session ends, if the `coverage` map shows that **fewer than 2 of {L4, L5, L6}** have been covered for the current root, the coach applies a **"深度不足" penalty**:

- The module's score in the relevant dimensions (Runtime / Adversarial / Production) is noted as "未充分验证 — 深度不足，建议用 `start <module> deep` 重新覆盖"。
- This penalty is displayed in the module-end output under **薄弱层定位**.

This rule ensures that even "easy" modules cannot skip the Runtime / Adversarial / Production layers that represent real production readiness.

---

## 7. Cross-References

The decision tree is consumed alongside two companion files:

- **`grading-rubric.md`** — defines the 4-dimension scoring system (Design / Runtime / Adversarial / Production) that maps to decision tree layers L1–L6. Each layer's node entry points to the corresponding dimension in `grading-rubric.md`.
- **`dialectical-template.md`** — defines the Step ① / Step ② / Step ③ feedback templates. Step ② includes the "你正在决策树哪一层 Lx" and "下一轮将问什么" fields that reference this file's node labels.

### Quick Reference: Layer → Dimension Mapping

| Layer | Dimension | Grading File Section |
|-------|-----------|----------------------|
| L1 认知 | Design | §1 (Design) |
| L2 设计 | Design | §1 (Design) |
| L3 工程 | Design | §1 (Design) |
| L4 运行时 | Runtime | §2 (Runtime) |
| L5 对抗性 | Adversarial | §3 (Adversarial) |
| L6 生产 | Production | §4 (Production) |

---

*End of decision tree. For the 5-tier branching algorithm used at runtime, see `grading-rubric.md` §0. For Step ①②③ dialectical templates, see `dialectical-template.md`.*
