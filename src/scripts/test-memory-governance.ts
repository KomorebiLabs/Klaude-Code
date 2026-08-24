import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MemoryConflictError,
  MemoryPathError,
  archiveGovernedMemory,
  parseGovernedMemory,
  writeGovernedMemory,
} from "../context/memory/governance.js";
import { memoryWriteTool } from "../tools/memoryWriteTool.js";
import { memoryDeleteTool } from "../tools/memoryDeleteTool.js";
import {
  buildMemoryPromptInstructions,
  collectMemoryMarkdownFiles,
} from "../context/memory/memdir.js";
import { summarizeMemoryDirectory } from "../diagnostics/memoryAnalysis.js";

const writeProperties = (memoryWriteTool.inputSchema.properties ?? {}) as Record<string, unknown>;
assert.ok("source" in writeProperties);
assert.ok("expected_revision" in writeProperties);
assert.ok("expires_at" in writeProperties);
assert.ok(memoryWriteTool.inputSchema.required?.includes("source"));
assert.equal(memoryDeleteTool.name, "MemoryDelete");
assert.equal(memoryDeleteTool.isReadOnly(), false);
const memoryInstructions = buildMemoryPromptInstructions().join("\n");
assert.ok(memoryInstructions.includes("expected_revision"));
assert.ok(memoryInstructions.includes("MemoryDelete"));
assert.ok(memoryInstructions.includes("stale"));

const root = await mkdtemp(join(tmpdir(), "klaude-memory-governance-"));
const memoryDir = join(root, "memory");
await mkdir(memoryDir, { recursive: true });

try {
  const created = await writeGovernedMemory({
    memoryDir,
    fileName: "preferences.md",
    name: "Collaboration preference",
    description: "Lead with the outcome",
    type: "feedback",
    source: "user",
    content: "Lead with the outcome before implementation details.",
    now: new Date("2026-08-24T00:00:00.000Z"),
  });
  assert.equal(created.updatedExisting, false);
  assert.match(created.revision, /^[a-f0-9]{16}$/);

  const parsed = parseGovernedMemory(
    await readFile(created.filePath, "utf-8"),
    new Date("2026-08-24T01:00:00.000Z"),
  );
  assert.equal(parsed?.schemaVersion, 2);
  assert.equal(parsed?.source, "user");
  assert.equal(parsed?.freshness, "active");
  assert.equal(parsed?.revision, created.revision);
  assert.equal(
    parseGovernedMemory(
      (await readFile(created.filePath, "utf-8")).replace(
        "Lead with the outcome before implementation details.",
        "Tampered content.",
      ),
    ),
    null,
  );

  await assert.rejects(
    writeGovernedMemory({
      memoryDir,
      fileName: "preferences.md",
      name: "Collaboration preference",
      description: "Lead with evidence",
      type: "feedback",
      source: "user",
      content: "Lead with evidence.",
      now: new Date("2026-08-24T02:00:00.000Z"),
    }),
    MemoryConflictError,
  );

  const updated = await writeGovernedMemory({
    memoryDir,
    fileName: "preferences.md",
    name: "Collaboration preference",
    description: "Lead with evidence",
    type: "feedback",
    source: "user",
    content: "Lead with evidence.",
    expectedRevision: created.revision,
    now: new Date("2026-08-24T02:00:00.000Z"),
    expiresAt: "2026-08-25T00:00:00.000Z",
  });
  assert.notEqual(updated.revision, created.revision);
  const stale = parseGovernedMemory(
    await readFile(updated.filePath, "utf-8"),
    new Date("2026-08-26T00:00:00.000Z"),
  );
  assert.equal(stale?.freshness, "stale");

  await writeFile(
    join(memoryDir, "legacy.md"),
    "---\nname: Legacy\ndescription: Old entry\ntype: project\n---\n\nOld body\n",
    "utf-8",
  );
  const memorySummary = await summarizeMemoryDirectory(memoryDir, {
    now: new Date("2026-08-26T00:00:00.000Z"),
  });
  assert.equal(memorySummary.status, "degraded");
  assert.equal(memorySummary.staleCount, 1);
  assert.equal(memorySummary.legacyCount, 1);
  assert.equal(memorySummary.activeCount, 0);

  const legacy = parseGovernedMemory(
    "---\nname: Legacy\ndescription: Old entry\ntype: project\n---\n\nOld body\n",
    new Date("2026-08-24T00:00:00.000Z"),
  );
  assert.equal(legacy?.schemaVersion, 1);
  assert.equal(legacy?.freshness, "legacy");
  assert.equal(legacy?.source, "unknown");
  assert.match(legacy?.revision ?? "", /^[a-f0-9]{16}$/);

  for (const fileName of [
    "../escape.md",
    "C:\\escape.md",
    "/escape.md",
    "MEMORY.md",
    ".trash/hidden.md",
    "not-markdown.txt",
  ]) {
    await assert.rejects(
      writeGovernedMemory({
        memoryDir,
        fileName,
        name: "Invalid",
        description: "Invalid path",
        type: "project",
        source: "inference",
        content: "Must not be written.",
      }),
      MemoryPathError,
    );
  }

  const outside = join(root, "outside.md");
  await writeFile(outside, "outside", "utf-8");
  const link = join(memoryDir, "linked.md");
  let symlinkCreated = false;
  try {
    await symlink(outside, link, "file");
    symlinkCreated = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
  if (symlinkCreated) {
    await assert.rejects(
      writeGovernedMemory({
        memoryDir,
        fileName: "linked.md",
        name: "Linked",
        description: "Must be rejected",
        type: "project",
        source: "inference",
        content: "Must not escape.",
      }),
      MemoryPathError,
    );
  }

  const outsideDir = join(root, "outside-memory");
  const linkedMemoryDir = join(root, "linked-memory");
  await mkdir(outsideDir);
  let rootLinkCreated = false;
  try {
    await symlink(outsideDir, linkedMemoryDir, "junction");
    rootLinkCreated = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
  if (rootLinkCreated) {
    await assert.rejects(
      writeGovernedMemory({
        memoryDir: linkedMemoryDir,
        fileName: "escaped.md",
        name: "Escaped",
        description: "Must not follow root links",
        type: "project",
        source: "inference",
        content: "Must not be written.",
      }),
      MemoryPathError,
    );
  }

  const trashGuardDir = join(root, "trash-guard-memory");
  const trashOutsideDir = join(root, "trash-outside");
  await mkdir(trashGuardDir);
  await mkdir(trashOutsideDir);
  const trashGuardMemory = await writeGovernedMemory({
    memoryDir: trashGuardDir,
    fileName: "guarded.md",
    name: "Guarded",
    description: "Trash link must be rejected",
    type: "project",
    source: "inference",
    content: "Guarded content.",
  });
  let trashLinkCreated = false;
  try {
    await symlink(trashOutsideDir, join(trashGuardDir, ".trash"), "junction");
    trashLinkCreated = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
  if (trashLinkCreated) {
    await assert.rejects(
      archiveGovernedMemory({
        memoryDir: trashGuardDir,
        fileName: "guarded.md",
        expectedRevision: trashGuardMemory.revision,
      }),
      MemoryPathError,
    );
  }

  await assert.rejects(
    archiveGovernedMemory({
      memoryDir,
      fileName: "preferences.md",
      expectedRevision: "0000000000000000",
      now: new Date("2026-08-26T00:00:00.000Z"),
    }),
    MemoryConflictError,
  );
  const archived = await archiveGovernedMemory({
    memoryDir,
    fileName: "preferences.md",
    expectedRevision: updated.revision,
    now: new Date("2026-08-26T00:00:00.000Z"),
  });
  assert.ok(archived.archivePath.includes(".trash"));
  assert.equal(
    parseGovernedMemory(await readFile(archived.archivePath, "utf-8"))?.revision,
    updated.revision,
  );
  await assert.rejects(readFile(updated.filePath, "utf-8"));
  assert.deepEqual(await collectMemoryMarkdownFiles(memoryDir), ["legacy.md"]);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("memory schema/path/conflict/expiry/archive tests passed");
