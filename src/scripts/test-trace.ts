import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  createSafeMessage,
  createTraceWriter,
  applyTraceRetentionPolicy,
  createQueryAbortedPayload,
  createQueryFailedPayload,
  createQueryFinishedPayload,
  createQueryStartedPayload,
  getTracePath,
  readTraceEvents,
  redactForTrace,
  summarizeToolInput,
  summarizeToolResult,
} from "../observability/index.js";
import { configureSessionPersistence } from "../session/storage.js";

const secret = "sk-test-very-secret";
const redacted = redactForTrace({
  apiKey: secret,
  authorization: "Bearer abcdef",
  nested: { password: "hunter2" },
  note: `failed with ${secret}`,
});
assert.equal(JSON.stringify(redacted).includes(secret), false);
assert.equal(JSON.stringify(redacted).includes("abcdef"), false);
assert.equal(JSON.stringify(redacted).includes("hunter2"), false);

for (const unsafeMessage of [
  "password=hunter2",
  "apiKey: abc123",
  "Authorization: Basic abc123",
  "Authorization=Basic abc123",
  'Authorization: Digest username="u", response="abc123"',
  'Authorization: OAuth oauth_token="tok123", oauth_signature="sig456"',
  "env=supersecret",
  '{"apiKey":"abc123","password":"hunter2","token":"ghp_secret"}',
  '{"Authorization":"Basic abc123"}',
  '{"password":"abc\\"def","token":"tok"}',
  '{\\"apiKey\\":\\"abc123\\",\\"password\\":\\"hunter2\\",\\"token\\":\\"ghp_secret\\"}',
  '{\\"Authorization\\":\\"Basic abc123\\"}',
  "private key: abc123",
]) {
  const safeMessage = createSafeMessage(unsafeMessage);
  assert.equal(safeMessage.includes("hunter2"), false);
  assert.equal(safeMessage.includes("abc123"), false);
  assert.equal(safeMessage.includes("ghp_secret"), false);
  assert.equal(safeMessage.includes("supersecret"), false);
}

const circularInput: Record<string, unknown> = { apiKey: secret, count: 1n };
circularInput.self = circularInput;
const circularRedacted = redactForTrace(circularInput);
const circularJson = JSON.stringify(circularRedacted);
assert.equal(circularJson.includes(secret), false);
assert.equal(circularJson.includes("[Circular]"), true);
assert.doesNotThrow(() => summarizeToolInput(circularInput));

const circularArray: unknown[] = [];
circularArray.push(circularArray);
assert.deepEqual(redactForTrace(circularArray), ["[Circular]"]);

const circularSummary = summarizeToolInput(circularInput);
assert.deepEqual(circularSummary.fieldNames, ["apiKey", "count", "self"]);
assert.equal(typeof circularSummary.serializedLength, "number");
assert.equal(circularSummary.contentOmitted, true);

const resultText = `tool output included ${secret}`;
const resultSummary = summarizeToolResult({ outcome: "success", text: resultText, truncated: true });
assert.equal(resultSummary.textLength, resultText.length);
assert.equal(resultSummary.contentOmitted, true);
assert.equal(resultSummary.truncated, true);
assert.equal("text" in resultSummary, false);
assert.equal(JSON.stringify(resultSummary).includes(secret), false);

const summary = summarizeToolInput({ command: "npm test", apiKey: secret, path: "src/x.ts" });
assert.deepEqual(summary.fieldNames, ["apiKey", "command", "path"]);
assert.equal(summary.contentOmitted, true);
assert.equal("command" in summary, false);

assert.equal(createSafeMessage(`Authorization: Bearer abcdef ${"x".repeat(1_000)}`).includes("abcdef"), false);
assert.ok(createSafeMessage("x".repeat(1_000)).length <= 500);

const startedPayload = createQueryStartedPayload({
  model: "claude-test",
  permissionMode: "default",
  messageCount: 3,
  promptLength: 42,
  hasUserPrompt: true,
});
assert.deepEqual(startedPayload, {
  model: "claude-test",
  permissionMode: "default",
  messageCount: 3,
  promptLength: 42,
  hasUserPrompt: true,
  contentOmitted: true,
});

const finishedPayload = createQueryFinishedPayload({
  reason: "end_turn",
  messageCount: 4,
  usage: {
    input_tokens: 11,
    output_tokens: 7,
    cache_creation_input_tokens: 5,
    cache_read_input_tokens: 3,
  },
});
assert.deepEqual(finishedPayload, {
  reason: "end_turn",
  messageCount: 4,
  inputTokens: 11,
  outputTokens: 7,
  cacheCreationInputTokens: 5,
  cacheReadInputTokens: 3,
});

const failedPayload = createQueryFailedPayload(new Error("password=hunter2 Authorization: Bearer abcdef"));
assert.equal(JSON.stringify(failedPayload).includes("hunter2"), false);
assert.equal(JSON.stringify(failedPayload).includes("abcdef"), false);
assert.equal(failedPayload.errorCategory, "Error");

const abortedPayload = createQueryAbortedPayload();
assert.deepEqual(abortedPayload, { reason: "abort_signal" });

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "easy-agent-trace-test-"));
const traceCwd = path.join(storageRoot, "project");
await fs.mkdir(traceCwd, { recursive: true });
const traceId = "trace-test";

configureSessionPersistence(true);
const tracePath = await getTracePath(traceCwd, traceId);
await fs.rm(tracePath, { force: true });
const traversalPath = await getTracePath(traceCwd, "../escape");
assert.equal(path.dirname(traversalPath), path.dirname(tracePath));
const writer = await createTraceWriter(traceCwd, traceId);
writer.emit("query.started", { model: "test-model" });
writer.emit("query.finished", { outcome: "success" });
await writer.close();
assert.equal((await fs.readFile(tracePath, "utf8")).trim().split("\n").length, 2);
const events = await readTraceEvents(tracePath);
assert.deepEqual(events.map((event) => event.eventType), ["query.started", "query.finished"]);

for (const terminalEvent of ["query.failed", "query.aborted"] as const) {
  const terminalTraceId = `trace-${terminalEvent.replace(".", "-")}`;
  const terminalWriter = await createTraceWriter(traceCwd, terminalTraceId);
  terminalWriter.emit("query.started", { content: "password=hunter2" });
  terminalWriter.emit(terminalEvent, { reason: terminalEvent });
  await terminalWriter.close();
  const terminalEvents = await readTraceEvents(await getTracePath(traceCwd, terminalTraceId));
  assert.deepEqual(terminalEvents.map((event) => event.eventType), ["query.started", terminalEvent]);
  assert.equal(JSON.stringify(terminalEvents).includes("hunter2"), false);
}

await fs.appendFile(tracePath, '{"schemaVersion":1,"eventType":"truncated"\n', "utf8");
assert.equal((await readTraceEvents(tracePath)).length, 2);
await fs.appendFile(
  tracePath,
  `${JSON.stringify({
    schemaVersion: 2,
    eventId: "future-event",
    traceId,
    sequence: 3,
    timestamp: new Date().toISOString(),
    eventType: "query.finished",
    payload: {},
  })}\n`,
  "utf8",
);
assert.equal((await readTraceEvents(tracePath)).length, 2);

configureSessionPersistence(false);
const independentTraceId = "trace-session-independent";
const independentWriter = await createTraceWriter(traceCwd, independentTraceId);
independentWriter.emit("query.started", {});
await independentWriter.close();
await assert.doesNotReject(fs.access(await getTracePath(traceCwd, independentTraceId)));
assert.equal(independentWriter.getStatus().state, "active");
configureSessionPersistence(true);

const disabledTraceId = "trace-explicitly-disabled";
const disabledWriter = await createTraceWriter(traceCwd, disabledTraceId, { enabled: false });
disabledWriter.emit("query.started", {});
await disabledWriter.close();
assert.deepEqual(disabledWriter.getStatus(), {
  state: "disabled",
  reason: "explicitly_disabled",
  droppedEvents: 0,
});
await assert.rejects(fs.access(await getTracePath(traceCwd, disabledTraceId)));

const hangingWriter = await createTraceWriter(traceCwd, "trace-close-timeout", {
  closeTimeoutMs: 20,
  appendFile: async () => new Promise<void>(() => {}),
});
hangingWriter.emit("query.started", {});
const closeStartedAt = Date.now();
await hangingWriter.close();
assert.ok(Date.now() - closeStartedAt < 250);
assert.deepEqual(hangingWriter.getStatus(), {
  state: "degraded",
  reason: "close_timeout",
  droppedEvents: 1,
});

const writeFailureWriter = await createTraceWriter(traceCwd, "trace-write-failure", {
  appendFile: async () => {
    throw new Error("password=hunter2");
  },
});
writeFailureWriter.emit("query.started", {});
await writeFailureWriter.close();
assert.deepEqual(writeFailureWriter.getStatus(), {
  state: "degraded",
  reason: "write_failed",
  droppedEvents: 1,
});
assert.equal(JSON.stringify(writeFailureWriter.getStatus()).includes("hunter2"), false);

const failingCwd = path.join(storageRoot, "failing-project");
const failingWriter = await createTraceWriter(failingCwd, "trace-failure");
const failingTracePath = await getTracePath(failingCwd, "trace-failure");
await fs.rm(path.dirname(failingTracePath), { recursive: true, force: true });
assert.doesNotThrow(() => failingWriter.emit("query.started", { apiKey: "secret" }));
await assert.doesNotReject(() => failingWriter.close());

const retentionCwd = path.join(storageRoot, "retention-project");
const retainedTracePath = await getTracePath(retentionCwd, "retained");
const traceDir = path.dirname(retainedTracePath);
await fs.mkdir(traceDir, { recursive: true });
const oldPath = path.join(traceDir, "old.jsonl");
const quotaOldestPath = path.join(traceDir, "quota-oldest.jsonl");
const newestPath = path.join(traceDir, "newest.jsonl");
const outsidePath = path.join(path.dirname(traceDir), "outside.jsonl");
await fs.writeFile(oldPath, "old");
await fs.writeFile(quotaOldestPath, "a".repeat(20));
await fs.writeFile(newestPath, "b".repeat(20));
await fs.writeFile(outsidePath, "outside");
const nowMs = Date.now();
await fs.utimes(oldPath, new Date(nowMs - 20 * 24 * 60 * 60 * 1000), new Date(nowMs - 20 * 24 * 60 * 60 * 1000));
await fs.utimes(quotaOldestPath, new Date(nowMs - 2_000), new Date(nowMs - 2_000));
await fs.utimes(newestPath, new Date(nowMs - 1_000), new Date(nowMs - 1_000));
const retention = await applyTraceRetentionPolicy(retentionCwd, {
  maxAgeDays: 10,
  maxBytes: 25,
  nowMs,
});
assert.equal(retention.deletedByAge, 1);
assert.equal(retention.deletedByQuota, 1);
assert.equal(retention.failures, 0);
await assert.rejects(fs.access(oldPath));
await assert.rejects(fs.access(quotaOldestPath));
await assert.doesNotReject(fs.access(newestPath));
await assert.doesNotReject(fs.access(outsidePath));

const unsafeCwd = path.join(storageRoot, "unsafe-retention-project");
const unsafeTracePath = await getTracePath(unsafeCwd, "unsafe");
const unsafeTraceDir = path.dirname(unsafeTracePath);
const externalTraceDir = path.join(storageRoot, "external-traces");
await fs.mkdir(path.dirname(unsafeTraceDir), { recursive: true });
await fs.mkdir(externalTraceDir, { recursive: true });
await fs.writeFile(path.join(externalTraceDir, "must-survive.jsonl"), "external");
try {
  await fs.symlink(externalTraceDir, unsafeTraceDir, process.platform === "win32" ? "junction" : "dir");
  const unsafeRetention = await applyTraceRetentionPolicy(unsafeCwd, { maxAgeDays: 0, maxBytes: 0 });
  assert.equal(unsafeRetention.skippedUnsafeRoot, true);
  await assert.doesNotReject(fs.access(path.join(externalTraceDir, "must-survive.jsonl")));
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code !== "EPERM" && code !== "EACCES") throw error;
}

await fs.rm(storageRoot, { recursive: true, force: true });
console.log("trace DTO/redaction/storage/retention tests passed");
