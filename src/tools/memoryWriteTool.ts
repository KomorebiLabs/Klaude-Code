import { writeProjectMemory } from "../context/memory/memdir.js";
import {
  MEMORY_SOURCES,
  MemoryConflictError,
  MemoryPathError,
  type MemorySource,
} from "../context/memory/governance.js";
import { isMemoryType } from "../context/memory/memoryTypes.js";
import type { Tool, ToolResult } from "./Tool.js";

export const memoryWriteTool: Tool = {
  name: "MemoryWrite",
  description:
    "Save durable project memory for future conversations. Only store information that cannot be derived directly from the current repository state.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short memory title." },
      description: { type: "string", description: "One-line hook used in MEMORY.md." },
      type: {
        type: "string",
        enum: ["user", "feedback", "project", "reference"],
        description: "Memory type.",
      },
      content: { type: "string", description: "Full markdown memory content." },
      file_name: { type: "string", description: "Optional target file name." },
      source: {
        type: "string",
        enum: ["user", "project", "external", "inference"],
        description: "Where this memory fact originated.",
      },
      expected_revision: {
        type: "string",
        description: "Required current revision when updating an existing memory.",
      },
      expires_at: {
        type: "string",
        description: "Optional ISO timestamp after which this memory is stale.",
      },
    },
    required: ["name", "description", "type", "content", "source"],
    additionalProperties: false,
  },
  async call(input, context): Promise<ToolResult> {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const type = input.type;
    const content = typeof input.content === "string" ? input.content.trim() : "";
    const fileName = typeof input.file_name === "string" ? input.file_name.trim() : undefined;
    const source = input.source;
    const expectedRevision = typeof input.expected_revision === "string"
      ? input.expected_revision.trim()
      : undefined;
    const expiresAt = typeof input.expires_at === "string" ? input.expires_at.trim() : undefined;

    if (
      !name ||
      !description ||
      !content ||
      !isMemoryType(type) ||
      typeof source !== "string" ||
      !MEMORY_SOURCES.includes(source as MemorySource)
    ) {
      return {
        content: "Error: name, description, content, source, and a valid memory type are required.",
        isError: true,
      };
    }

    try {
      const result = await writeProjectMemory({
        cwd: context.cwd,
        name,
        description,
        type,
        source: source as MemorySource,
        content,
        ...(fileName ? { fileName } : {}),
        ...(expectedRevision ? { expectedRevision } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });

      return {
        content: result.updatedExisting
          ? `Updated ${type} memory in ${result.fileName} (revision ${result.revision}).`
          : `Saved ${type} memory to ${result.fileName} (revision ${result.revision}).`,
      };
    } catch (error) {
      if (error instanceof MemoryConflictError) {
        return {
          content: error.currentRevision
            ? `Memory conflict. Re-read the memory and retry with expected_revision ${error.currentRevision}.`
            : "Memory conflict. Re-read the memory before retrying.",
          isError: true,
        };
      }
      if (error instanceof MemoryPathError) {
        return { content: "Error: invalid governed memory path.", isError: true };
      }
      throw error;
    }
  },
  isReadOnly() {
    return false;
  },
  isEnabled() {
    return true;
  },
};
