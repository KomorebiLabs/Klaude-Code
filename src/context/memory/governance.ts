import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { MemoryType } from "./memoryTypes.js";
import { isMemoryType } from "./memoryTypes.js";

export const MEMORY_SCHEMA_VERSION = 2 as const;
export const MEMORY_SOURCES = ["user", "project", "external", "inference"] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];
export type MemoryFreshness = "active" | "stale" | "legacy";

export interface GovernedMemoryDocument {
  schemaVersion: 1 | typeof MEMORY_SCHEMA_VERSION;
  name: string;
  description: string;
  type: MemoryType;
  source: MemorySource | "unknown";
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  revision?: string;
  freshness: MemoryFreshness;
  body: string;
}

export class MemoryPathError extends Error {
  constructor(message = "Memory path is outside the governed memory directory.") {
    super(message);
    this.name = "MemoryPathError";
  }
}

export class MemoryConflictError extends Error {
  readonly currentRevision?: string;

  constructor(message: string, currentRevision?: string) {
    super(message);
    this.name = "MemoryConflictError";
    this.currentRevision = currentRevision;
  }
}

function normalizeLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseFields(raw: string): Map<string, string> | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return fields;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function isMemorySource(value: unknown): value is MemorySource {
  return typeof value === "string" && MEMORY_SOURCES.includes(value as MemorySource);
}

export function parseGovernedMemory(
  raw: string,
  now = new Date(),
): GovernedMemoryDocument | null {
  const fields = parseFields(raw);
  if (!fields) return null;
  const name = fields.get("name");
  const description = fields.get("description");
  const type = fields.get("type");
  if (!name || !description || !isMemoryType(type)) return null;

  const schema = fields.get("schema");
  if (schema !== String(MEMORY_SCHEMA_VERSION)) {
    return {
      schemaVersion: 1,
      name: normalizeLine(name),
      description: normalizeLine(description),
      type,
      source: "unknown",
      freshness: "legacy",
      revision: createHash("sha256").update(raw).digest("hex").slice(0, 16),
      body: stripFrontmatter(raw),
    };
  }

  const source = fields.get("source");
  const createdAt = fields.get("created_at");
  const updatedAt = fields.get("updated_at");
  const expiresAt = fields.get("expires_at");
  const revision = fields.get("revision");
  if (
    !isMemorySource(source) ||
    !createdAt ||
    !updatedAt ||
    !isIsoDate(createdAt) ||
    !isIsoDate(updatedAt) ||
    (expiresAt !== undefined && !isIsoDate(expiresAt)) ||
    !revision ||
    !/^[a-f0-9]{16}$/.test(revision)
  ) {
    return null;
  }

  const normalizedName = normalizeLine(name);
  const normalizedDescription = normalizeLine(description);
  const body = stripFrontmatter(raw);
  const computedRevision = computeRevision({
    name: normalizedName,
    description: normalizedDescription,
    type,
    source,
    createdAt,
    updatedAt,
    ...(expiresAt ? { expiresAt } : {}),
    content: body,
  });
  if (computedRevision !== revision) return null;

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    name: normalizedName,
    description: normalizedDescription,
    type,
    source,
    createdAt,
    updatedAt,
    ...(expiresAt ? { expiresAt } : {}),
    revision,
    freshness: expiresAt && Date.parse(expiresAt) <= now.getTime() ? "stale" : "active",
    body,
  };
}

function computeRevision(input: {
  name: string;
  description: string;
  type: MemoryType;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  content: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 16);
}

function validateRelativeFileName(fileName: string): string {
  if (!fileName || fileName.includes("\0") || isAbsolute(fileName) || /^[a-zA-Z]:[\\/]/.test(fileName)) {
    throw new MemoryPathError();
  }
  const normalized = fileName.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (
    !normalized.endsWith(".md") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    normalized.toLowerCase() === "memory.md" ||
    segments[0]?.toLowerCase() === ".trash"
  ) {
    throw new MemoryPathError();
  }
  return normalized;
}

async function resolveGovernedPath(memoryDir: string, fileName: string): Promise<string> {
  const normalized = validateRelativeFileName(fileName);
  await mkdir(memoryDir, { recursive: true });
  const rootStat = await lstat(memoryDir);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new MemoryPathError();
  const canonicalRoot = await realpath(memoryDir);
  const target = resolve(canonicalRoot, ...normalized.split("/"));
  const rel = relative(canonicalRoot, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new MemoryPathError();
  }

  const parts = normalized.split("/");
  let current = canonicalRoot;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new MemoryPathError();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current);
    }
  }

  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new MemoryPathError();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return target;
}

function serializeGovernedMemory(input: {
  name: string;
  description: string;
  type: MemoryType;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  revision: string;
  content: string;
}): string {
  return [
    "---",
    `schema: ${MEMORY_SCHEMA_VERSION}`,
    `name: ${normalizeLine(input.name)}`,
    `description: ${normalizeLine(input.description)}`,
    `type: ${input.type}`,
    `source: ${input.source}`,
    `created_at: ${input.createdAt}`,
    `updated_at: ${input.updatedAt}`,
    ...(input.expiresAt ? [`expires_at: ${input.expiresAt}`] : []),
    `revision: ${input.revision}`,
    "---",
    "",
    input.content.trim(),
    "",
  ].join("\n");
}

export async function writeGovernedMemory(input: {
  memoryDir: string;
  fileName: string;
  name: string;
  description: string;
  type: MemoryType;
  source: MemorySource;
  content: string;
  expectedRevision?: string;
  expiresAt?: string;
  now?: Date;
}): Promise<{ filePath: string; fileName: string; revision: string; updatedExisting: boolean }> {
  const filePath = await resolveGovernedPath(input.memoryDir, input.fileName);
  const now = (input.now ?? new Date()).toISOString();
  if (input.expiresAt && !isIsoDate(input.expiresAt)) {
    throw new MemoryConflictError("expires_at must be an ISO timestamp.");
  }

  let existing: GovernedMemoryDocument | null = null;
  try {
    existing = parseGovernedMemory(await readFile(filePath, "utf-8"));
    if (!existing) throw new MemoryConflictError("Existing memory metadata is invalid.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (existing) {
    if (!input.expectedRevision || input.expectedRevision !== existing.revision) {
      throw new MemoryConflictError(
        "Memory changed or expected_revision was not provided.",
        existing.revision,
      );
    }
  } else if (input.expectedRevision) {
    throw new MemoryConflictError("Memory no longer exists.");
  }

  const createdAt = existing?.createdAt ?? now;
  const revisionInput = {
    name: normalizeLine(input.name),
    description: normalizeLine(input.description),
    type: input.type,
    source: input.source,
    createdAt,
    updatedAt: now,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    content: input.content.trim(),
  };
  const revision = computeRevision(revisionInput);
  await writeFile(filePath, serializeGovernedMemory({ ...revisionInput, revision }), "utf-8");
  return {
    filePath,
    fileName: validateRelativeFileName(input.fileName),
    revision,
    updatedExisting: Boolean(existing),
  };
}

export async function archiveGovernedMemory(input: {
  memoryDir: string;
  fileName: string;
  expectedRevision: string;
  now?: Date;
}): Promise<{ archivePath: string; revision: string }> {
  const filePath = await resolveGovernedPath(input.memoryDir, input.fileName);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MemoryConflictError("Memory no longer exists.");
    }
    throw error;
  }
  const document = parseGovernedMemory(raw);
  if (!document?.revision || document.revision !== input.expectedRevision) {
    throw new MemoryConflictError("Memory revision does not match.", document?.revision);
  }

  const canonicalMemoryDir = await realpath(input.memoryDir);
  const trashDir = resolve(canonicalMemoryDir, ".trash");
  try {
    const trashStat = await lstat(trashDir);
    if (!trashStat.isDirectory() || trashStat.isSymbolicLink()) {
      throw new MemoryPathError("Memory archive directory must be a real directory.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(trashDir);
  }
  const stamp = (input.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const baseName = validateRelativeFileName(input.fileName).replace(/\//g, "-").replace(/\.md$/i, "");
  const archivePath = resolve(trashDir, `${baseName}-${stamp}-${document.revision}.md`);
  await rename(filePath, archivePath);
  return { archivePath, revision: document.revision };
}
