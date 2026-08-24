import type { Tool, ToolContext, ToolResult } from "./Tool.js";
import {
  normalizeToolTimeout,
  runManagedProcess,
} from "./processLifecycle.js";
import { readMergedEnv } from "../utils/settings.js";
import { createSafeDiagnosticMessage } from "../observability/redaction.js";

/**
 * PowerShell — execute a PowerShell command on Windows.
 *
 * Reference: claude-code-source-code/src/tools/PowerShellTool/. It mirrors
 * Bash but for the Windows shell. This tool registers ONLY on Windows
 * (isEnabled gates on process.platform), so non-Windows tool lists never see
 * it. The macOS sandbox does not apply here (Windows sandboxing is out of
 * scope, consistent with the project's macOS-only sandbox), which the
 * description and prompt make explicit.
 */
interface PowerShellInput {
  command: string;
  timeout?: number;
}

function resolveExecutable(): string {
  // pwsh (PowerShell 7+) if explicitly requested; default to Windows PowerShell.
  return process.env.EASY_AGENT_POWERSHELL || "powershell.exe";
}

export const powerShellTool: Tool = {
  name: "PowerShell",
  externalSource: {
    kind: "process",
    sourceName: "local",
    operationName: "powershell",
  },
  description:
    "Execute a PowerShell command on Windows and return stdout/stderr. Use this instead of Bash on Windows. Note: not sandboxed.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: { type: "string", description: "PowerShell command to execute" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 120000)" },
    },
    required: ["command"],
  },
  async call(rawInput: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = rawInput as unknown as PowerShellInput;
    if (!input.command) {
      return { content: "Error: command is required", isError: true };
    }
    const timeoutMs = normalizeToolTimeout(input.timeout);

    let settingsEnv: Record<string, string> = {};
    try {
      settingsEnv = await readMergedEnv(context.cwd);
    } catch {
      settingsEnv = {};
    }

    const execution = await runManagedProcess({
      executable: resolveExecutable(),
      args: ["-NoProfile", "-NonInteractive", "-Command", input.command],
      cwd: context.cwd,
      env: { ...process.env, ...settingsEnv },
      timeoutMs,
      abortSignal: context.abortSignal,
    });

    if (execution.status === "timeout") {
      return {
        content: `Command timed out after ${timeoutMs}ms (termination: ${execution.termination})`,
        isError: true,
        diagnostics: {
          termination: execution.termination === "degraded" ? "degraded" : "timeout",
          sandboxState: "unsupported",
        },
      };
    }
    if (execution.status === "aborted") {
      return {
        content: `Command aborted (termination: ${execution.termination})`,
        isError: true,
        diagnostics: {
          termination: execution.termination === "degraded" ? "degraded" : "aborted",
          sandboxState: "unsupported",
        },
      };
    }
    if (execution.status === "spawn_error") {
      return {
        content: `Failed to start PowerShell: ${createSafeDiagnosticMessage(execution.errorMessage)}`,
        isError: true,
        diagnostics: { termination: "degraded", sandboxState: "unsupported" },
      };
    }

    const output = [
      `Command: ${input.command}`,
      `Exit code: ${execution.exitCode ?? -1}`,
      execution.stdout ? `\nSTDOUT:\n${execution.stdout}` : "",
      execution.stderr ? `\nSTDERR:\n${execution.stderr}` : "",
    ].filter(Boolean).join("\n");
    return {
      content: output,
      isError: (execution.exitCode ?? 1) !== 0,
      diagnostics: { termination: "completed", sandboxState: "unsupported" },
    };
  },
  isReadOnly(): boolean {
    return false;
  },
  isEnabled(): boolean {
    return process.platform === "win32";
  },
};
