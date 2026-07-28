import type { ToolInputSummary, ToolResultSummary } from "./types.js";

const SENSITIVE_KEY = /(?:api[_-]?key|token|authorization|cookie|password|passwd|secret|private[_-]?key|client[_-]?secret|credentials|env)/i;
const MAX_SAFE_MESSAGE_LENGTH = 500;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/([?&](?:token|key|sig|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

export function redactForTrace(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactForTrace(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactForTrace(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function createSafeMessage(value: unknown): string {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : "Trace operation failed";
  return redactString(raw).slice(0, MAX_SAFE_MESSAGE_LENGTH);
}

export function summarizeToolInput(input: Record<string, unknown>): ToolInputSummary {
  const fieldNames = Object.keys(input).sort().slice(0, 20);
  const redactedFieldNames = fieldNames.filter((name) => SENSITIVE_KEY.test(name));
  return {
    fieldNames,
    serializedLength: JSON.stringify(input).length,
    contentOmitted: true,
    ...(redactedFieldNames.length > 0 ? { redactedFieldNames } : {}),
  };
}

export function summarizeToolResult(result: {
  outcome?: ToolResultSummary["outcome"];
  text?: string;
  exitCode?: number;
  truncated?: boolean;
}): ToolResultSummary {
  return {
    outcome: result.outcome ?? "unknown",
    ...(typeof result.text === "string" ? { textLength: result.text.length } : {}),
    ...(typeof result.exitCode === "number" ? { exitCode: result.exitCode } : {}),
    truncated: result.truncated ?? false,
    contentOmitted: true,
  };
}
