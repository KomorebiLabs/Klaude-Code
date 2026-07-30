import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  createSafeMessage,
  createTraceWriter,
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

const storageRoot = await fs.mkdtemp(path.join(process.cwd(), ".trace-test-"));
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

await fs.appendFile(tracePath, '{"schemaVersion":1,"eventType":"truncated"\n', "utf8");
assert.equal((await readTraceEvents(tracePath)).length, 2);

configureSessionPersistence(false);
const disabledTraceId = "trace-disabled";
const disabledWriter = await createTraceWriter(traceCwd, disabledTraceId);
disabledWriter.emit("query.started", {});
await disabledWriter.close();
await assert.rejects(fs.access(await getTracePath(traceCwd, disabledTraceId)));
configureSessionPersistence(true);

const failingCwd = path.join(storageRoot, "failing-project");
const failingWriter = await createTraceWriter(failingCwd, "trace-failure");
const failingTracePath = await getTracePath(failingCwd, "trace-failure");
await fs.rm(path.dirname(failingTracePath), { recursive: true, force: true });
assert.doesNotThrow(() => failingWriter.emit("query.started", { apiKey: "secret" }));
await assert.doesNotReject(() => failingWriter.close());

await fs.rm(storageRoot, { recursive: true, force: true });
console.log("trace DTO/redaction/storage tests passed");
