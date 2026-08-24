import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MemoryEntry, MemoryFrontmatter, MemoryType } from "./memoryTypes.js";
import { getProjectsRoot } from "../../utils/paths.js";
import {
  archiveGovernedMemory,
  parseGovernedMemory,
  writeGovernedMemory,
  type MemoryFreshness,
  type MemorySource,
} from "./governance.js";

export const MEMORY_ENTRYPOINT = "MEMORY.md";
export const MAX_ENTRYPOINT_LINES = 200;
export const MAX_ENTRYPOINT_BYTES = 25_000;

export interface MemoryDocument extends MemoryEntry {
  frontmatter: MemoryFrontmatter;
  body: string;
  relativePath: string;
  schemaVersion: 1 | 2;
  source: MemorySource | "unknown";
  freshness: MemoryFreshness;
  revision?: string;
  expiresAt?: string;
}


export interface MemoryHeader extends MemoryEntry {
  frontmatter: MemoryFrontmatter;
  relativePath: string;
  schemaVersion: 1 | 2;
  source: MemorySource | "unknown";
  freshness: MemoryFreshness;
  revision?: string;
  expiresAt?: string;
}

export interface ProjectPathInfo {
  gitRoot: string;
  projectKey: string;
  projectDir: string;
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function scoreTextMatch(haystack: string, terms: string[]): number {
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}

async function findCanonicalGitRoot(cwd: string): Promise<string> {
  let current = path.resolve(cwd);

  while (true) {
    try {
      await fs.stat(path.join(current, ".git"));
      return current;
    } catch {
      // keep walking upward
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(cwd);
    }
    current = parent;
  }
}

export async function getProjectPathInfo(cwd: string): Promise<ProjectPathInfo> {
  const gitRoot = await findCanonicalGitRoot(cwd);
  const slugBase = sanitizeSlug(path.basename(gitRoot));
  const suffix = crypto.createHash("sha256").update(gitRoot).digest("hex").slice(0, 16);
  const projectKey = `${slugBase}-${suffix}`;
  return {
    gitRoot,
    projectKey,
    projectDir: path.join(getProjectsRoot(), projectKey),
  };
}

export async function getProjectMemoryDir(cwd: string): Promise<string> {
  const { projectDir } = await getProjectPathInfo(cwd);
  return path.join(projectDir, "memory");
}

export async function ensureMemoryDirExists(cwd: string): Promise<string> {
  const memoryDir = await getProjectMemoryDir(cwd);
  await fs.mkdir(memoryDir, { recursive: true });
  const entrypoint = path.join(memoryDir, MEMORY_ENTRYPOINT);
  try {
    await fs.access(entrypoint);
  } catch {
    await fs.writeFile(entrypoint, "# Project Memory\n\n", "utf-8");
  }
  return memoryDir;
}

function truncateEntrypoint(raw: string): { content: string; warning?: string } {
  let content = raw;
  let lineTruncated = false;
  let byteTruncated = false;

  const lines = content.split(/\r?\n/);
  if (lines.length > MAX_ENTRYPOINT_LINES) {
    content = lines.slice(0, MAX_ENTRYPOINT_LINES).join("\n");
    lineTruncated = true;
  }

  while (Buffer.byteLength(content, "utf-8") > MAX_ENTRYPOINT_BYTES && content.length > 0) {
    content = content.slice(0, -1);
    byteTruncated = true;
  }

  const warning = lineTruncated || byteTruncated
    ? `> WARNING: MEMORY.md was truncated${lineTruncated ? " by line limit" : ""}${lineTruncated && byteTruncated ? " and" : ""}${byteTruncated ? " by byte limit" : ""}.`
    : undefined;

  return { content: content.trim(), ...(warning ? { warning } : {}) };
}

function buildPointerLine(entry: MemoryEntry): string {
  return `- [${normalizeLine(entry.title)}](${entry.fileName}) — ${normalizeLine(entry.hook)}`;
}

export function formatMemorySystemLocation(memoryDir: string): string[] {
  const entrypointPath = path.join(memoryDir, MEMORY_ENTRYPOINT);
  return [
    `You have a persistent, file-based project memory system at \`${memoryDir}\`.`,
    `The memory index file is \`${entrypointPath}\`.`,
    `The index points to topic memory files stored under \`${memoryDir}\` (including subdirectories).`,
    "Before creating a new memory, inspect existing topic files and update the best match when possible.",
  ];
}

export async function readMemoryEntrypoint(cwd: string): Promise<string | null> {
  const memoryDir = await ensureMemoryDirExists(cwd);
  const entrypoint = path.join(memoryDir, MEMORY_ENTRYPOINT);
  const raw = await fs.readFile(entrypoint, "utf-8");
  const truncated = truncateEntrypoint(raw);
  return [truncated.content, truncated.warning].filter(Boolean).join("\n\n") || null;
}

export async function collectMemoryMarkdownFiles(memoryDir: string, currentDir = memoryDir): Promise<string[]> {
  const dirents = await fs.readdir(currentDir, { withFileTypes: true });
  const nested = await Promise.all(
    dirents.map(async (entry) => {
      if (entry.name === ".trash") return [];
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        return collectMemoryMarkdownFiles(memoryDir, fullPath);
      }
      if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== MEMORY_ENTRYPOINT) {
        return [path.relative(memoryDir, fullPath)];
      }
      return [];
    }),
  );

  return nested.flat();
}

export async function loadMemoryHeaders(cwd: string): Promise<MemoryHeader[]> {
  const memoryDir = await ensureMemoryDirExists(cwd);
  const relativePaths = await collectMemoryMarkdownFiles(memoryDir);
  const headers = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const filePath = path.join(memoryDir, relativePath);
      let raw: string;
      try {
        raw = await fs.readFile(filePath, "utf-8");
      } catch {
        // Memory metadata is advisory context. A raced deletion or unreadable
        // file must not turn prompt construction into a Query failure.
        return null;
      }
      const governed = parseGovernedMemory(raw);
      if (!governed) return null;
      const frontmatter: MemoryFrontmatter = {
        name: governed.name,
        description: governed.description,
        type: governed.type,
      };
      return {
        fileName: relativePath,
        relativePath,
        filePath,
        title: frontmatter.name,
        hook: frontmatter.description,
        frontmatter,
        schemaVersion: governed.schemaVersion,
        source: governed.source,
        freshness: governed.freshness,
        ...(governed.revision ? { revision: governed.revision } : {}),
        ...(governed.expiresAt ? { expiresAt: governed.expiresAt } : {}),
      } satisfies MemoryHeader;
    }),
  );

  return headers
    .filter((header): header is MemoryHeader => header !== null)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function formatMemoryManifest(headers: readonly MemoryHeader[]): string {
  return headers
    .map((header) => {
      const governance = [
        `status=${header.freshness}`,
        `source=${header.source}`,
        header.revision ? `revision=${header.revision}` : "",
        header.expiresAt ? `expires=${header.expiresAt}` : "",
      ].filter(Boolean).join(", ");
      return `- [${header.frontmatter.type}] ${header.relativePath}: ${header.title} — ${header.hook} (${governance})`;
    })
    .join("\n");
}

export async function loadMemoryDocumentBodies(cwd: string, relativePaths: readonly string[]): Promise<MemoryDocument[]> {
  const memoryDir = await ensureMemoryDirExists(cwd);
  const uniquePaths = [...new Set(relativePaths)];
  const docs = await Promise.all(
    uniquePaths.map(async (relativePath) => {
      const filePath = path.join(memoryDir, relativePath);
      const raw = await fs.readFile(filePath, "utf-8");
      const governed = parseGovernedMemory(raw);
      if (!governed) return null;
      const frontmatter: MemoryFrontmatter = {
        name: governed.name,
        description: governed.description,
        type: governed.type,
      };
      return {
        fileName: relativePath,
        relativePath,
        filePath,
        title: frontmatter.name,
        hook: frontmatter.description,
        frontmatter,
        body: governed.body,
        schemaVersion: governed.schemaVersion,
        source: governed.source,
        freshness: governed.freshness,
        ...(governed.revision ? { revision: governed.revision } : {}),
        ...(governed.expiresAt ? { expiresAt: governed.expiresAt } : {}),
      } satisfies MemoryDocument;
    }),
  );

  return docs.filter((doc): doc is MemoryDocument => doc !== null);
}

export async function listMemoryFiles(cwd: string): Promise<MemoryDocument[]> {
  const headers = await loadMemoryHeaders(cwd);
  return loadMemoryDocumentBodies(cwd, headers.map((header) => header.relativePath));
}

function slugifyMemoryFileName(name: string): string {
  return sanitizeSlug(name).replace(/\.+/g, "-") + ".md";
}

async function rewriteEntrypoint(memoryDir: string, entries: MemoryEntry[]): Promise<void> {
  const entrypointPath = path.join(memoryDir, MEMORY_ENTRYPOINT);
  const unique = new Map<string, string>();
  for (const entry of entries) {
    unique.set(entry.fileName, buildPointerLine(entry));
  }

  const bodyLines = ["# Project Memory", "", ...[...unique.values()]];
  const truncated = truncateEntrypoint(bodyLines.join("\n"));
  const finalText = [truncated.content, truncated.warning].filter(Boolean).join("\n\n") + "\n";
  const temporaryPath = path.join(
    memoryDir,
    `.MEMORY-${process.pid}-${crypto.randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, finalText, "utf-8");
    await fs.rename(temporaryPath, entrypointPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function findExistingMemoryFile(cwd: string, name: string, description: string): Promise<string | null> {
  const docs = await listMemoryFiles(cwd);
  const normalizedName = normalizeLine(name).toLowerCase();
  const normalizedDescription = normalizeLine(description).toLowerCase();

  const exact = docs.find((doc) => doc.frontmatter.name.toLowerCase() === normalizedName);
  if (exact) return exact.fileName;

  const similar = docs.find((doc) => {
    const existing = `${doc.frontmatter.name} ${doc.frontmatter.description}`.toLowerCase();
    return existing.includes(normalizedName) || existing.includes(normalizedDescription);
  });

  return similar?.fileName ?? null;
}

export async function writeProjectMemory(input: {
  cwd: string;
  name: string;
  description: string;
  type: MemoryType;
  content: string;
  fileName?: string;
  source?: MemorySource;
  expectedRevision?: string;
  expiresAt?: string;
}): Promise<{ filePath: string; fileName: string; revision: string; updatedExisting: boolean }> {
  const memoryDir = await ensureMemoryDirExists(input.cwd);
  const existingFileName = input.fileName ?? (await findExistingMemoryFile(input.cwd, input.name, input.description));
  const fileName = existingFileName ?? slugifyMemoryFileName(input.name);
  const result = await writeGovernedMemory({
    memoryDir,
    fileName,
    name: input.name,
    description: input.description,
    type: input.type,
    source: input.source ?? "inference",
    content: input.content,
    ...(input.expectedRevision ? { expectedRevision: input.expectedRevision } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });
  const docs = await listMemoryFiles(input.cwd);
  await rewriteEntrypoint(memoryDir, docs.filter((doc) => doc.freshness !== "stale").map((doc) => ({
    fileName: doc.fileName,
    filePath: doc.filePath,
    title: doc.frontmatter.name,
    hook: doc.frontmatter.description,
  })));

  return result;
}

export async function archiveProjectMemory(input: {
  cwd: string;
  fileName: string;
  expectedRevision: string;
}): Promise<{ archivePath: string; revision: string }> {
  const memoryDir = await ensureMemoryDirExists(input.cwd);
  const result = await archiveGovernedMemory({
    memoryDir,
    fileName: input.fileName,
    expectedRevision: input.expectedRevision,
  });
  const docs = await listMemoryFiles(input.cwd);
  await rewriteEntrypoint(memoryDir, docs.filter((doc) => doc.freshness !== "stale").map((doc) => ({
    fileName: doc.fileName,
    filePath: doc.filePath,
    title: doc.frontmatter.name,
    hook: doc.frontmatter.description,
  })));
  return result;
}

export function shouldIgnoreMemory(query: string): boolean {
  const normalized = query.toLowerCase();
  return ["ignore memory", "don't use memory", "do not use memory", "忽略记忆", "不要用记忆", "别用记忆"].some((term) => normalized.includes(term));
}

export function buildMemoryPromptInstructions(): string[] {
  return [
    "Use memory only for information that will be useful in future conversations and cannot be derived directly from the current repo state.",
    "Supported memory types: user, feedback, project, reference.",
    "Use MemoryWrite with an explicit source: user, project, external, or inference.",
    "New memories receive schema, created_at, updated_at, and revision metadata automatically.",
    "Before updating an existing memory, re-read it and pass its current revision as expected_revision; conflicts must not be overwritten silently.",
    "An optional expires_at ISO timestamp marks when a memory becomes stale. Stale memory may be inspected but must not be treated as current fact.",
    "Use MemoryDelete with file_name and expected_revision for recoverable deletion; it archives the file under .trash.",
    `After writing or updating a memory file, update ${MEMORY_ENTRYPOINT} with a one-line pointer in the form: - [Title](file.md) — one-line hook.`,
    `${MEMORY_ENTRYPOINT} is an index, not a place to store full memory content.`,
    `Keep ${MEMORY_ENTRYPOINT} under ${MAX_ENTRYPOINT_LINES} lines and ${MAX_ENTRYPOINT_BYTES} bytes.`,
    "Before creating a new memory, inspect existing topic memory files and update the best match when possible.",
    "Legacy memories remain readable but have unknown provenance and freshness until explicitly rewritten.",
  ];
}
