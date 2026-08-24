import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getSessionPaths, getTracePaths } from "../session/storage.js";

export const DEFAULT_TRACE_RETENTION_DAYS = 30;
export const DEFAULT_TRACE_QUOTA_BYTES = 50 * 1024 * 1024;

export interface TraceRetentionOptions {
  maxAgeDays?: number;
  maxBytes?: number;
  nowMs?: number;
}

export interface TraceRetentionResult {
  deletedByAge: number;
  deletedByQuota: number;
  bytesRemaining: number;
  failures: number;
  skippedUnsafeRoot: boolean;
}

interface TraceFile {
  path: string;
  size: number;
  mtimeMs: number;
}

export async function applyTraceRetentionPolicy(
  cwd: string,
  options: TraceRetentionOptions = {},
): Promise<TraceRetentionResult> {
  const result: TraceRetentionResult = {
    deletedByAge: 0,
    deletedByQuota: 0,
    bytesRemaining: 0,
    failures: 0,
    skippedUnsafeRoot: false,
  };
  const maxAgeDays = Math.max(0, options.maxAgeDays ?? DEFAULT_TRACE_RETENTION_DAYS);
  const maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_TRACE_QUOTA_BYTES);
  const nowMs = options.nowMs ?? Date.now();

  try {
    const { projectDir } = await getSessionPaths(cwd, "trace-retention");
    const { traceDir } = await getTracePaths(cwd, "trace-retention");
    const resolvedProjectDir = path.resolve(projectDir);
    const resolvedTraceDir = path.resolve(traceDir);
    if (
      path.dirname(resolvedTraceDir) !== resolvedProjectDir ||
      path.basename(resolvedTraceDir) !== "traces"
    ) {
      result.skippedUnsafeRoot = true;
      return result;
    }

    let rootStat;
    try {
      rootStat = await fs.lstat(resolvedTraceDir);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return result;
      throw error;
    }
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      result.skippedUnsafeRoot = true;
      return result;
    }

    const files: TraceFile[] = [];
    for (const entry of await fs.readdir(resolvedTraceDir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".jsonl")) continue;
      const filePath = path.join(resolvedTraceDir, entry.name);
      try {
        const stat = await fs.lstat(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        files.push({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs });
      } catch {
        result.failures += 1;
      }
    }

    const cutoffMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
    const survivors: TraceFile[] = [];
    for (const file of files) {
      if (file.mtimeMs < cutoffMs) {
        try {
          await fs.rm(file.path, { force: true });
          result.deletedByAge += 1;
        } catch {
          result.failures += 1;
          survivors.push(file);
        }
      } else {
        survivors.push(file);
      }
    }

    survivors.sort((left, right) => left.mtimeMs - right.mtimeMs);
    let totalBytes = survivors.reduce((total, file) => total + file.size, 0);
    for (const file of survivors) {
      if (totalBytes <= maxBytes) break;
      try {
        await fs.rm(file.path, { force: true });
        totalBytes -= file.size;
        result.deletedByQuota += 1;
      } catch {
        result.failures += 1;
      }
    }
    result.bytesRemaining = totalBytes;
  } catch {
    result.failures += 1;
  }

  return result;
}
