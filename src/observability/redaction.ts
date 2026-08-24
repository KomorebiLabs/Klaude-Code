import type { ToolInputSummary, ToolResultSummary } from "./types.js";

const SENSITIVE_KEY = /(?:api[_-]?key|token|authorization|cookie|password|passwd|secret|private[ _-]?key|client[ _-]?secret|credentials|env)/i;
const QUOTE_DELIMITER = "(?:\\\\?\\\")";
const QUOTED_OR_PLAIN_SENSITIVE_KEY = `(?:${QUOTE_DELIMITER}?(?:api[_-]?key|token|cookie|password|passwd|secret|private[ _-]?key|client[ _-]?secret|credentials|env)${QUOTE_DELIMITER}?)`;
const JSON_STRING_VALUE = "(?:\\\\?\\\")(?:\\\\.|[^\\\"])*(?:\\\\?\\\")";
const SENSITIVE_VALUE_ASSIGNMENT = new RegExp(`(${QUOTED_OR_PLAIN_SENSITIVE_KEY})\\s*[:=]\\s*(?:${JSON_STRING_VALUE}|[^\\s,;}]+)`, "gi");
const QUOTED_OR_PLAIN_AUTHORIZATION_KEY = `${QUOTE_DELIMITER}?authorization${QUOTE_DELIMITER}?`;
const AUTHORIZATION_ASSIGNMENT = new RegExp(`(${QUOTED_OR_PLAIN_AUTHORIZATION_KEY})\\s*[:=]\\s*[^\\r\\n}]+`, "gi");
const MAX_SAFE_MESSAGE_LENGTH = 500;

function redactString(value: string): string {
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(AUTHORIZATION_ASSIGNMENT, "$1=[REDACTED]")
    .replace(SENSITIVE_VALUE_ASSIGNMENT, "$1=[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/([?&](?:token|key|sig|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

function redactValue(value: unknown, seen: WeakSet<object>, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, seen, entryKey),
      ]),
    );
  }
  return value;
}

function serializedLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

export function redactForTrace(value: unknown, key?: string): unknown {
  return redactValue(value, new WeakSet<object>(), key);
}

export function createSafeMessage(value: unknown): string {
  return createSafeDiagnosticMessage(value);
}

export function createSafeDiagnosticMessage(value: unknown): string {
  try {
    const raw = typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : "Diagnostic detail omitted.";
    return redactString(raw).slice(0, MAX_SAFE_MESSAGE_LENGTH);
  } catch {
    return "Diagnostic detail omitted.";
  }
}

/** Return only the non-secret network origin; omit credentials, path and query. */
export function createSafeUrlSummary(value: string): string {
  try {
    const parsed = new URL(value);
    if (!parsed.protocol || !parsed.host) return "[invalid-url]";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "[invalid-url]";
  }
}

export function summarizeToolInput(input: Record<string, unknown>): ToolInputSummary {
  const fieldNames = Object.keys(input).sort().slice(0, 20);
  const redactedFieldNames = fieldNames.filter((name) => SENSITIVE_KEY.test(name));
  return {
    fieldNames,
    serializedLength: serializedLength(input),
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
