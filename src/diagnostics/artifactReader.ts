import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createSafeDiagnosticMessage } from "../observability/redaction.js";
import type { HarnessTraceEvent } from "../observability/types.js";
import type { EvaluationDiagnosticSummary, TraceArtifactReadResult } from "./types.js";

export const MAX_DIAGNOSTIC_TRACE_BYTES = 5 * 1024 * 1024;
export const MAX_DIAGNOSTIC_EVALUATION_BYTES = 1024 * 1024;

function safeCode(value: string): string {
  return createSafeDiagnosticMessage(value)
    .replace(/[^a-zA-Z0-9._:-]/g, "_")
    .slice(0, 120) || "unknown";
}

async function isSafeDirectory(directory: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(directory);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function isTraceEvent(value: unknown): value is HarnessTraceEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<HarnessTraceEvent>;
  return event.schemaVersion === 1 &&
    typeof event.eventId === "string" &&
    typeof event.traceId === "string" &&
    typeof event.sequence === "number" &&
    Number.isFinite(event.sequence) &&
    typeof event.timestamp === "string" &&
    typeof event.eventType === "string" &&
    !!event.payload && typeof event.payload === "object" && !Array.isArray(event.payload);
}

async function latestRegularFile(directory: string, predicate: (name: string) => boolean): Promise<string | undefined> {
  if (!(await isSafeDirectory(directory))) return undefined;
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return undefined;
  }
  const candidates: Array<{ filePath: string; mtimeMs: number }> = [];
  for (const name of names) {
    if (!predicate(name)) continue;
    const filePath = path.join(directory, name);
    try {
      const stat = await fs.lstat(filePath);
      if (stat.isFile() && !stat.isSymbolicLink()) candidates.push({ filePath, mtimeMs: stat.mtimeMs });
    } catch {
      // A concurrently removed artifact is simply unavailable to this report.
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.filePath.localeCompare(left.filePath));
  return candidates[0]?.filePath;
}

async function readBoundedUtf8(filePath: string, maxBytes: number): Promise<{ raw: string; truncated: boolean }> {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unsafe diagnostic artifact.");
  const bytesToRead = Math.min(stat.size, maxBytes);
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    return { raw: buffer.subarray(0, bytesRead).toString("utf8"), truncated: stat.size > maxBytes };
  } finally {
    await handle.close();
  }
}

export async function readLatestTraceArtifact(projectDir: string): Promise<TraceArtifactReadResult> {
  const tracePath = await latestRegularFile(path.join(projectDir, "traces"), (name) => name.endsWith(".jsonl"));
  if (!tracePath) return { status: "unavailable", events: [], ignoredLineCount: 0 };

  let raw: string;
  let truncatedByBudget = false;
  try {
    const bounded = await readBoundedUtf8(tracePath, MAX_DIAGNOSTIC_TRACE_BYTES);
    raw = bounded.raw;
    truncatedByBudget = bounded.truncated;
  } catch {
    return { status: "unavailable", events: [], ignoredLineCount: 0 };
  }
  const events: HarnessTraceEvent[] = [];
  let ignoredLineCount = truncatedByBudget ? 1 : 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isTraceEvent(parsed)) events.push(parsed);
      else ignoredLineCount++;
    } catch {
      ignoredLineCount++;
    }
  }
  return {
    status: ignoredLineCount > 0 ? "incomplete" : "available",
    reference: safeCode(path.basename(tracePath)),
    events,
    ignoredLineCount,
  };
}

function unavailableEvaluation(
  status: "unavailable" | "incomplete" = "unavailable",
  reference?: string,
): EvaluationDiagnosticSummary {
  return {
    status,
    ...(reference ? { reference } : {}),
    assertionCount: 0,
    failedInvariantIds: [],
    limitationCodes: [],
  };
}

export async function readLatestEvaluationSummary(projectDir: string): Promise<EvaluationDiagnosticSummary> {
  const rootDir = path.join(projectDir, "evaluations");
  if (!(await isSafeDirectory(rootDir))) return unavailableEvaluation();
  let runNames: string[];
  try {
    runNames = await fs.readdir(rootDir);
  } catch {
    return unavailableEvaluation();
  }

  const candidates: Array<{ runId: string; resultPath: string; mtimeMs: number }> = [];
  for (const runId of runNames) {
    const runDir = path.join(rootDir, runId);
    try {
      const runStat = await fs.lstat(runDir);
      if (!runStat.isDirectory() || runStat.isSymbolicLink()) continue;
      const resultPath = path.join(runDir, "result.json");
      const resultStat = await fs.lstat(resultPath);
      if (resultStat.isFile() && !resultStat.isSymbolicLink()) {
        candidates.push({ runId, resultPath, mtimeMs: resultStat.mtimeMs });
      }
    } catch {
      // Ignore partial or concurrently removed evaluation runs.
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.runId.localeCompare(left.runId));
  const latest = candidates[0];
  if (!latest) return unavailableEvaluation();

  try {
    const bounded = await readBoundedUtf8(latest.resultPath, MAX_DIAGNOSTIC_EVALUATION_BYTES);
    if (bounded.truncated) return unavailableEvaluation("incomplete", safeCode(latest.runId));
    const parsed: unknown = JSON.parse(bounded.raw);
    if (!parsed || typeof parsed !== "object") {
      return unavailableEvaluation("incomplete", safeCode(latest.runId));
    }
    const value = parsed as Record<string, unknown>;
    if (value.schemaVersion !== 1 || !["passed", "failed", "infra_error"].includes(String(value.outcome))) {
      return unavailableEvaluation("incomplete", safeCode(latest.runId));
    }
    const assertions = Array.isArray(value.assertions) ? value.assertions : [];
    const normalizedAssertions = assertions.filter((item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && typeof (item as Record<string, unknown>).invariantId === "string" &&
      typeof (item as Record<string, unknown>).passed === "boolean",
    );
    const failedInvariantIds = normalizedAssertions
      .filter((item) => item.passed === false)
      .map((item) => safeCode(String(item.invariantId)));
    const limitationCodes = (Array.isArray(value.limitationCodes) ? value.limitationCodes : [])
      .filter((item): item is string => typeof item === "string")
      .map(safeCode);
    const outcome = String(value.outcome) as "passed" | "failed" | "infra_error";
    return {
      status: outcome === "passed" ? "healthy" : "failed",
      reference: safeCode(latest.runId),
      outcome,
      assertionCount: normalizedAssertions.length,
      failedInvariantIds,
      limitationCodes,
    };
  } catch {
    return unavailableEvaluation("incomplete", safeCode(latest.runId));
  }
}
