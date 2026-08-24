import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseGovernedMemory } from "../context/memory/governance.js";
import type { MemoryDiagnosticSummary } from "./types.js";

const MAX_MEMORY_FILES = 200;
const MAX_MEMORY_FILE_BYTES = 256 * 1024;

async function collectRegularMemoryFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".trash" || files.length >= MAX_MEMORY_FILES) continue;
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRegularMemoryFiles(root, fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "MEMORY.md") {
      files.push(fullPath);
    }
  }
  return files.slice(0, MAX_MEMORY_FILES);
}

export async function summarizeMemoryDirectory(
  memoryDir: string,
  options: { now?: Date } = {},
): Promise<MemoryDiagnosticSummary> {
  const empty: MemoryDiagnosticSummary = {
    status: "unavailable",
    activeCount: 0,
    staleCount: 0,
    legacyCount: 0,
    invalidCount: 0,
  };
  try {
    const rootStat = await lstat(memoryDir);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return empty;
    const files = await collectRegularMemoryFiles(memoryDir);
    if (files.length === 0) return empty;

    const summary = { ...empty, status: "healthy" as const } as MemoryDiagnosticSummary;
    for (const file of files) {
      try {
        const stat = await lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MEMORY_FILE_BYTES) {
          summary.invalidCount += 1;
          continue;
        }
        const document = parseGovernedMemory(
          await readFile(file, "utf-8"),
          options.now ?? new Date(),
        );
        if (!document) summary.invalidCount += 1;
        else if (document.freshness === "active") summary.activeCount += 1;
        else if (document.freshness === "stale") summary.staleCount += 1;
        else summary.legacyCount += 1;
      } catch {
        summary.invalidCount += 1;
      }
    }
    if (summary.invalidCount > 0) summary.status = "incomplete";
    else if (summary.staleCount > 0 || summary.legacyCount > 0) summary.status = "degraded";
    return summary;
  } catch {
    return empty;
  }
}
