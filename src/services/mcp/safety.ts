import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { createSafeDiagnosticMessage } from "../../observability/redaction.js";

export const MCP_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_MCP_CONTENT_CHARS = 100_000;
export type McpFailureCategory = "mcp_timeout" | "mcp_aborted" | "mcp_failure";

export function createMcpRequestOptions(signal?: AbortSignal): RequestOptions {
  return {
    ...(signal ? { signal } : {}),
    timeout: MCP_REQUEST_TIMEOUT_MS,
    maxTotalTimeout: MCP_REQUEST_TIMEOUT_MS,
  };
}

export function classifyMcpFailure(
  error: unknown,
  signal?: AbortSignal,
): McpFailureCategory {
  if (signal?.aborted) return "mcp_aborted";
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "AbortError" || /\babort(?:ed)?\b/i.test(message)) return "mcp_aborted";
  if (/\b(?:timed? out|timeout)\b/i.test(message)) return "mcp_timeout";
  return "mcp_failure";
}

export function createSafeMcpFailure(
  operation: string,
  error: unknown,
  signal?: AbortSignal,
): string {
  const category = classifyMcpFailure(error, signal);
  const label = category === "mcp_timeout"
    ? "timed out"
    : category === "mcp_aborted"
      ? "was aborted"
      : "failed";
  return `${operation} ${label}: ${createSafeDiagnosticMessage(error)}`;
}

export class BoundedMcpText {
  private retained = "";
  private discardedChars = 0;

  constructor(private readonly maxChars = MAX_MCP_CONTENT_CHARS) {}

  append(value: string): void {
    const separator = this.retained.length > 0 ? "\n" : "";
    const combined = separator + value;
    const available = Math.max(0, this.maxChars - this.retained.length);
    this.retained += combined.slice(0, available);
    this.discardedChars += Math.max(0, combined.length - available);
  }

  toString(): string {
    return this.discardedChars > 0
      ? `${this.retained}\n...[truncated ${this.discardedChars} chars]`
      : this.retained;
  }
}

/** Serialize a bounded prefix while preserving the caller's JSON array shape. */
export function serializeBoundedMcpJsonArray(
  items: unknown[],
  wrapperKey?: string,
): string {
  const prefix = wrapperKey ? `{"${wrapperKey}":[` : "[";
  const suffix = wrapperKey ? "]}" : "]";
  const serializedItems: string[] = [];
  let usedChars = prefix.length + suffix.length;

  for (const item of items) {
    const serialized = JSON.stringify(item);
    const separatorChars = serializedItems.length > 0 ? 1 : 0;
    if (usedChars + separatorChars + serialized.length > MAX_MCP_CONTENT_CHARS) break;
    serializedItems.push(serialized);
    usedChars += separatorChars + serialized.length;
  }

  return `${prefix}${serializedItems.join(",")}${suffix}`;
}

/** Convert MCP content without ever retaining an unbounded aggregate string. */
export function stringifyMcpContentBounded(
  content: CallToolResult["content"],
): string {
  if (!Array.isArray(content)) return "";
  const output = new BoundedMcpText();

  for (const block of content) {
    switch (block.type) {
      case "text":
        output.append(block.text);
        break;
      case "image":
        output.append(
          `[image: ${block.mimeType ?? "?"}, ${(block.data ?? "").length} base64 chars]`,
        );
        break;
      case "resource": {
        const resource = block.resource as { uri?: string; text?: string };
        output.append(resource.text ?? `[resource: ${resource.uri ?? "<no uri>"}]`);
        break;
      }
      default:
        output.append(`[${(block as { type?: string }).type ?? "unknown"} block]`);
    }
  }

  return output.toString();
}
