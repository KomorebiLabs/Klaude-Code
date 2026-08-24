import type { Tool, ToolContext, ToolResult } from "./Tool.js";
import {
  normalizeToolTimeout,
  runManagedProcess,
} from "./processLifecycle.js";
import {
  annotateStderrWithSandboxFailures,
  buildSandboxProfile,
  loadSandboxSettings,
  shouldUseSandbox,
  wrapWithSandbox,
  type ResolvedSandboxSettings,
} from "../sandbox/index.js";
import {
  appendBashProgress,
  completeBashProgress,
  startBashProgress,
} from "../state/bashProgressStore.js";
import { readMergedEnv } from "../utils/settings.js";
import { createSafeDiagnosticMessage } from "../observability/redaction.js";

interface BashInput {
  command: string;
  timeout?: number;
  /**
   * Per-call escape: if true AND the user's policy allows model escapes
   * (`sandbox.allowUnsandboxedCommands`), this command runs OUTSIDE the
   * sandbox even when sandboxing is enabled. The model is encouraged to
   * leave this off — see the description below.
   */
  dangerouslyDisableSandbox?: boolean;
}

/**
 * Build the SandboxProfile to feed to wrapWithSandbox(). We re-load
 * sandbox settings + permission rules on every call so that the user
 * approving a permission rule mid-session takes effect on the next
 * Bash command — no restart required (matches source code's
 * settingsChangeDetector + refreshConfig pattern).
 */
async function buildProfileForCwd(
  cwd: string,
  settings: ResolvedSandboxSettings,
) {
  // Dynamic import: bashTool ⇄ permissions form a static-import cycle
  // (permissions wants `isReadOnlyCommand` from us). We break it here
  // — this path only runs when sandboxing is on, so the extra import
  // cost is negligible.
  const { loadPermissionSettings } = await import("../permissions/permissions.js");
  const permissionSettings = await loadPermissionSettings(cwd);
  return buildSandboxProfile({
    cwd,
    settings,
    permissions: { allow: permissionSettings.allow, deny: permissionSettings.deny },
  });
}

const READ_ONLY_COMMANDS = new Set([
  "ls",
  "cat",
  "grep",
  "rg",
  "find",
  "fd",
  "pwd",
  "which",
  "git status",
  "git log",
  "git diff",
  "git show",
  "head",
  "tail",
  "wc",
  "sed",
]);

function splitCommandSegments(command: string): string[] {
  return command
    .split(/&&|\|\||\|/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isReadOnlyCommand(command: string): boolean {
  const segments = splitCommandSegments(command);
  if (segments.length === 0) return false;
  return segments.every((segment) => {
    const normalized = segment.replace(/\s+/g, " ").trim();
    if (READ_ONLY_COMMANDS.has(normalized)) return true;
    const firstTwo = normalized.split(" ").slice(0, 2).join(" ");
    if (READ_ONLY_COMMANDS.has(firstTwo)) return true;
    const first = normalized.split(" ")[0];
    return READ_ONLY_COMMANDS.has(first);
  });
}

export const bashTool: Tool = {
  name: "Bash",
  externalSource: {
    kind: "process",
    sourceName: "local",
    operationName: "shell",
  },
  description: "Execute a shell command in the current working directory and return stdout/stderr.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 120000)" },
      dangerouslyDisableSandbox: {
        type: "boolean",
        description:
          "If true, run this command OUTSIDE the sandbox even when sandboxing is enabled. Only use this when the command genuinely needs unrestricted access (e.g. installing system packages, running docker, accessing devices). Most commands should run inside the sandbox.",
      },
    },
    required: ["command"],
  },
  async call(rawInput: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = rawInput as unknown as BashInput;
    if (!input.command) {
      return { content: "Error: command is required", isError: true };
    }

    const timeoutMs = normalizeToolTimeout(input.timeout);

    // Decide sandbox wrapping. We swallow load errors and proceed with
    // sandboxing OFF — settings.json being unparseable shouldn't block
    // command execution; the permission system already surfaces those
    // errors loudly elsewhere.
    let sandboxSettings: ResolvedSandboxSettings | null = null;
    try {
      sandboxSettings = await loadSandboxSettings(context.cwd);
    } catch {
      sandboxSettings = null;
    }

    const willSandbox = sandboxSettings
      ? shouldUseSandbox(
          {
            command: input.command,
            dangerouslyDisableSandbox: input.dangerouslyDisableSandbox,
          },
          sandboxSettings,
        )
      : false;

    let executedCommand = input.command;
    if (willSandbox && sandboxSettings) {
      const profile = await buildProfileForCwd(context.cwd, sandboxSettings);
      const wrap = wrapWithSandbox(input.command, profile);
      executedCommand = wrap.wrappedCommand;
    }

    // Live progress: publish stdout/stderr chunks keyed by this call's
    // tool_use id so the UI can show the command's tail while it runs. Only
    // active when an interactive frontend supplied a toolUseId.
    const progressId = context.toolUseId;
    if (progressId) startBashProgress(progressId, timeoutMs);

    // Inject the merged `env` setting (trusted sources only) on top of the
    // process environment. Lets users/projects export vars (PATH additions,
    // tokens, etc.) into every command without a wrapper script. Untrusted
    // project/local env is dropped by readMergedEnv's trust gate. A bad read
    // must not block execution, so we degrade to the bare process env.
    let settingsEnv: Record<string, string> = {};
    try {
      settingsEnv = await readMergedEnv(context.cwd);
    } catch {
      settingsEnv = {};
    }

    const execution = await runManagedProcess({
      executable: process.env.SHELL || "bash",
      args: ["-lc", executedCommand],
      cwd: context.cwd,
      env: { ...process.env, ...settingsEnv },
      timeoutMs,
      abortSignal: context.abortSignal,
      onStdout: progressId
        ? (text) => appendBashProgress(progressId, text)
        : undefined,
      onStderr: progressId
        ? (text) => appendBashProgress(progressId, text)
        : undefined,
    });
    if (progressId) completeBashProgress(progressId);

    if (execution.status === "timeout") {
      return {
        content: `Command timed out after ${timeoutMs}ms (termination: ${execution.termination})`,
        isError: true,
        diagnostics: {
          termination: execution.termination === "degraded" ? "degraded" : "timeout",
          sandboxState: willSandbox ? "enabled" : "disabled",
        },
      };
    }
    if (execution.status === "aborted") {
      return {
        content: `Command aborted (termination: ${execution.termination})`,
        isError: true,
        diagnostics: {
          termination: execution.termination === "degraded" ? "degraded" : "aborted",
          sandboxState: willSandbox ? "enabled" : "disabled",
        },
      };
    }
    if (execution.status === "spawn_error") {
      return {
        content: `Failed to start command: ${createSafeDiagnosticMessage(execution.errorMessage)}`,
        isError: true,
        diagnostics: {
          termination: "degraded",
          sandboxState: willSandbox ? "enabled" : "disabled",
        },
      };
    }

    // Tag stderr with <sandbox_violations>...</sandbox_violations>
    // when the failure smells like a sandbox denial. The model uses
    // this signal to decide whether to retry, ask for permission,
    // or back off. The UI strips the tag before rendering.
    const annotatedStderr = willSandbox
      ? annotateStderrWithSandboxFailures(execution.stderr, execution.exitCode)
      : execution.stderr;
    const output = [
      `Command: ${input.command}`,
      `Read-only: ${isReadOnlyCommand(input.command)}`,
      `Sandbox: ${willSandbox ? "enabled" : "disabled"}`,
      `Exit code: ${execution.exitCode ?? -1}`,
      execution.stdout ? `\nSTDOUT:\n${execution.stdout}` : "",
      annotatedStderr ? `\nSTDERR:\n${annotatedStderr}` : "",
    ].filter(Boolean).join("\n");

    return {
      content: output,
      isError: (execution.exitCode ?? 1) !== 0,
      diagnostics: {
        termination: "completed",
        sandboxState: willSandbox ? "enabled" : "disabled",
      },
    };
  },
  isReadOnly(): boolean {
    return false;
  },
  isEnabled(): boolean {
    return true;
  },
};
