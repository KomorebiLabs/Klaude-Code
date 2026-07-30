import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import type { HarnessTraceEvent, HarnessTraceEventType, TraceSink } from "./types.js";
import { TRACE_SCHEMA_VERSION } from "./types.js";
import { redactForTrace } from "./redaction.js";
import { getTracePaths, isSessionPersistenceEnabled } from "../session/storage.js";

function createNoopWriter(): TraceSink {
  return {
    emit: () => {},
    close: async () => {},
  };
}

class JsonlTraceWriter implements TraceSink {
  private sequence = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly traceId: string,
    private readonly tracePath: string,
  ) {}

  emit(eventType: HarnessTraceEventType, payload: Record<string, unknown>, options?: { spanId?: string }): void {
    if (this.closed) return;

    const event: HarnessTraceEvent = {
      schemaVersion: TRACE_SCHEMA_VERSION,
      eventId: crypto.randomUUID(),
      traceId: this.traceId,
      sequence: ++this.sequence,
      timestamp: new Date().toISOString(),
      eventType,
      ...(options?.spanId ? { spanId: options.spanId } : {}),
      payload: redactForTrace(payload) as Record<string, unknown>,
    };
    const line = `${JSON.stringify(event)}\n`;
    this.writeQueue = this.writeQueue.then(() => fs.appendFile(this.tracePath, line, "utf8")).catch(() => {});
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.writeQueue;
  }
}

export async function createTraceWriter(cwd: string, traceId: string): Promise<TraceSink> {
  if (!isSessionPersistenceEnabled()) return createNoopWriter();

  try {
    const { traceDir, tracePath } = await getTracePaths(cwd, traceId);
    await fs.mkdir(traceDir, { recursive: true });
    return new JsonlTraceWriter(traceId, tracePath);
  } catch {
    return createNoopWriter();
  }
}
