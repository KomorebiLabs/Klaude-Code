import assert from "node:assert/strict";
import {
  buildContextManifest,
  createContextAssembledPayload,
  type ContextSourceInput,
} from "../context/provenance/index.js";
import {
  buildSystemPromptBundle,
  renderSystemPrompt,
} from "../context/systemPrompt.js";
import {
  buildCompactionInvariantSnapshot,
  validateCompactionInvariantRetention,
} from "../context/compactionInvariants.js";
import { compactMessages } from "../context/compaction.js";
import { analyzeTraceArtifact } from "../diagnostics/traceAnalysis.js";

const fakeSecret = "ctx-secret-should-never-escape";

const sources: ContextSourceInput[] = [
  {
    sourceId: "project-instructions",
    category: "project_instructions",
    eligibility: "workspace-policy",
    content: `private project policy ${fakeSecret}`,
    loaded: true,
  },
  {
    sourceId: "memory-index",
    category: "memory_index",
    eligibility: "user-disabled",
    content: `private memory ${fakeSecret}`,
    loaded: false,
    omittedReason: "user-disabled",
  },
];

const manifest = buildContextManifest(sources, {
  contextWindow: 200_000,
  effectiveContextWindow: 180_000,
});

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.sources.length, 2);
assert.equal(manifest.sources[0]?.category, "project_instructions");
assert.equal(manifest.sources[0]?.loaded, true);
assert.ok((manifest.sources[0]?.estimatedTokens ?? 0) > 0);
assert.equal(manifest.sources[1]?.omittedReason, "user-disabled");
assert.equal(manifest.sources[1]?.estimatedTokens, 0);
assert.equal(
  manifest.loadedEstimatedTokens,
  manifest.sources[0]?.estimatedTokens,
);
assert.equal(manifest.contextWindow, 200_000);
assert.equal(manifest.effectiveContextWindow, 180_000);

const serialized = JSON.stringify(manifest);
assert.ok(!serialized.includes(fakeSecret));
assert.ok(!serialized.includes("private project policy"));
assert.ok(!serialized.includes("private memory"));

const tracePayload = createContextAssembledPayload(manifest);
assert.equal(tracePayload.contentOmitted, true);
assert.equal(tracePayload.loadedSourceCount, 1);
assert.equal(tracePayload.omittedSourceCount, 1);
assert.ok(Array.isArray(tracePayload.categories));
assert.ok(!JSON.stringify(tracePayload).includes(fakeSecret));
const contextTrace = analyzeTraceArtifact({
  status: "available",
  reference: "context-trace.jsonl",
  ignoredLineCount: 0,
  events: [
    {
      schemaVersion: 1,
      eventId: "event-1",
      traceId: "trace-1",
      sequence: 1,
      timestamp: "2026-08-24T00:00:00.000Z",
      eventType: "context.assembled",
      payload: tracePayload,
    },
    {
      schemaVersion: 1,
      eventId: "event-2",
      traceId: "trace-1",
      sequence: 2,
      timestamp: "2026-08-24T00:00:01.000Z",
      eventType: "query.finished",
      payload: {},
    },
  ],
});
assert.equal(contextTrace.summary.contextManifestCount, 1);
assert.equal(contextTrace.summary.contextLoadedSourceCount, 1);
assert.equal(
  contextTrace.summary.contextEstimatedTokens,
  manifest.loadedEstimatedTokens,
);

const promptBundle = await buildSystemPromptBundle({
  cwd: process.cwd(),
  additionalInstructions: `session rule ${fakeSecret}`,
  userQuery: "ignore memory for this request",
});
assert.ok(renderSystemPrompt(promptBundle.parts).includes(fakeSecret));
assert.ok(
  promptBundle.manifest.sources.some(
    (source) =>
      source.category === "session_instructions" && source.loaded,
  ),
);
const memoryIndex = promptBundle.manifest.sources.find(
  (source) => source.category === "memory_index",
);
assert.equal(memoryIndex?.loaded, false);
assert.equal(memoryIndex?.omittedReason, "user-disabled");
assert.ok(!JSON.stringify(promptBundle.manifest).includes(fakeSecret));

const invariantMessages = [
  {
    role: "user" as const,
    content: "You must preserve permission deny. Do not edit user notes.",
  },
  { role: "assistant" as const, content: "Understood." },
];
const invariantSnapshot = buildCompactionInvariantSnapshot(invariantMessages);
assert.ok(invariantSnapshot.items.length >= 2);
assert.match(invariantSnapshot.digest, /^[a-f0-9]{16}$/);
const retainedSummary = invariantSnapshot.items
  .map((item) => `[invariant:${item.id}] ${item.text}`)
  .join("\n");
assert.equal(
  validateCompactionInvariantRetention(retainedSummary, invariantSnapshot),
  true,
);
assert.equal(
  validateCompactionInvariantRetention("generic summary", invariantSnapshot),
  false,
);

const failedCompaction = await compactMessages(invariantMessages, undefined, {
  force: true,
  createMessageImpl: async () => ({
    content: [{ type: "text", text: "generic summary" }],
    usage: { input_tokens: 1, output_tokens: 1 },
    stopReason: "end_turn",
  }),
});
assert.equal(failedCompaction.didCompact, false);
assert.equal(failedCompaction.invariantRetention, "failed");
assert.deepEqual(failedCompaction.messages, invariantMessages);

const successfulCompaction = await compactMessages(invariantMessages, undefined, {
  force: true,
  createMessageImpl: async () => ({
    content: [{ type: "text", text: retainedSummary }],
    usage: { input_tokens: 1, output_tokens: 1 },
    stopReason: "end_turn",
  }),
});
assert.equal(successfulCompaction.didCompact, true);
assert.equal(successfulCompaction.invariantRetention, "passed");

console.log("context provenance and budget tests passed");
