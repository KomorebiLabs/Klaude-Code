import type { HarnessTraceEvent } from "./types.js";
import { readTraceEvents } from "./traceReader.js";

const SAFE_PAYLOAD_KEYS = new Set([
  "model", "turnId", "apiAttempt", "attempt", "nextAttempt", "maxRetries", "delayMs",
  "stopReason", "reason", "outcome", "errorCategory", "toolName", "toolUseId", "decision",
  "source", "prompted", "durationMs", "inputTokens", "outputTokens", "messageCount", "toolCount",
]);

export interface TraceTimelineEntry {
  sequence: number;
  eventType: string;
  spanId?: string;
  details: Record<string, unknown>;
}

function safeDetails(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => SAFE_PAYLOAD_KEYS.has(key) && value !== undefined),
  );
}

export function createTraceTimeline(events: HarnessTraceEvent[]): TraceTimelineEntry[] {
  return [...events]
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => ({
      sequence: event.sequence,
      eventType: event.eventType,
      ...(event.spanId ? { spanId: event.spanId } : {}),
      details: safeDetails(event.payload),
    }));
}

export async function inspectTraceFile(tracePath: string): Promise<TraceTimelineEntry[]> {
  return createTraceTimeline(await readTraceEvents(tracePath));
}

export function formatTraceTimeline(entries: TraceTimelineEntry[]): string {
  return entries
    .map((entry) => {
      const span = entry.spanId ? ` span=${entry.spanId}` : "";
      const details = Object.entries(entry.details)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ");
      return `${entry.sequence} ${entry.eventType}${span}${details ? ` ${details}` : ""}`;
    })
    .join("\n");
}
