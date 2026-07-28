import assert from "node:assert/strict";
import {
  createSafeMessage,
  redactForTrace,
  summarizeToolInput,
} from "../observability/index.js";

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

const summary = summarizeToolInput({ command: "npm test", apiKey: secret, path: "src/x.ts" });
assert.deepEqual(summary.fieldNames, ["apiKey", "command", "path"]);
assert.equal(summary.contentOmitted, true);
assert.equal("command" in summary, false);

assert.equal(createSafeMessage(`Authorization: Bearer abcdef ${"x".repeat(1_000)}`).includes("abcdef"), false);
assert.ok(createSafeMessage("x".repeat(1_000)).length <= 500);
console.log("trace DTO/redaction tests passed");
