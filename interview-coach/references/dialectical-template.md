# Interview Coach — Dialectical Feedback Templates (v0.3)

> **Spec source**: `Information/Plan/2026-07-05-interview-coach-skill-design.md` §3.2, §5.3
> **Version**: 0.3.0
> **This file defines**: The dialectical feedback templates used by interview-coach v0.3. Step ① (4-section dialectical evaluation) and Step ② (5-section round summary) are emitted after every answer. Step ③ (module-end output) is the template from `grading-rubric.md` §4, used only at module end.
> **Cross-references**:
> - `decision-tree.md` — defines the L1–L6 layer labels (Cognitive / Design / Engineering / Runtime / Adversarial / Production)
> - `grading-rubric.md` — defines the 4-dim scoring and the full module-end output template
> - `SKILL.md` — defines the hard rules and branching logic that triggers each step

---

## 1. Strict Order Convention

From spec §3.2, the three steps must appear in this strict order within each module:

1. **Step ①** (dialectical evaluation) must precede Step ② — always.
2. **Step ②** (round summary) must precede the next question — always.
3. **Step ③** (module-end output) is emitted **exactly once** at module end — never per-round.

```
[User answers]
        ↓
Step ① → Step ② → [Next question]
        ↓         ↓
   (per round) (per round)
        ↓
[Module-end condition met: default_depth / 打穿 / pause]
        ↓
Step ③ → [Write progress.md → Move to next module or end session]
```

---

## 2. Step ① — Dialectical Evaluation (4 Sections)

Emitted after every user answer, before Step ②.

The coach evaluates the answer across four perspectives, each phrased as a Chinese heading with an English gloss in parentheses. Each section is 1–3 sentences.

### ①-1. 你回答中正确的部分 (What You Got Right)

State 1–3 concrete things the user said that were accurate, well-reasoned, or insightful. This is not flattery — it must be specific and tied to what the user actually said.

**Worked Example** (Module: Tool System, Root B, L3 Engineering):

> **User answer**: "我设计的 Tool System 使用同步注册表（tool registry），每次调用工具前会先查注册表验证 tool 是否存在。注册表在系统启动时初始化，支持动态注册和注销。"
>
> **Section ①-1 output**:
> "你的 tool registry 同步初始化设计是合理的——注册表在启动时完整构建避免了运行时动态查找的性能抖动；动态注册/注销能力支持了工具的热插拔，这是生产系统必要的弹性能力。"

---

### ①-2. 你回答中不足的部分 (What Was Insufficient / Missing / Off)

State 1–3 concrete gaps: what the user did not cover, what was vague, or what was factually wrong. Be specific — point to the exact dimension (layer) where the gap appears.

**Worked Example** (Module: Tool System, same answer as above):

> **Section ①-2 output**:
> "你没有说明注册表的并发安全策略——多线程/多 Agent 同时注册或注销同一个工具时，是否需要加锁？锁粒度是全局锁还是按 tool_id 分段锁？其次，注册表变更后，in-flight 的 tool call（正在执行的工具）是否受影响，还是只对下一轮生效？最后，动态注销时正在执行的工具实例是强制终止还是优雅等待完成？"

---

### ①-3. 你回答中有意思的角度 (An Interesting Angle You Raised)

Highlight 1 concrete angle the user raised that is non-obvious, insightful, or opened a productive sub-thread. If the user's answer was entirely conventional, say so and suggest one interesting follow-up direction.

**Worked Example** (Module: Tool System, same answer as above):

> **Section ①-3 output**:
> "你对'动态注销'的提及很有意思——它暗示你已经在思考工具的生命周期管理，而不只是'注册了就一直能用'的静态思维。这个方向可以追问：如果正在执行中的工具被注销，系统应该发出什么信号？是取消执行、等待完成、还是抛异常？"

---

### ①-4. 你回答中风险信号 (Risk Signals)

Call out 1–3 risk signals: wrong premise, thinking inertia (stuck at a shallower layer), missing failure modes, or design assumptions that break under adversarial conditions. Frame each as a concrete scenario, not a vague warning.

**Worked Example** (Module: Tool System, same answer as above):

> **Section ①-4 output**:
> "风险信号 1：你的设计隐含'工具注册表可信'的前提——但如果注册表本身被恶意篡改（例如攻击者通过 injection 修改了 tool schema），你的系统没有校验机制。风险信号 2：'同步注册表'意味着所有工具在初始化时必须全部可用（网络可达、权限满足），否则启动失败——这在微服务架构中可能导致级联启动失败，没有做 graceful degradation。"

---

## 3. Step ② — Round Summary (5 Sections, v3 Additions)

Emitted immediately after Step ①, before the next question. The v3 additions (sections ④ and ⑤) give the user decision-tree navigation context.

### ②-1. 本轮问题是什么 (What Was the Question)

Paraphrase the question in 1 sentence. State which root node (A–F) and layer (L1–L6) it belongs to.

**Worked Example**:
> "本轮问题是 B.L3（Tool System 工程层）：'你的工具注册与执行架构如何设计以支持扩展性与隔离性？'——这是在问工程落地的具体实现。"

---

### ②-2. 你刚才实际回答了什么 (What You Actually Said)

Paraphrase the user's answer in 1–2 sentences. Do not copy verbatim — translate the substance into a neutral summary. Flag if the answer was empty, vague, or off-topic.

**Worked Example**:
> "你说你用同步注册表在启动时初始化所有工具，支持动态注册和注销，但没有说明并发安全、in-flight 中途变更、或优雅退出策略。"

---

### ②-3. 关键差距：你答到的 vs 该答到的 (Key Gap: What You Covered vs What You Should Have Covered)

State 1–2 bullets comparing the user's actual coverage to the expected coverage for this layer. Be precise — name the missing dimension.

**Worked Example**:
> - "你答到了：工具注册的存在性与动态生命周期（静态设计维度）。"
> - "你未答到：并发场景下注册表的竞争条件与一致性策略（Runtime 维度，L4 覆盖区）。"

---

### ②-4. 你正在决策树哪一层 Lx (Which Layer of the Decision Tree You Are On)

State the current root node and layer. Name the layer's abstract focus and what the next escalation would be if the user answers well.

**Worked Example**:
> "你当前在 B.L3（Tool System 工程层）。这一层的预期是：你已经能正确描述工具注册的机制，下一步问你 L4 Runtime——工具调用失败后的恢复策略、并发调度、和隔离性。如果你这轮回答质量是'合理'，下一轮进入 B.L4；如果达到'很强'，同时触发 L4 + B.L3 横向'跨层打击'。"

---

### ②-5. 下一轮将问什么 (What the Next Round Will Ask)

Preview the next question with enough specificity that the user knows the direction. State the layer and a concrete question topic. If the module is ending (打穿 / default_depth reached / pause), say so.

**Worked Example**:
> "下一轮将问 B.L4（Runtime）：'如果一个工具调用超时或被权限拒绝，你的系统是重试、回滚、继续、还是终止？给出每种情况的决策表。'——这测试你在工具失败场景下的运行时弹性。"

---

## 4. Step ③ — Module-End Output

Step ③ output = the module-end template from `grading-rubric.md` §4. It is emitted exactly **once per module**, at the end, when one of these conditions is met:

1. **default_depth reached**: The configured round limit for this module has been reached.
2. **打穿 (drilled through)**: The user answered at ≤ "含糊" level for 2 consecutive rounds at the same layer — the decision tree has been exhausted for this module.
3. **User paused**: The user invoked `/interview-coach pause`.

The Step ③ output format is defined in `grading-rubric.md` §4 and includes:

- Module header (name, root node A–F, date, round count, 7-layer coverage status)
- 4-dim score table (Design / Runtime / Adversarial / Production)
- Overall assessment + weak layer identification
- JD hit rate with ★ annotations
- User answer retrospective (3 valuable points + 2 blind spots + 打穿 record)
- 7-layer standard answers (L1–L6, only for covered layers; uncovered marked "未触发")
- Next steps recommendation

**Pointer Example** (Module: Tool System, ended at default_depth = 5):

> **Step ③ — Module-End Output (excerpt)**
>
> ```
> ## 模块：tool_use（决策树根节点：B）
> 日期：2026-07-05
> 总轮数：5（达到 default_depth 上限）
> 7 层覆盖：L1✅ L2✅ L3✅ L4✅ L5⚠️ L6❌（未触发）
>
> ### ① 4 维评分
> | 维度 | 分数 | 评语 |
> |------|------|------|
> | 设计（Design, L1–L3） | 4/5 | 能清晰描述 registry 架构，选型理由充分 |
> | 运行时（Runtime, L4） | 3/5 | 失败恢复有基本思路，但决策表不完整 |
> | 对抗性（Adversarial, L5） | 2/5 | 未覆盖 tool 假数据防御；动态注册安全隐患未提及 |
> | 生产（Production, L6） | 未触发 | — |
>
> **薄弱层定位**：对抗性 2/5，Tool System L5 层未打穿，下次建议 /interview-coach start tool_use [deep] 优先打 B.L5。
>
> [... full template continues in grading-rubric.md §4 ...]
> ```

---

## 5. Worked Example: 3-Round Dialogue

Full example showing Step ① + Step ② for each round. Round 1 is L1 Cognitive, Round 2 is L3 Engineering (escalated after a "合理" rating), Round 3 is L5 Adversarial (escalated after a "很强" rating). Step ③ is not shown per-round — it fires only once at module end.

**Module**: memory（Memory System, Root C）
**User's JD**: "长期记忆：支持多轮会话的上下文保持，具备跨 session 的知识积累能力。"
**default_depth**: 5

---

### Round 1 — L1 Cognitive (C.L1)

**Question**:
> "讲一下你的 Memory System：它由哪些部分组成？长期记忆和短期记忆的区别是什么？"

**User Answer**:
> "我的系统里有两种 memory：一种是 conversation history，放在 session 里，session 结束后就清掉；另一种是 long-term memory，用向量数据库存，跨 session 都能用。检索的时候用 embedding similarity，超过 0.8 的拿出来用。"

---

**Step ① — Dialectical Evaluation**:

**①-1. 你回答中正确的部分 (What You Got Right)**:
> "你正确识别了 Memory System 的两个核心层次：短期（session-scoped conversation history）和长期（cross-session vector store）。Embedding-based retrieval 用相似度阈值（0.8）做路由也是一个合理的工程选择。"

**①-2. 你回答中不足的部分 (What Was Insufficient / Missing / Off)**:
> "你没有说明 session history 的具体存储介质（内存？文件？DB？）和大小上限——如果 session 很长（比如 500 轮对话），你的 conversation history 是全量保存还是截断？如果截断，截断策略是什么？其次，0.8 的相似度阈值是怎么定出来的？是经验值还是实验结果？如果一个 query 的 top-1 相似度只有 0.75，你的系统会怎么处理——降级为无 memory 检索，还是返回空结果让 LLM 冷启动？"

**①-3. 你回答中有意思的角度 (An Interesting Angle You Raised)**:
> "你提到'超过 0.8 拿出来用'——这暗示你已经在思考 retrieval 的过滤门控，而不是把所有结果都塞给 LLM。这个方向可以追问：如果 retrieval 返回了 100 条结果但 context window 只能容纳 20 条，你如何做 ranking 和 selection？"

**①-4. 你回答中风险信号 (Risk Signals)**:
> "风险信号 1：你的设计隐含'vector store 是可信的'前提——但如果 embedding 模型本身被投毒（adversarial input 导致错误的 embedding），你的相似度阈值判断会完全失效，系统会检索出语义相似但事实错误的记忆。风险信号 2：conversation history 的'session 后清掉'策略意味着没有任何跨 session 的短期上下文复用——如果用户在同一项目内连续开了多个 session（比如上午一个下午一个），两个 session 之间的上下文无法复用，这对长周期任务不友好。"

---

**Step ② — Round Summary**:

**②-1. 本轮问题是什么**:
> "本轮问题是 C.L1（Memory System 认知层）：'Memory System 由哪些部分组成？短期和长期记忆的区别是什么？'——这是在问你对系统结构的整体认知。"

**②-2. 你刚才实际回答了什么**:
> "你区分了 session-scoped conversation history 和 cross-session vector store，并简单描述了 embedding 相似度检索机制（阈值 0.8）。但没有说明 storage 介质、截断策略、threshold 的来源、或检索结果过多时的 ranking 策略。"

**②-3. 关键差距：你答到的 vs 该答到的**:
> - "你答到了：Memory System 的双层结构（短期 + 长期）✓"
> - "你未答到：检索结果的 ranking 与 context window 交互（L4 Runtime 层）——当 retrieval 结果超过 context 容量时，你的调度策略是什么？"

**②-4. 你正在决策树哪一层 Lx**:
> "你当前在 C.L1（Memory System 认知层）。C.L1 的预期是你能描述系统的基本构成，你做到了。下一步是 C.L2（设计层）——问你为什么选择向量数据库而不是其他存储方案，为什么 threshold 是 0.8 而不是其他值。如果你这轮评级是'合理'，下一轮进入 C.L2；如果是'很强'，同时触发 C.L2 + C.L1 横向'跨层打击'（比如：短期记忆的 session 边界是谁定的？合理性在哪？）。"

**②-5. 下一轮将问什么**:
> "下一轮将问 C.L2（设计层）：'你为什么选择向量数据库存储长期记忆？为什么不是图数据库、知识图谱、或简单的 KV store？你的 embedding 策略是什么——用什么模型？更新策略是追加还是重建？'——这测试你技术选型背后的权衡。"

---

### Round 2 — L2 Design → L3 Engineering (C.L2 after 合理 rating)

> Note: After Round 1 the coach assessed the answer as "合理" (not "很强"), so escalation goes to C.L2. However, the user's Round 2 answer was strong enough to trigger further escalation. The coach then asks C.L3.

**Question** (C.L2):
> "你为什么选择向量数据库存储长期记忆？为什么不是图数据库、知识图谱、或简单的 KV store？"

**User Answer**:
> "向量数据库适合语义检索，我的场景是多轮对话需要根据语义相似度找相关记忆，不是精确 key 查找。KV store 只能做精确匹配，不适合这个场景。图数据库适合关系型推理，我的场景没有那么多实体关系。Embedding 模型我用的是 text-embedding-3-small，维度是 1536，每条记忆存储时自动生成 embedding，检索时 query 也 embedding，然后做 cosine similarity。"

---

**Step ① — Dialectical Evaluation**:

**①-1. 你回答中正确的部分 (What You Got Right)**:
> "你的技术选型逻辑是成立的：语义检索场景 → 向量数据库 → 这是合理的因果链。你排除了 KV store（精确匹配不适合语义场景）和图数据库（关系推理不是主要需求），并给出了具体的 embedding 方案（text-embedding-3-small，1536 维，cosine similarity）——数据具体，说明你是实际验证过的，不是随口一说。"

**①-2. 你回答中不足的部分 (What Was Insufficient / Missing / Off)**:
> "你没有说明 embedding 的更新策略：记忆是只追加（append-only）还是会更新？如果一条记忆被更新了，旧的 embedding 怎么处理？是物理删除还是逻辑删除？物理删除后向量数据库里的向量空洞如何处理？其次，1536 维的存储成本你没有量化——每条记忆占多少存储空间？10000 条记忆的 embedding 存储成本是多少？最后，你提到 cosine similarity 但没有说明归一化策略：你的向量在入库前是否做了 L2 normalize？这直接影响 cosine similarity 计算的正确性。"

**①-3. 你回答中有意思的角度 (An Interesting Angle You Raised)**:
> "你对 KV store 的排除（'只能精确匹配'）其实隐含了一个设计假设：你的检索需求本质上是语义相似度驱动，而不是 key 驱动的。这个假设成立的前提是——你的使用场景中，用户（或 Agent）问的问题和记忆里存储的内容在语义空间是重叠的。如果用户的问题是'昨天讨论的那个方案怎么样了'而记忆里存的是'方案A优势是成本低'，embedding 能否正确桥接？"

**①-4. 你回答中风险信号 (Risk Signals)**:
> "风险信号 1：你的设计中'记忆只追加'策略会导致 embedding store 持续膨胀——每轮对话新增的记忆都会生成新 embedding，但语义上可能是冗余的（比如重复讨论同一话题）。这会导致 retrieval 时 top-k 结果里充斥着语义重复的条目，降低有效信息密度。风险信号 2：1536 维的 text-embedding-3-small 在 cosine similarity 检索时，如果你的向量数据库没有做 approximate nearest neighbor（ANN）索引，全量扫描的延迟会随数据量线性增长——10000 条可能还能接受，100000 条时 P99 latency 会是多少？"

---

**Step ② — Round Summary**:

**②-1. 本轮问题是什么**:
> "本轮问题是 C.L2（Memory System 设计层）：'你为什么选择向量数据库而不是其他存储方案？'——这是在问技术选型的权衡逻辑。"

**②-2. 你刚才实际回答了什么**:
> "你基于语义检索需求选择了向量数据库，排除了 KV store 和图数据库，并给出了具体的 embedding 方案（text-embedding-3-small，1536 维，cosine similarity）。但没有说明 embedding 更新策略、存储成本量化、或 ANN 索引的使用。"

**②-3. 关键差距：你答到的 vs 该答到的**:
> - "你答到了：语义检索场景 → 向量数据库选型逻辑 ✓"
> - "你未答到：embedding 的更新与清理策略（L3 工程层覆盖区）——长期运行的系统如何处理 embedding 的老化与存储成本？"

**②-4. 你正在决策树哪一层 Lx**:
> "你当前在 C.L3（Memory System 工程层）。C.L2 的设计选型逻辑已通过，C.L3 追问的是工程落地：扩展性、性能、存储成本、更新机制。如果评级是'合理'，下一轮进入 C.L4（Runtime）——记忆在运行时如何被读写？同步还是异步？检索延迟的 SLA 是多少？"

**②-5. 下一轮将问什么**:
> "下一轮将问 C.L4（Runtime）：'你的 memory 在运行时是同步阻塞写入还是异步？检索是 lazy 还是 eager？如果 embedding 服务宕机了，你的系统是降级到无 memory 模式还是返回错误？给出 retrieval 的端到端时序图。'——这测试你在 Memory System 运行时状态下的弹性设计。"

---

### Round 3 — L4 Runtime → L5 Adversarial (C.L5 after 很强 rating)

> Note: The user's C.L4 answer was strong (assessed as "很强"), so the coach escalated to C.L5 Adversarial. This round also includes a C.L4 horizontal cross-attack.

**Question** (C.L4 Runtime + C.L4 横向跨层打击):
> "两个问题。第一：'你的 memory 在运行时是同步阻塞写入还是异步？如果 embedding 服务宕机了，你的系统是降级还是报错？'第二（横向）：'如果 vector store 里存了一条完全错误的信息被长期记住，你的系统如何发现并纠正它？'"

**User Answer**:
> "写入是异步的，用消息队列解耦——每次对话结束后，把新的对话摘要 embedding 后 push 到 MQ，consumer 异步写入 vector store，主流程不会阻塞。embedding 服务宕机时，retrieval 会降级到'无 memory 模式'，直接走冷启动，embedding 服务恢复后 MQ 会继续消费 backlog，不会丢数据。
>
> 错误信息纠正：我的系统有一个人工审核接口，定期导出高置信度的 retrieval 结果让人审，审完反馈给系统，如果确认是错误记忆就物理删除那条记录，同时清掉对应的 embedding。"

---

**Step ① — Dialectical Evaluation**:

**①-1. 你回答中正确的部分 (What You Got Right)**:
> "你的异步写入 + MQ 解耦设计是生产级思维——主流程不阻塞、embedding 服务宕机时 graceful degradation 到无 memory 模式、MQ backlog 保证不丢数据，这三点合在一起是一个完整的 resilient retrieval 架构。关于错误记忆纠正，你设计了一个 human-in-the-loop 审核反馈环，这是防御 memory poisoning 的正确方向。"

**①-2. 你回答中不足的部分 (What Was Insufficient / Missing / Off)**:
> "你的异步写入有个关键问题没有回答：MQ consumer 写入 vector store 是'至少一次'（at-least-once）还是'恰好一次'（exactly-once）语义？如果 consumer 在写入 vector store 之后、commit offset 之前宕机，MQ 重推这条消息会导致重复 embedding 入库——你如何做 deduplication？其次，错误记忆的人工审核接口有个效率问题：'定期导出高置信度结果'——你的置信度是怎么定义的？是 retrieval cosine similarity 分数还是人工打标？如果相似度阈值以上的条目有 10000 条，人工审得过来吗？"

**①-3. 你回答中有意思的角度 (An Interesting Angle You Raised)**:
> "你提到'embedding 服务恢复后 MQ 会继续消费 backlog'——这个设计有意思，但它隐含了一个假设：MQ 的消息是持久化的（durable）。如果你的 MQ 配置是'非持久化消息'，embedding 服务宕机期间重启，backlog 会丢失。你是否考虑过这种情况？"

**①-4. 你回答中风险信号 (Risk Signals)**:
> "风险信号 1：你的'无 memory 降级模式'隐含了'LLM 可以冷启动工作'的假设——但在某些任务（比如需要引用昨天讨论结果的客服任务）中，无 memory 降级会导致任务完全失败，你是否有 fallback 到 default response 的策略？风险信号 2：你的 memory poisoning 纠正依赖人工审核——这是一个被动且慢的反馈环。攻击者如果在 1 小时内注入了 1000 条虚假记忆，你的系统需要多久才能发现并清除？这不是一个 production-ready 的对抗性防御机制。"

---

**Step ② — Round Summary**:

**②-1. 本轮问题是什么**:
> "本轮问题是 C.L4（Runtime）+ C.L4 横向跨层打击（Memory poisoning）：'memory 运行时读写架构 + 错误记忆如何发现与纠正？'——这是在问系统运行时弹性和对抗性防御。"

**②-2. 你刚才实际回答了什么**:
> "你说写入是异步 MQ 解耦、embedding 宕机时降级无 memory 不丢数据；错误记忆通过人工审核接口定期导出高置信度结果来纠正。但没有说明 MQ 的 delivery semantics（at-least-once vs exactly-once）、deduplication 策略、或自动化的 poisoning 检测机制。"

**②-3. 关键差距：你答到的 vs 该答到的**:
> - "你答到了：异步解耦 + graceful degradation ✓；人工反馈纠正环 ✓"
> - "你未答到：MQ at-least-once 语义导致的重复 embedding 去重（L3 工程层）；memory poisoning 的自动化检测（L5 Adversarial 层）——当前方案依赖人工，是被动防御。"

**②-4. 你正在决策树哪一层 Lx**:
> "你当前在 C.L5（Memory System 对抗性层）。Runtime 层的设计你已经打穿——你的异步解耦 + 降级策略足够好。现在 C.L5 追问的是对抗性：如果有人在检索结果里掺假数据、或故意污染 embedding 空间，你的系统有什么自动防御？"

**②-5. 下一轮将问什么**:
> "下一轮将问 C.L5 Adversarial（升级层）：'如果攻击者向你的 memory 系统注入了 1000 条虚假记忆（通过恶意工具调用），你的自动检测机制是什么？是 embedding 异常检测？事实一致性校验？还是基于来源 tool_id 的白名单？'——这测试你对抗性 memory 污染的自动防御能力。如果你的回答达到'很强'，最后一轮进入 C.L6（Production）：'memory 系统占你总 token 成本的 40%，你如何分层存储以降低成本？哪些放 Redis、哪些放向量数据库、哪些放冷存储？'"

---

### Module End (default_depth reached after 3 rounds, 2 of 3 rounds at C.L3+)

> Note: This is a compressed example. In a real session, default_depth = 5 would trigger the module end.

**Step ③ — Module-End Output** (excerpt, full template in `grading-rubric.md` §4):

```
## 模块：memory（决策树根节点：C）
日期：2026-07-05
总轮数：3（达到压缩示例上限；实际 default_depth = 5）
7 层覆盖：L1✅ L2✅ L3✅ L4✅ L5⚠️ L6❌（未触发）

### ① 4 维评分
| 维度 | 分数 | 评语 |
|------|------|------|
| 设计（Design, L1–L3） | 4/5 | Memory 双层结构清晰，选型逻辑有说服力，异步解耦设计合理 |
| 运行时（Runtime, L4） | 4/5 | 异步写入 + MQ backlog + graceful degradation 形成了完整的运行时弹性方案 |
| 对抗性（Adversarial, L5） | 3/5 | 有 human-in-the-loop 审核思路，但对抗性检测仍依赖人工，未到自动化级别 |
| 生产（Production, L6） | 未触发 | — |

**薄弱层定位**：对抗性 3/5（memory poisoning 自动检测缺失）；Production 未覆盖。

**JD 命中度**：
- ✅ [JD] "长期记忆：支持多轮会话的上下文保持" — 覆盖
- ✅ [JD] "跨 session 的知识积累能力" — 覆盖
- ⚠️ [JD] 无对抗性相关条款 — 你的设计已超出 JD 基线
- ★ 补充项：建议增加 embedding poisoning 自动检测（相似 embedding 聚类分析 + 事实一致性校验）

### ② 本模块"用户回答回顾"
- 你在本模块给出的 3 个最有价值的观点：
  1. 异步 MQ 解耦 + graceful degradation 是生产级运行时弹性设计
  2. 人工反馈纠正环是 memory poisoning 的必要防线
  3. embedding 相似度阈值做 retrieval 路由，门控设计合理
- 你在本模块出现的 2 个思维盲区：
  1. MQ at-least-once 语义下的 deduplication 策略缺失
  2. memory poisoning 纠正依赖人工，是被动而非主动防御
- 决策树"打穿"事件记录：未打穿（最后一轮仍有余地进入 L5–L6）

### ③ 7 层标准答案 + 重点记忆卡
**C.L1 认知** — 标准答案：Memory System 由短期（session-scoped conversation history）和长期（cross-session vector store）构成；记忆点：短期记忆管即时上下文，长期记忆管跨 session 知识积累。
**C.L2 设计** — 标准答案：向量数据库适合语义检索场景（text-embedding-3-small，1536 维，cosine similarity）；选型权衡是语义相似度 > 精确 key 查找；记忆点：embedding 更新策略和存储成本必须在设计时量化。
**C.L3 工程** — 标准答案：异步写入用 MQ 解耦，consumer 保证 at-least-once 并做 deduplication；检索 pipeline：query embedding → ANN index search → rerank → context injection；记忆点：ANN 索引选型（HNSW vs IVF）直接影响检索延迟。
**C.L4 Runtime** — 标准答案：写入异步 + 降级无 memory 模式保证系统韧性；检索时序：同步 query embedding → 并发 ANN search → merge + filter → return；记忆点：embedding 服务和 vector store 必须独立降级，不能捆绑。
**C.L5 Adversarial** — 标准答案：memory poisoning 防御分三层：来源校验（tool_id 白名单）+ 内容语义异常检测（embedding 聚类离群点）+ 事实一致性主动校验（定期用 LLM 验证记忆真实性）；记忆点：单一人工审核不是 production-ready 方案。
**C.L6 Production** — 未触发 — 下次复习时主动 /interview-coach start memory [deep]

### ④ 下一步建议
推荐下一模块：context_engineering（Context / Prompt Engineering，Root E）。理由：memory 和 context engineering 直接相邻——你在 memory 里设计的 embedding retrieval 策略，直接影响 context injection 的效率；两个模块连学可以打通"记忆存储 → context 构建 → prompt 编排"的完整链路。
```

---

## 6. Cross-Reference Summary

| Reference | Key content used in this file |
|-----------|-------------------------------|
| `decision-tree.md` | L1–L6 layer labels, root nodes A–F, branching logic (未答/含糊/合理/很强/极强 → Lx escalation) |
| `grading-rubric.md` | 4-dim scoring definitions, Step ③ module-end template (verbatim in §4), JD anchor rules |
| `SKILL.md` | Hard rules: "Step ① → Step ② → next question (strict order)"; Step ③ only at module end |
| `SKILL.md` §3.2 | Full per-round flow: answer → 5-tier eval → branching → Step ① → Step ② → next |
