import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getSessionPaths } from "../session/storage.js";
import type { EvaluationResult } from "./types.js";
import { renderEvaluationMarkdown } from "./report.js";

export const DEFAULT_EVALUATION_RETENTION_DAYS = 30;
export const DEFAULT_EVALUATION_QUOTA_BYTES = 50 * 1024 * 1024;
const RUN_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
const STORE_MARKER = ".evaluation-store-v1";
const STORE_MARKER_CONTENT = "klaude-evaluation-store-v1\n";

export interface EvaluationArtifactPaths {
  rootDir: string;
  runDir: string;
  resultPath: string;
  reportPath: string;
}

export interface EvaluationRetentionResult {
  deletedByAge: number;
  deletedByQuota: number;
  failures: number;
  skippedUnsafeRoot: boolean;
  remainingBytes: number;
}

export async function getEvaluationRoot(cwd: string): Promise<string> {
  const { projectDir } = await getSessionPaths(cwd, "evaluation-placeholder");
  return path.join(projectDir, "evaluations");
}

function validateRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("Invalid evaluation run id.");
}

function pathsFor(rootDir: string, runId: string): EvaluationArtifactPaths {
  validateRunId(runId);
  const resolvedRoot = path.resolve(rootDir);
  if (path.basename(resolvedRoot) !== "evaluations") throw new Error("Unsafe evaluation root.");
  const runDir = path.join(resolvedRoot, runId);
  if (path.dirname(runDir) !== resolvedRoot) throw new Error("Unsafe evaluation run path.");
  return {
    rootDir: resolvedRoot,
    runDir,
    resultPath: path.join(runDir, "result.json"),
    reportPath: path.join(runDir, "report.md"),
  };
}

async function rootIsSafe(rootDir: string, create: boolean): Promise<boolean> {
  if (path.basename(path.resolve(rootDir)) !== "evaluations") return false;
  if (create) await fs.mkdir(rootDir, { recursive: true });
  try {
    const stat = await fs.lstat(rootDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    const markerPath = path.join(rootDir, STORE_MARKER);
    if (create) {
      try {
        await fs.writeFile(markerPath, STORE_MARKER_CONTENT, { encoding: "utf8", flag: "wx" });
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
      }
    }
    const marker = await fs.lstat(markerPath);
    if (!marker.isFile() || marker.isSymbolicLink()) return false;
    return await fs.readFile(markerPath, "utf8") === STORE_MARKER_CONTENT;
  } catch {
    return false;
  }
}

export async function writeEvaluationArtifacts(
  cwd: string,
  result: EvaluationResult,
  options: { rootDir?: string } = {},
): Promise<EvaluationArtifactPaths> {
  const rootDir = options.rootDir ?? await getEvaluationRoot(cwd);
  const paths = pathsFor(rootDir, result.runId);
  if (!(await rootIsSafe(paths.rootDir, true))) throw new Error("Unsafe evaluation root.");
  await fs.mkdir(paths.runDir, { recursive: false });
  const runStat = await fs.lstat(paths.runDir);
  if (!runStat.isDirectory() || runStat.isSymbolicLink()) throw new Error("Unsafe evaluation run directory.");
  await fs.writeFile(paths.resultPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await fs.writeFile(paths.reportPath, renderEvaluationMarkdown(result), { encoding: "utf8", flag: "wx" });
  return paths;
}

async function runSize(runDir: string): Promise<number> {
  let total = 0;
  for (const name of ["result.json", "report.md"]) {
    try {
      const stat = await fs.lstat(path.join(runDir, name));
      if (stat.isFile() && !stat.isSymbolicLink()) total += stat.size;
    } catch {
      // A partially written run contributes only readable regular files.
    }
  }
  return total;
}

export async function applyEvaluationRetentionPolicy(
  rootDir: string,
  options: { maxAgeDays?: number; maxBytes?: number; nowMs?: number } = {},
): Promise<EvaluationRetentionResult> {
  const result: EvaluationRetentionResult = {
    deletedByAge: 0,
    deletedByQuota: 0,
    failures: 0,
    skippedUnsafeRoot: false,
    remainingBytes: 0,
  };
  const resolvedRoot = path.resolve(rootDir);
  if (!(await rootIsSafe(resolvedRoot, false))) {
    result.skippedUnsafeRoot = true;
    return result;
  }
  const maxAgeDays = Math.max(0, options.maxAgeDays ?? DEFAULT_EVALUATION_RETENTION_DAYS);
  const maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_EVALUATION_QUOTA_BYTES);
  const cutoffMs = (options.nowMs ?? Date.now()) - maxAgeDays * 24 * 60 * 60 * 1000;
  const runs: Array<{ path: string; mtimeMs: number; size: number }> = [];
  for (const entry of await fs.readdir(resolvedRoot, { withFileTypes: true })) {
    const runDir = path.join(resolvedRoot, entry.name);
    try {
      const stat = await fs.lstat(runDir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
      if (stat.mtimeMs < cutoffMs) {
        await fs.rm(runDir, { recursive: true, force: true });
        result.deletedByAge++;
      } else {
        runs.push({ path: runDir, mtimeMs: stat.mtimeMs, size: await runSize(runDir) });
      }
    } catch {
      result.failures++;
    }
  }
  runs.sort((left, right) => left.mtimeMs - right.mtimeMs);
  result.remainingBytes = runs.reduce((sum, run) => sum + run.size, 0);
  for (const run of runs) {
    if (result.remainingBytes <= maxBytes) break;
    try {
      await fs.rm(run.path, { recursive: true, force: true });
      result.remainingBytes -= run.size;
      result.deletedByQuota++;
    } catch {
      result.failures++;
    }
  }
  return result;
}

export async function deleteEvaluationRun(rootDir: string, runId: string): Promise<boolean> {
  const paths = pathsFor(rootDir, runId);
  if (!(await rootIsSafe(paths.rootDir, false))) return false;
  try {
    const stat = await fs.lstat(paths.runDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    await fs.rm(paths.runDir, { recursive: true, force: true });
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return false;
    return false;
  }
}
