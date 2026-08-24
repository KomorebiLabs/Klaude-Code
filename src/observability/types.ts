export const TRACE_SCHEMA_VERSION = 1 as const;

export type HarnessTraceEventType =
  | "query.started"
  | "query.finished"
  | "query.aborted"
  | "query.failed"
  | "model.requested"
  | "model.completed"
  | "model.failed"
  | "retry.scheduled"
  | "stream.restarted"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "permission.requested"
  | "permission.resolved"
  | "context.assembled"
  | "context.compacted"
  | "token.warning"
  | "trace.degraded";

export interface HarnessTraceEvent {
  schemaVersion: typeof TRACE_SCHEMA_VERSION;
  eventId: string;
  traceId: string;
  sequence: number;
  timestamp: string;
  eventType: HarnessTraceEventType;
  sessionId?: string;
  spanId?: string;
  payload: Record<string, unknown>;
}

export interface TraceMetadata {
  traceId: string;
  sessionId?: string;
}

export type TraceAvailabilityState = "active" | "disabled" | "degraded";
export type TraceDegradedReason =
  | "explicitly_disabled"
  | "initialization_failed"
  | "write_failed"
  | "close_timeout";

export interface TraceStatus {
  state: TraceAvailabilityState;
  reason?: TraceDegradedReason;
  droppedEvents: number;
}

export interface TraceSink {
  emit(eventType: HarnessTraceEventType, payload: Record<string, unknown>, options?: { spanId?: string }): void;
  close(): Promise<void>;
  getStatus(): Readonly<TraceStatus>;
}

export interface ToolInputSummary {
  fieldNames: string[];
  serializedLength: number;
  contentOmitted: true;
  redactedFieldNames?: string[];
}

export interface ToolResultSummary {
  outcome: "success" | "tool_error" | "permission_denied" | "aborted" | "timeout" | "unknown";
  textLength?: number;
  exitCode?: number;
  truncated: boolean;
  contentOmitted: true;
}

export interface ExternalExecutionTraceSummary {
  kind: "mcp" | "process";
  sourceName: string;
  operationName: string;
  termination?: "completed" | "timeout" | "aborted" | "degraded";
  sandboxState?: "enabled" | "disabled" | "unsupported" | "degraded";
}
