import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import type { HarnessTraceEvent, HarnessTraceEventType, TraceSink } from "./types.js";
import type { TraceStatus } from "./types.js";
import { TRACE_SCHEMA_VERSION } from "./types.js";
import { redactForTrace } from "./redaction.js";
import { getTracePaths } from "../session/storage.js";

const DEFAULT_CLOSE_TIMEOUT_MS = 250;

export interface TraceWriterOptions {
  enabled?: boolean;
  closeTimeoutMs?: number;
  appendFile?: (tracePath: string, line: string) => Promise<void>;
}

function createNoopWriter(status: TraceStatus): TraceSink {
  return {
    emit: () => {},
    close: async () => {},
    getStatus: () => ({ ...status }),
  };
}

class JsonlTraceWriter implements TraceSink {
  private sequence = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private closed = false;
  private pendingWrites = 0;
  private status: TraceStatus = { state: "active", droppedEvents: 0 };

  constructor(
    private readonly traceId: string,
    private readonly tracePath: string,
    private readonly closeTimeoutMs: number,
    private readonly appendFile: (tracePath: string, line: string) => Promise<void>,
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
    this.pendingWrites += 1;
    this.writeQueue = this.writeQueue
      .then(() => this.appendFile(this.tracePath, line))
      .catch(() => {
        this.status = {
          state: "degraded",
          reason: "write_failed",
          droppedEvents: this.status.droppedEvents + 1,
        };
      })
      .finally(() => {
        this.pendingWrites = Math.max(0, this.pendingWrites - 1);
      });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.pendingWrites === 0) return;

    let timeout: NodeJS.Timeout | undefined;
    const completed = await Promise.race([
      this.writeQueue.then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), this.closeTimeoutMs);
      }),
    ]);
    if (timeout) clearTimeout(timeout);
    if (!completed) {
      this.status = {
        state: "degraded",
        reason: "close_timeout",
        droppedEvents: this.status.droppedEvents + this.pendingWrites,
      };
    }
  }

  getStatus(): Readonly<TraceStatus> {
    return { ...this.status };
  }
}

export async function createTraceWriter(
  cwd: string,
  traceId: string,
  options: TraceWriterOptions = {},
): Promise<TraceSink> {
  if (options.enabled === false) {
    return createNoopWriter({
      state: "disabled",
      reason: "explicitly_disabled",
      droppedEvents: 0,
    });
  }

  try {
    const { traceDir, tracePath } = await getTracePaths(cwd, traceId);
    await fs.mkdir(traceDir, { recursive: true });
    return new JsonlTraceWriter(
      traceId,
      tracePath,
      Math.max(0, options.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS),
      options.appendFile ?? ((target, line) => fs.appendFile(target, line, "utf8")),
    );
  } catch {
    return createNoopWriter({
      state: "degraded",
      reason: "initialization_failed",
      droppedEvents: 0,
    });
  }
}
