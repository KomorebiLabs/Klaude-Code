import * as fs from "node:fs/promises";
import type { HarnessTraceEvent } from "./types.js";

export async function readTraceEvents(tracePath: string): Promise<HarnessTraceEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(tracePath, "utf8");
  } catch {
    return [];
  }

  const events: HarnessTraceEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as HarnessTraceEvent;
      if (
        parsed &&
        parsed.schemaVersion === 1 &&
        typeof parsed.eventId === "string" &&
        typeof parsed.traceId === "string" &&
        typeof parsed.sequence === "number" &&
        typeof parsed.timestamp === "string" &&
        typeof parsed.eventType === "string" &&
        parsed.payload &&
        typeof parsed.payload === "object"
      ) {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed or truncated lines so earlier events remain readable.
    }
  }
  return events;
}
