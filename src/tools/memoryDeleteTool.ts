import { archiveProjectMemory } from "../context/memory/memdir.js";
import {
  MemoryConflictError,
  MemoryPathError,
} from "../context/memory/governance.js";
import type { Tool, ToolResult } from "./Tool.js";

export const memoryDeleteTool: Tool = {
  name: "MemoryDelete",
  description:
    "Archive a governed project memory after verifying its current revision. The file remains recoverable under .trash.",
  inputSchema: {
    type: "object",
    properties: {
      file_name: { type: "string", description: "Relative memory markdown file name." },
      expected_revision: {
        type: "string",
        description: "Current revision shown by the memory metadata.",
      },
    },
    required: ["file_name", "expected_revision"],
    additionalProperties: false,
  },
  async call(input, context): Promise<ToolResult> {
    const fileName = typeof input.file_name === "string" ? input.file_name.trim() : "";
    const expectedRevision = typeof input.expected_revision === "string"
      ? input.expected_revision.trim()
      : "";
    if (!fileName || !/^[a-f0-9]{16}$/.test(expectedRevision)) {
      return {
        content: "Error: file_name and a valid expected_revision are required.",
        isError: true,
      };
    }

    try {
      const result = await archiveProjectMemory({
        cwd: context.cwd,
        fileName,
        expectedRevision,
      });
      return {
        content: `Archived ${fileName} at revision ${result.revision}. The memory remains recoverable in .trash.`,
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
