export interface EvidenceMatrixEntry {
  invariantId: string;
  claim: string;
  command: string;
  evidenceFile: string;
}

export const R1_CORE_EVIDENCE_MATRIX: EvidenceMatrixEntry[] = [
  { invariantId: "trace.schema-sequence-lifecycle", claim: "Trace v1 sequence and lifecycle are valid", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "privacy.fake-secret-omitted", claim: "Fake secrets and runtime content are omitted", command: "npm run test:trace && npm run test:evaluation", evidenceFile: "src/scripts/test-trace.ts, src/scripts/test-evaluation.ts" },
  { invariantId: "permission.deny-zero-execution", claim: "Denied tools are not executed", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "permission.deny-precedence-zero-execution", claim: "Explicit deny cannot be upgraded by hooks, bypass, or allow rules", command: "npm run test:tool-permission-contract", evidenceFile: "src/scripts/test-tool-permission-contract.ts" },
  { invariantId: "permission.input-validation-zero-side-effect", claim: "Invalid tool input fails before hooks, prompts, backups, or execution", command: "npm run test:tool-permission-contract", evidenceFile: "src/scripts/test-tool-permission-contract.ts, src/tools/inputValidation.ts" },
  { invariantId: "permission.entrypoint-resolution", claim: "Ask resolution is explicit for interactive and headless entry points", command: "npm run test:tool-permission-contract && npm run test:trace", evidenceFile: "src/scripts/test-tool-permission-contract.ts, src/observability/toolLifecycle.ts" },
  { invariantId: "tool.execution-at-most-once-per-query", claim: "A tool_use id executes at most once within one query", command: "npm run test:tool-permission-contract && npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-tool-permission-contract.ts, src/core/agenticLoop.ts" },
  { invariantId: "writer.failure-isolation", claim: "Writer degradation and close timeout do not alter the main result", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "retry.error-taxonomy", claim: "Provider failures map to the common retry taxonomy", command: "npm run test:resilience", evidenceFile: "src/scripts/smoke-resilience.ts" },
  { invariantId: "retry.bounded-policy", claim: "Attempts, backoff, Retry-After, and wait budget are bounded", command: "npm run test:resilience", evidenceFile: "src/scripts/smoke-resilience.ts" },
  { invariantId: "retry.partial-output-no-replay", claim: "Visible partial output prevents stream attempt replay", command: "npm run test:resilience", evidenceFile: "src/scripts/smoke-resilience.ts" },
  { invariantId: "provider.common-semantics", claim: "Supported providers normalize tool use, usage, and stop reason", command: "npm run test:providerstream", evidenceFile: "src/scripts/test-providerstream-characterization.ts, src/scripts/__golden__/providerstream-characterization.golden.txt" },
  { invariantId: "provider.protocol-error-safe", claim: "Protocol failures are classified without exposing raw provider bodies", command: "npm run test:providerstream", evidenceFile: "src/scripts/test-providerstream-characterization.ts" },
  { invariantId: "lifecycle.abort-no-new-action", claim: "Abort starts no new model, compaction, tool, or hook action", command: "npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-recovery-lifecycle.ts" },
  { invariantId: "lifecycle.timeout-bounded-cleanup", claim: "Model attempt deadlines and cleanup are bounded", command: "npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-recovery-lifecycle.ts, src/services/api/requestLifecycle.ts" },
  { invariantId: "stream.partial-output-no-restart", claim: "Partial output prevents replay and reactive restart", command: "npm run test:resilience && npm run test:recovery-lifecycle", evidenceFile: "src/scripts/smoke-resilience.ts, src/scripts/test-recovery-lifecycle.ts" },
  { invariantId: "context.single-reactive-recovery", claim: "Prompt-too-long recovery compacts and restarts at most once", command: "npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-recovery-lifecycle.ts" },
  { invariantId: "trace.single-terminal-event", claim: "Each query outcome maps to one matching terminal trace event", command: "npm run test:trace && npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-trace.ts, src/scripts/test-recovery-lifecycle.ts" },
  { invariantId: "filesystem.canonical-containment", claim: "Canonical path checks block symlink and junction escape", command: "npm run test:external-safety", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/tools/pathUtils.ts" },
  { invariantId: "sandbox.permission-no-upgrade", claim: "Sandbox availability never upgrades deny or ask authorization", command: "npm run test:external-safety && npm run test:tool-permission-contract", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/scripts/test-tool-permission-contract.ts" },
  { invariantId: "process.timeout-bounded-cleanup", claim: "Local process output and termination settlement are bounded", command: "npm run test:external-safety && npm run test:recovery-lifecycle", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/tools/processLifecycle.ts" },
  { invariantId: "mcp.permission-deny-no-request", claim: "Denied MCP tools issue no transport request", command: "npm run test:external-safety && npm run test:tool-permission-contract", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/services/mcp/fetchTools.ts" },
  { invariantId: "mcp.timeout-failure-isolation", claim: "MCP requests have timeout, abort, content, and connection isolation", command: "npm run test:external-safety && npm run test:mcp", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/services/mcp/safety.ts" },
  { invariantId: "diagnostics.fake-secret-absent", claim: "Known secret forms are absent from diagnostics artifacts", command: "npm run test:external-safety && npm run test:trace && npm run test:evaluation", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/observability/redaction.ts" },
  { invariantId: "external.trace-allowlist", claim: "External execution trace records allowlisted structure only", command: "npm run test:external-safety && npm run test:trace", evidenceFile: "src/scripts/test-external-safety-contract.ts, src/observability/toolLifecycle.ts" },
];

/** Post-R1 evidence grows independently so the frozen 25-item R1 release remains reproducible. */
export const POST_R1_EVIDENCE_MATRIX: EvidenceMatrixEntry[] = [
  { invariantId: "diagnostics.failure-explanation", claim: "Trace evidence explains retry, restart, permission, tool, and query outcomes with bounded recovery guidance", command: "npm run test:diagnostics", evidenceFile: "src/scripts/test-diagnostics.ts, src/diagnostics/traceAnalysis.ts" },
  { invariantId: "diagnostics.artifact-failure-isolation", claim: "Missing, malformed, truncated, or linked artifacts cannot break Doctor or diagnostic report generation", command: "npm run test:diagnostics", evidenceFile: "src/scripts/test-diagnostics.ts, src/diagnostics/artifactReader.ts" },
  { invariantId: "diagnostics.safe-share-output", claim: "Text and JSON diagnostics omit raw payloads, fake secrets, and absolute project paths", command: "npm run test:diagnostics", evidenceFile: "src/scripts/test-diagnostics.ts, src/diagnostics/render.ts" },
];
