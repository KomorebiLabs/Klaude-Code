# Klaude-Code

Klaude-Code is an independently maintained extension of [ConardLi/easy-agent](https://github.com/ConardLi/easy-agent), evolving toward a production-oriented Agent Harness for local coding workflows.

![](./public/img/banner.jpeg)

> **Project identity:** Klaude-Code is not the official `easy-agent` repository and does not represent the original author's views. It is an independent continuation built on top of an open-source foundation, with its own engineering roadmap around observability, reliability, safety, evaluation, and multi-agent operation.

Klaude-Code explores how an **Agent Harness** can turn coding models into reliable, observable, and extensible local development systems. It is independently maintained by an undergraduate developer through hands-on engineering and open-source practice.

If you find a problem, have an idea, or would like to discuss the project's direction, feel free to open an [issue](https://github.com/KomorebiLabs/Klaude-Code/issues).

Klaude-Code is a long-horizon TypeScript and Node.js project for building a local agentic coding system. The repository keeps the functional foundation developed through the original Easy Agent implementation path while adding a separate Enterprise Harness track: turning existing agent capabilities into systems that are observable, recoverable, evaluable, secure, and maintainable in real coding workflows.

> Chinese version: see [README.zh-CN.md](./README.zh-CN.md)

## Acknowledgements

This project is inspired by and built upon the excellent work of [ConardLi](https://github.com/ConardLi) and the [easy-agent](https://github.com/ConardLi/easy-agent) project.

The original project provided the functional foundation and a valuable path for studying Agent architectures and development practices. Klaude-Code continues that work as an independently maintained project by extending, hardening, documenting, and evaluating the inherited system.

Many thanks to the original author for sharing this work with the open-source community. Please consider supporting the original project.

## Vision

Klaude-Code aims to become a serious, open-source, production-oriented Agent Harness for local coding workflows.

The project is not claiming to be a finished replacement for Claude Code or Codex. The goal is to build toward that class of system through incremental engineering evidence rather than through a single large rewrite or a prompt-only wrapper.

Core goals:

- preserve and extend a functional local coding-agent foundation;
- make model, tool, permission, context, and multi-agent behavior observable;
- improve runtime reliability through explicit retry, timeout, cancellation, and recovery semantics;
- establish privacy-aware structured Trace and deterministic Evaluation / Regression;
- harden tools, permissions, sandbox boundaries, MCP integrations, and extension points;
- make parallel Agent and Worktree workflows explainable, recoverable, and mergeable;
- evolve toward a maintainable local Agent CLI without hiding compatibility or unfinished work.

## Project Status

Klaude-Code currently has two connected but distinct tracks:

| Track | Meaning | Current position |
|---|---|---|
| **Original Foundation Track** | The inherited and continued functional milestones that built the local coding-agent base | Stages 0–34 implemented/continued; Stages 35–36 planned |
| **Enterprise Harness Track** | Klaude-Code's independent work to harden that foundation for production-oriented use | E0 foundation established; E1 Trace foundation partially implemented; E2–E7 hardening targets; E8–E9 planned |

The current implementation already includes a terminal CLI, streaming model communication, local tools, permissions, sandboxing, sessions, context management, MCP, skills, sub-agents, background execution, Agent Teams, hooks, multi-provider support, multimodal input, and extended thinking controls.

The first Enterprise Harness slice is also implemented: Trace contracts and redaction, resilient local JSONL storage, and QueryEngine-level `query.started` / `query.finished` / `query.failed` / `query.aborted` events. Model-attempt Trace, tool/permission Trace, and Evaluation gates remain hardening and planned work.

The runtime still contains compatibility identifiers inherited from the original implementation, including the npm package name `easy-agent` and the executable name `agent`. A complete package, CLI, configuration, and user-data migration is intentionally tracked as a later E9 compatibility project; this README repositioning does not claim that migration is complete.

Klaude-Code should currently be understood as a serious open-source engineering project in active hardening, not as a finished end-user product.

## Architecture

Klaude-Code is built around a five-layer architecture:

```text
+---------------------------------------------------+
| 1. Interaction Layer                              |
|    Terminal UI, input handling, rendering         |
+---------------------------------------------------+
| 2. Orchestration Layer                            |
|    Multi-turn session flow, usage, commands       |
+---------------------------------------------------+
| 3. Core Agentic Loop                              |
|    Reason -> tool call -> observe -> continue     |
+---------------------------------------------------+
| 4. Tooling Layer                                  |
|    File, shell, search, web, MCP, local actions   |
+---------------------------------------------------+
| 5. Model Communication Layer                      |
|    Provider profiles and streaming LLM I/O        |
+---------------------------------------------------+
```

This separation makes the system easier to evolve:

- the **communication layer** handles provider selection, request translation, and streaming model I/O;
- the **tool layer** exposes actionable capabilities;
- the **agentic loop** drives single-turn autonomous execution;
- the **orchestration layer** manages multi-turn state and control flow;
- the **interaction layer** turns the runtime into a usable terminal product.

## Repository Layout

```text
Klaude-Code/
├── src/
│   ├── entrypoint/      # CLI bootstrap
│   ├── ui/              # React/Ink terminal interface
│   ├── core/            # agentic loop and query orchestration
│   ├── agents/          # sub-agent definitions, registry, and runners
│   ├── tools/           # local tools and tool registry
│   ├── services/        # provider API, MCP, and skills services
│   ├── permissions/     # permission and safety controls
│   ├── context/         # system prompt and context management
│   ├── sandbox/         # Bash sandbox profiles and wrapping
│   ├── session/         # session persistence and history
│   ├── state/           # UI/runtime stores for tasks, todos, agents
│   ├── types/           # shared domain types
│   └── utils/           # env, config, logging, helpers
├── step/                # tutorial-friendly foundation snapshots
├── docs/                # engineering and learning documentation
├── package.json
├── tsconfig.json
├── README.md
└── README.zh-CN.md
```

## Roadmap Overview

The roadmap has two layers:

1. **Original Foundation Track** — the inherited and continued functional milestones from the original Easy Agent implementation path.
2. **Klaude-Code Enterprise Harness Track** — independent hardening and evaluation work that makes those capabilities safer, more reliable, more observable, and easier to operate.

## Status Legend

- ✅ **Implemented** — supported by code, documentation, and focused verification.
- 🔧 **Hardening** — the capability exists; production-grade boundaries, recovery, observability, or governance are still being strengthened.
- 🚧 **In Progress** — an explicitly scoped implementation slice is currently underway.
- 📋 **Planned** — an agreed direction that is not in the current implementation cycle.
- 🔬 **Research Direction** — an experimental direction requiring evidence before commitment.

## Original Foundation Track

### Inherited Implementation Milestones

This track records the functional foundation inherited from and continued through the original Easy Agent implementation path. It is kept here both as project history and as a reproducible learning path. The track should not be read as a claim that every milestone was authored from scratch by the current repository maintainer.

| Phase | Area | Core Code | Status |
|---|---|---|---:|
| 0 | Project scaffold | `planned in step series` | ✅ Implemented |
| 1 | LLM communication layer | [`step/step1.js`](./step/step1.js) | ✅ Implemented |
| 2 | React/Ink terminal UI | [`step/step2.js`](./step/step2.js) | ✅ Implemented |
| 3 | Tool interface and first tool | [`step/step3.js`](./step/step3.js) | ✅ Implemented |
| 4 | Core agentic loop | [`step/step4.js`](./step/step4.js) | ✅ Implemented |
| 5 | Complete core toolset | [`step/step5.js`](./step/step5.js) | ✅ Implemented |
| 6 | System prompt and context engineering | [`step/step6.js`](./step/step6.js) | ✅ Implemented |
| 7 | Permission control system | [`step/step7.js`](./step/step7.js) | ✅ Implemented |
| 8 | QueryEngine multi-turn orchestration | [`step/step8.js`](./step/step8.js) | ✅ Implemented |
| 9 | Session persistence and restore | [`step/step9.js`](./step/step9.js) | ✅ Implemented |
| 10 | Project memory system | [`step/step10.js`](./step/step10.js) | ✅ Implemented |
| 11 | Context compaction | [`step/step11.js`](./step/step11.js) | ✅ Implemented |
| 12 | Fine-grained token budget management | [`step/step12.js`](./step/step12.js) | ✅ Implemented |
| 13 | Plan mode | [`step/step13.js`](./step/step13.js) | ✅ Implemented |
| 14 | TodoWrite session task tracking | [`step/step14.js`](./step/step14.js) | ✅ Implemented |
| 15 | Task management system (V2) | [`step/step15.js`](./step/step15.js) | ✅ Implemented |
| 16 | MCP protocol support | [`step/step16.js`](./step/step16.js) | ✅ Implemented |
| 17 | Skills system | [`step/step17.js`](./step/step17.js) | ✅ Implemented |
| 18 | Sandbox | [`step/step18.js`](./step/step18.js) | ✅ Implemented |
| 19 | Sub-Agent and agent definitions | [`step/step19.js`](./step/step19.js) | ✅ Implemented |
| 20 | Background agents and worktree isolation | [`step/step20.js`](./step/step20.js) | ✅ Implemented |
| 21 | Agent Teams / multi-agent collaboration | [`step/step21.js`](./step/step21.js) | ✅ Implemented |
| 22 | Hooks lifecycle system | [`step/step22.js`](./step/step22.js) | ✅ Implemented |
| 23 | Output styles and user commands | [`step/step23.js`](./step/step23.js) | ✅ Implemented |
| 24 | Rendering experience upgrades | [`step/step24.js`](./step/step24.js) | ✅ Implemented |
| 25 | Configuration system improvements | [`step/step25.js`](./step/step25.js) | ✅ Implemented |
| 26 | File history and rollback | [`step/step26.js`](./step/step26.js) | ✅ Implemented |
| 27 | Error handling and resilience | [`step/step27.js`](./step/step27.js) | ✅ Implemented |
| 28 | Pipe mode / non-interactive execution | [`step/step28.js`](./step/step28.js) | ✅ Implemented |
| 29 | Auto mode classifier | [`step/step29.js`](./step/step29.js) | ✅ Implemented |
| 30 | Multi-provider support | [`step/step30.js`](./step/step30.js) | ✅ Implemented |
| 31 | Core tool expansion: Web, MultiEdit, MCP resources, PowerShell | [`step/step31.js`](./step/step31.js) | ✅ Implemented |
| 32 | Multimodal input: images and screenshots | [`step/step32.js`](./step/step32.js) | ✅ Implemented |
| 33 | Built-in command completion | [`step/step33.js`](./step/step33.js) | ✅ Implemented |
| 34 | Extended Thinking control and display | [`step/step34.js`](./step/step34.js) | ✅ Implemented |
| 35 | Plugins and marketplace | `planned` | 📋 Planned |
| 36 | Packaging, publishing, and documentation | `planned` | 📋 Planned |

The [`step/`](./step/) directory contains tutorial-friendly milestone snapshots, so completed chapters can be studied from focused standalone files as well as from the main source tree.

Current foundation notes:

- Stage 33 is complete in source, article track, and the step snapshot series.
- Stage 34 is complete with three-state thinking controls, provider-aware requests and events, safe history replay, effort controls, and folded terminal display.
- Stage 35 and Stage 36 remain historical foundation-track plans; the Enterprise Track below refines the security, lifecycle, and operational work needed before public plugin distribution and packaging can be treated as production-ready.

## Klaude-Code Enterprise Harness Track

The Enterprise Harness Track is not a second claim that the foundation features do not exist. It is the next engineering layer: making existing features observable, recoverable, secure, evaluable, and maintainable. Most early phases are therefore marked **🔧 Hardening** rather than **📋 Planned**.

### E0 — Project Baseline & Engineering Governance

**Status:** ✅ Implemented · 🔧 Hardening

The project has established an independent continuation boundary, engineering notes, Task 1–3 Trace documentation, worktree isolation practices, and handoff material. The next governance work makes those practices repeatable for future contributors and agents.

Tasks:

- ✅ preserve upstream attribution and distinguish inherited foundation from independent continuation;
- ✅ document worktree isolation, branch boundaries, merge discipline, and safe cleanup;
- ✅ keep ADRs, event contracts, acceptance notes, and implementation teaching notes together;
- 🔧 standardize `Implemented`, `Hardening`, `In Progress`, `Planned`, and `Research Direction` reporting;
- 🔧 make change-impact review, focused verification, handoff, and merge evidence repeatable;
- 📋 establish public release, contribution, and maintenance conventions.

### E1 — Observability & Trace Foundation

**Status:** 🚧 In Progress

Task 1–3 established the first local structured Trace slice. The remaining E1 work connects existing model, retry, tool, and permission boundaries to the same evidence model; it does not reimplement those runtime features.

Tasks:

- ✅ define the Trace event contract and shared identifiers;
- ✅ redact sensitive values and keep lifecycle payloads content-minimal;
- ✅ append and read local JSONL with ordering, path control, and failure isolation;
- ✅ record QueryEngine `query.started`, `query.finished`, `query.failed`, and `query.aborted`;
- 🔧 record model request, completion, failure, retry, and stream-restart metadata;
- 🔧 record tool and permission decisions through safe summaries;
- 🔧 validate schema versions, sequence monotonicity, and query/span relationships;
- 🔧 preserve a common `traceId` across the top-level query and nested runtime spans;
- 📋 add a Trace inspection/export CLI and diagnostic bundle format;
- 📋 define Trace schema migration and retention rules.

Current evidence: see the current documentation under [`docs/`](./docs/) for the Task 1–3 contract, storage, privacy, and QueryEngine lifecycle work. The current lifecycle payloads do not record prompt contents, system prompts, message bodies, tool input/output contents, stdout/stderr, or API keys.

### Documentation

The project keeps documentation intentionally simple:

```text
docs/
├── README.md                         # single documentation entry point
├── trace-*.md / task-*.md            # current engineering documents
├── learning/                         # learning and interview notes
└── archive/                          # historical plans and retired indexes
```

New active task and engineering documents go directly under `docs/`. Do not create additional `engineering/`, `adr/`, `specs/`, `evaluation/`, `dev-docs/`, or `roadmap/` subdirectories. Use `docs/learning/` only for learning/interview material and `docs/archive/` only for historical or superseded documents. Start with [`docs/README.md`](./docs/README.md).

### E2 — Runtime Reliability & Recovery Hardening

**Status:** 🔧 Hardening

The foundation already includes API error classification, retryability decisions, streaming retry behavior, abort handling, resilience paths, and context-overflow handling. E2 consolidates their semantics and adds evidence-backed recovery guarantees.

Tasks:

- 🔧 consolidate transient/permanent error categories and retry policy;
- 🔧 make attempt numbering, retry budgets, backoff, and `Retry-After` behavior explicit;
- 🔧 trace existing retry and stream-restart decisions without leaking request content;
- 🔧 define streaming recovery for connection loss, partial output, and duplicate output risk;
- 🔧 unify abort, timeout, foreground, background, and resource-release semantics;
- 🔧 distinguish model, API, context, tool, and permission failures in one recovery state model;
- 🔧 define idempotency boundaries before retrying irreversible tool actions;
- 📋 recover sessions after process interruption or crash;
- 📋 measure success rate, recovery rate, retry cost, and tail latency;
- 🔬 investigate adaptive recovery policies only after deterministic policies have evidence.

### E3 — Tool & Permission Safety Hardening

**Status:** 🔧 Hardening

Tools, permission modes, Auto Mode, and sandbox controls already exist. E3 turns them into a more consistently governed and auditable safety boundary.

Tasks:

- 🔧 harden tool input schemas, parameter validation, and output-size limits;
- 🔧 make allow, deny, ask, block, and bypass semantics consistent across entrypoints;
- 🔧 trace permission decisions and reasons without recording sensitive content;
- 🔧 classify dangerous commands, paths, privilege changes, and external side effects;
- 🔧 verify sandbox working-directory, path-traversal, process, timeout, and output boundaries;
- 🔧 define the trust boundary for MCP servers and externally supplied tools;
- 🔧 prevent secrets from appearing in environment handling, errors, logs, or Trace;
- 🔧 convert real safety failures into focused security regressions;
- 📋 add a security-policy diagnostic command and auditable high-risk approval evidence;
- 🔬 investigate risk scoring only if it cannot bypass explicit user permission policy.

### E4 — Context, Memory & Cost Governance

**Status:** 🔧 Hardening

Context loading, compaction, memory, project instructions, session history, and token budgets already exist. E4 makes their information-flow and cost behavior explainable and testable.

Tasks:

- 🔧 record context provenance and why each source is eligible for inclusion;
- 🔧 clarify boundaries among system prompt, project instructions, memory, session history, tools, and attachments;
- 🔧 evaluate whether compaction preserves task-critical constraints and decisions;
- 🔧 unify manual and automatic compaction semantics and failure handling;
- 🔧 protect memory retrieval from stale, irrelevant, or contaminated entries;
- 🔧 account for input/output/cache usage and model-call cost;
- 🔧 govern context budgets for long conversations, tool output, files, and images;
- 🔧 recover predictably from context overflow or compaction failure;
- 📋 add context and memory inspection commands plus evaluation fixtures;
- 🔬 investigate task-aware dynamic context budgets only after provenance and regression evidence exist.

### E5 — Evaluation, Replay & Quality Gates

**Status:** 📋 Planned

E5 closes the loop by consuming structured Trace instead of judging only the final text. It begins after the runtime evidence model is stable enough to produce meaningful fixtures.

Tasks:

- 📋 validate Trace schema, sequence order, lifecycle completeness, and privacy invariants;
- 📋 evaluate model retry, stream recovery, final failure, and abort behavior;
- 📋 evaluate permission decisions and tool-call safety boundaries;
- 📋 evaluate context loading, compaction, memory retrieval, and budget behavior;
- 📋 create deterministic replayable Trace fixtures;
- 📋 compare behavior changes across commits and produce machine-readable results;
- 📋 add a minimal pre-merge regression gate for high-value invariants;
- 📋 generate human-readable Evaluation reports with failure explanations;
- 🔬 investigate outcome-quality evaluation only after process-level checks are deterministic.

### E6 — Multi-Agent & Worktree Orchestration

**Status:** 🔧 Hardening

Sub-Agents, background execution, Agent Teams, and Worktree isolation already provide parallel execution primitives. E6 adds ownership, baseline, recovery, merge, and handoff discipline around them.

Tasks:

- 🔧 decompose work into independently verifiable tasks with explicit outputs;
- 🔧 declare file ownership and preflight overlapping write plans;
- 🔧 choose `fresh`, `head`, or a specific commit as an explicit worktree baseline;
- 🔧 document Subagent snapshot semantics and information handoff;
- 🔧 separate worker test evidence from main-session post-merge verification;
- 🔧 recover from agent timeout, blockage, partial completion, and failed cleanup;
- 🔧 audit uncommitted, untracked, unmerged, and unpublished work before removing worktrees;
- 🔧 preserve handoff status, artifacts, tests, and next actions;
- 📋 automate ownership/conflict checks and parallel-task dependency graphs;
- 🔬 investigate risk-aware concurrency decisions only after ownership and merge evidence are reliable.

### E7 — Extension & Plugin Ecosystem Hardening

**Status:** 🔧 Hardening

Skills, Hooks, MCP, Agent definitions, and future plugins already form several extension points. E7 establishes shared lifecycle and capability boundaries before expanding distribution.

Tasks:

- 🔧 define consistent extension contracts across Skills, Hooks, MCP, Agents, and Plugins;
- 🔧 isolate extension load, runtime, timeout, and failure behavior;
- 🔧 govern extension capabilities through explicit permissions;
- 🔧 define compatibility and version checks;
- 🔧 preserve provenance for locally loaded or externally supplied extensions;
- 📋 add a local extension registry with install, update, disable, and diagnosis workflows;
- 📋 define plugin metadata and distribution requirements;
- 📋 assess Marketplace readiness only after security, lifecycle, and compatibility gates pass;
- 🔬 investigate extension sandboxing and capability scoring.

### E8 — Developer Experience & Diagnostics

**Status:** 📋 Planned · 🔬 Research Direction

E8 turns internal evidence into information that helps a developer understand and recover from a run.

Tasks:

- 📋 explain configuration sources, precedence, and effective settings;
- 📋 improve `/doctor` coverage for provider, permissions, sandbox, MCP, sessions, and dependencies;
- 📋 show understandable retry, permission, compaction, and recovery feedback;
- 📋 provide session resume and failure-recovery guidance;
- 📋 add Trace summaries, execution timelines, usage/cost inspection, and failure bundles;
- 📋 make diagnostic output safe to share without exposing prompts, secrets, or file contents;
- 🔬 investigate proactive diagnostics based on repeated, evidence-backed failure patterns.

### E9 — Packaging, Compatibility & Operational Readiness

**Status:** 📋 Planned · 🔬 Research Direction

E9 is where the runtime identity can be migrated carefully. It is intentionally not part of this README-only repositioning.

Tasks:

- 📋 migrate the package identity from `easy-agent` toward `klaude-code` with a compatibility plan;
- 📋 decide whether `agent` remains a compatibility alias or receives a staged migration;
- 📋 migrate configuration, session, memory, and Trace directories without data loss;
- 📋 verify Windows, macOS, and Linux installation and runtime behavior;
- 📋 automate versioning, builds, release artifacts, and publication checks;
- 📋 provide upgrade, rollback, and configuration migration paths;
- 📋 complete installation, architecture, troubleshooting, and contributor documentation;
- 📋 establish public contribution readiness after maintainership and quality gates mature;
- 🔬 investigate distribution and sandbox differences across operating systems.

## Current Enterprise Position

```text
Original Foundation Track
  Stages 0–34  ✅ Implemented / continued
  Stages 35–36 📋 Planned

Enterprise Harness Track
  E0 Governance       ✅ Implemented · 🔧 Hardening
  E1 Trace            🚧 In Progress (Task 1–3 implemented; runtime expansion next)
  E2 Reliability      🔧 Hardening
  E3 Safety           🔧 Hardening
  E4 Context/Memory   🔧 Hardening
  E5 Evaluation       📋 Planned
  E6 Multi-Agent      🔧 Hardening
  E7 Extensions       🔧 Hardening
  E8 Diagnostics      📋 Planned · 🔬 Research Direction
  E9 Release          📋 Planned · 🔬 Research Direction
```

The current position is deliberately narrower than the long-term vision: Klaude-Code has a functional local coding-agent foundation and a partially implemented structured Trace foundation. The Enterprise Harness Track is an active hardening and evaluation program, not a claim that the project is already a finished production replacement for Claude Code or Codex.

## What Klaude-Code Is — and Is Not

**Klaude-Code is:**

- an independently maintained continuation built on an open-source foundation;
- a systems-engineering project for a local coding Agent Harness;
- a functional Agent CLI with an expanding reliability, safety, observability, and evaluation layer;
- a public record of implementation, hardening decisions, experiments, and lessons learned.

**Klaude-Code is not:**

- the official `ConardLi/easy-agent` repository;
- a claim that all inherited milestones were authored from scratch in this repository;
- a one-file demo or a prompt-only wrapper around an API;
- a finished production replacement for Claude Code or Codex;
- a public mirror of any private course material.

## Getting Started

### Requirements

- Node.js 22+
- npm
- Access to at least one supported model provider: Anthropic, OpenAI-compatible APIs, Gemini, or a local OpenAI-compatible endpoint such as Ollama

### Model Providers

Klaude-Code supports multiple providers by default. Anthropic model names still work directly, while OpenAI-compatible and Gemini models are configured as named profiles in `settings.json` and selected with `--model` or `/model`.

Example user or project settings:

```json
{
  "defaultModel": "gpt",
  "models": {
    "gpt": {
      "protocol": "openai-chat",
      "model": "gpt-5.1",
      "baseURL": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}"
    },
    "gemini": {
      "protocol": "gemini",
      "model": "gemini-2.5-pro",
      "apiKey": "${GEMINI_API_KEY}"
    },
    "ollama": {
      "protocol": "openai-chat",
      "model": "qwen2.5-coder",
      "baseURL": "http://localhost:11434/v1"
    }
  }
}
```

Common environment variables:

- `ANTHROPIC_AUTH_TOKEN` — Anthropic API token for raw Claude model names
- `ANTHROPIC_BASE_URL` — optional Anthropic-compatible API base URL
- `ANTHROPIC_MODEL` — legacy/default raw Anthropic model name
- `OPENAI_API_KEY` — OpenAI-compatible API key used by `${OPENAI_API_KEY}` profiles
- `GEMINI_API_KEY` — Gemini API key used by `${GEMINI_API_KEY}` profiles
- `WEB_SEARCH_API_KEY` — optional web search provider key

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

### Example CLI Options

The current compatibility executable remains `agent`:

```bash
agent --help
agent --model claude-sonnet-4-20250514
agent --model gpt
agent --model gemini
echo "summarize this repo" | agent --print --output-format json
agent --plan
agent --auto
agent --dump-system-prompt
```

## Near-Term Priorities

The near-term priorities follow the Enterprise Harness Track rather than treating the original foundation as finished product work:

1. continue the E1 Trace slice with model-attempt and tool/permission events;
2. harden existing retry, streaming, permission, sandbox, context, memory, and Worktree behavior;
3. design the first deterministic Trace-based Evaluation fixtures;
4. document each hardening slice with its boundary, evidence, and regression result;
5. keep Stage 35–36 plugin and packaging work behind the required lifecycle, security, compatibility, and release gates.

## Contribution Policy

Klaude-Code is **not accepting external contributions at this stage**.

The project is still in active hardening. Runtime behavior, package identity, directory layout, and development conventions may change as the Enterprise Harness Track produces evidence. External contributions will be considered after the project has a stable contribution model, quality gates, security boundaries, and release process.

Until then, you are welcome to follow the public roadmap, study the implementation, and reference the upstream project. Pull requests and outside code contributions are intentionally postponed for now.

## License

MIT
