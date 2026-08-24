#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  checkPermission,
  type PermissionMode,
  type PermissionSettings,
} from "../permissions/permissions.js";
import { findToolByName } from "../tools/index.js";
import { clearMcpTools, registerMcpTools } from "../tools/index.js";
import { runTools } from "../core/agenticLoop.js";
import { toolResultText, type Tool } from "../tools/Tool.js";

interface DenyFixture {
  name: string;
  mode: PermissionMode;
  toolName: string;
  input: Record<string, unknown>;
  denyRule: string;
}

function settings(mode: PermissionMode, deny: string[]): PermissionSettings {
  return { mode, allow: [], deny };
}

async function testExplicitDenyPrecedence(): Promise<void> {
  const fixtures: DenyFixture[] = [
    {
      name: "default read-only",
      mode: "default",
      toolName: "Read",
      input: { file_path: "package.json" },
      denyRule: "Read",
    },
    {
      name: "plan read-only",
      mode: "plan",
      toolName: "Read",
      input: { file_path: "package.json" },
      denyRule: "Read",
    },
    {
      name: "auto read-only",
      mode: "auto",
      toolName: "Read",
      input: { file_path: "package.json" },
      denyRule: "Read",
    },
    {
      name: "coordination fast-path",
      mode: "default",
      toolName: "TeamDelete",
      input: { team_name: "synthetic-team" },
      denyRule: "TeamDelete",
    },
    {
      name: "preapproved WebFetch domain",
      mode: "default",
      toolName: "WebFetch",
      input: { url: "https://docs.python.org/3/", prompt: "synthetic" },
      denyRule: "WebFetch(domain:docs.python.org)",
    },
  ];

  for (const fixture of fixtures) {
    const tool = findToolByName(fixture.toolName);
    assert(tool, `${fixture.name}: tool must be registered`);
    const result = await checkPermission({
      tool,
      input: fixture.input,
      cwd: process.cwd(),
      mode: fixture.mode,
      settings: settings(fixture.mode, [fixture.denyRule]),
    });
    assert.equal(result.behavior, "deny", `${fixture.name}: explicit deny must win`);
    assert.equal(
      (result as typeof result & { decisionSource?: string }).decisionSource,
      "explicit_deny",
      `${fixture.name}: provenance must identify explicit deny`,
    );
  }
}

async function testInvalidInputStopsBeforePermissionAndExecution(): Promise<void> {
  let hookCalls = 0;
  let promptCalls = 0;
  let toolCalls = 0;
  const probe: Tool = {
    name: "ContractProbe",
    description: "Synthetic contract probe",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string" },
        mode: { type: "string", enum: ["safe", "unsafe"] },
      },
    },
    async call() {
      toolCalls += 1;
      return { content: "executed" };
    },
    isReadOnly: () => false,
    isEnabled: () => true,
  };

  registerMcpTools([probe]);
  try {
    const result = await runTools(
      [{ type: "tool_use", id: "invalid-1", name: probe.name, input: { command: 42 } }],
      { cwd: process.cwd() },
      {
        preToolUseHookImpl: async () => {
          hookCalls += 1;
          return { results: [] };
        },
        onPermissionRequest: async () => {
          promptCalls += 1;
          return "allow_once";
        },
      },
    );
    assert.equal(hookCalls, 0, "invalid input must not reach PreToolUse Hook");
    assert.equal(promptCalls, 0, "invalid input must not reach permission prompt");
    assert.equal(toolCalls, 0, "invalid input must not execute the tool");
    assert.match(
      toolResultText(result.executions[0]!.result.content),
      /invalid tool input/i,
    );
  } finally {
    clearMcpTools();
  }
}

async function testDenyAndAskResolutionContract(): Promise<void> {
  let toolCalls = 0;
  let promptCalls = 0;
  const probe: Tool = {
    name: "ContractProbe",
    description: "Synthetic contract probe",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: { command: { type: "string" } },
    },
    async call() {
      toolCalls += 1;
      return { content: "executed" };
    },
    isReadOnly: () => false,
    isEnabled: () => true,
  };
  const block = [{ type: "tool_use" as const, id: "contract-1", name: probe.name, input: { command: "safe" } }];
  const allowHook = async () => ({
    results: [],
    permissionBehavior: "allow" as const,
    permissionDecisionReason: "synthetic hook allow",
  });

  registerMcpTools([probe]);
  try {
    await runTools(block, { cwd: process.cwd() }, {
      permissionSettings: settings("default", [probe.name]),
      preToolUseHookImpl: allowHook,
      onPermissionRequest: async () => {
        promptCalls += 1;
        return "allow_once";
      },
    });
    assert.equal(toolCalls, 0, "Hook allow must not upgrade explicit deny");
    assert.equal(promptCalls, 0, "explicit deny must not prompt");

    await runTools(block, { cwd: process.cwd() }, {
      preToolUseHookImpl: allowHook,
      onPermissionRequest: async () => {
        promptCalls += 1;
        return "allow_once";
      },
    });
    assert.equal(toolCalls, 1, "Hook allow may resolve ordinary ask");
    assert.equal(promptCalls, 0, "Hook-resolved ask must not prompt");

    const bypassTrace: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
    await runTools(block, { cwd: process.cwd() }, {
      entryPoint: "headless",
      shouldAvoidPermissionPrompts: true,
      bypassPermissions: true,
      traceSink: {
        emit(eventType, payload) {
          bypassTrace.push({ eventType, payload });
        },
        async close() {},
        getStatus() {
          return { state: "active" as const, droppedEvents: 0 };
        },
      },
      onPermissionRequest: async () => {
        promptCalls += 1;
        return "deny";
      },
    });
    assert.equal(toolCalls, 2, "explicit bypass may resolve ordinary ask");
    assert.equal(promptCalls, 0, "headless bypass must not invoke prompt callback");
    const bypassResolved = bypassTrace.find((event) => event.eventType === "permission.resolved");
    assert.deepEqual(
      bypassResolved?.payload,
      {
        toolName: probe.name,
        toolUseId: "contract-1",
        decision: "allow",
        source: "headless",
        entryPoint: "headless",
        policyDecision: "ask",
        decisionSource: "default_policy",
        reasonCode: "confirmation_required",
        outcome: "allowed",
        resolutionSource: "bypass",
        prompted: false,
        executionAuthorized: true,
      },
    );
    const serializedBypassTrace = JSON.stringify(bypassTrace);
    assert.equal(serializedBypassTrace.includes("synthetic hook allow"), false);
    assert.equal(serializedBypassTrace.includes('"command":"safe"'), false);

    await runTools(block, { cwd: process.cwd() }, {
      entryPoint: "interactive",
      bypassPermissions: true,
      onPermissionRequest: async () => {
        promptCalls += 1;
        return "deny";
      },
    });
    assert.equal(toolCalls, 2, "bypass flag must not authorize an interactive entry");
    assert.equal(promptCalls, 1, "interactive entry must still resolve ask through its callback");

    const denied = await runTools(block, { cwd: process.cwd() }, {
      entryPoint: "background_subagent",
      shouldAvoidPermissionPrompts: true,
      onPermissionRequest: async () => {
        promptCalls += 1;
        return "allow_once";
      },
    });
    assert.equal(toolCalls, 2, "background ask must fail closed without bypass");
    assert.equal(promptCalls, 1, "background ask must not invoke parent prompt");
    assert.match(toolResultText(denied.executions[0]!.result.content), /cannot prompt/i);
  } finally {
    clearMcpTools();
  }
}

async function testQueryScopedExecutionLedger(): Promise<void> {
  let toolCalls = 0;
  let throwNext = false;
  const probe: Tool = {
    name: "LedgerProbe",
    description: "Synthetic ledger probe",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: { command: { type: "string" } },
    },
    async call() {
      toolCalls += 1;
      if (throwNext) {
        throwNext = false;
        throw new Error("synthetic failure");
      }
      return { content: "executed" };
    },
    isReadOnly: () => true,
    isEnabled: () => true,
    isConcurrencySafe: () => true,
  };
  const block = [{ type: "tool_use" as const, id: "same-id", name: probe.name, input: { command: "safe" } }];
  const sharedOptions = { executionLedger: new Set<string>() };

  registerMcpTools([probe]);
  try {
    await runTools(block, { cwd: process.cwd() }, sharedOptions);
    await runTools(block, { cwd: process.cwd() }, sharedOptions);
    assert.equal(toolCalls, 1, "the same tool_use id must execute at most once per query");

    const concurrentLedger = new Set<string>();
    const concurrentBlock = { ...block[0]!, id: "concurrent-id" };
    await runTools([concurrentBlock, concurrentBlock], { cwd: process.cwd() }, { executionLedger: concurrentLedger });
    assert.equal(toolCalls, 2, "concurrent duplicate ids must execute only once");

    const throwingLedger = new Set<string>();
    const throwingBlock = [{ ...block[0]!, id: "throw-id" }];
    throwNext = true;
    await runTools(throwingBlock, { cwd: process.cwd() }, { executionLedger: throwingLedger });
    await runTools(throwingBlock, { cwd: process.cwd() }, { executionLedger: throwingLedger });
    assert.equal(toolCalls, 3, "a thrown execution must remain reserved");

    const deniedLedger = new Set<string>();
    const deniedBlock = [{ ...block[0]!, id: "denied-id" }];
    await runTools(deniedBlock, { cwd: process.cwd() }, {
      executionLedger: deniedLedger,
      permissionSettings: settings("default", [probe.name]),
    });
    await runTools(deniedBlock, { cwd: process.cwd() }, { executionLedger: deniedLedger });
    assert.equal(toolCalls, 4, "a denied id must remain available for later authorization");

    const invalidLedger = new Set<string>();
    const invalidBlock = [{ ...block[0]!, id: "invalid-ledger-id", input: { command: 42 } }];
    await runTools(invalidBlock, { cwd: process.cwd() }, { executionLedger: invalidLedger });
    await runTools(
      [{ ...block[0]!, id: "invalid-ledger-id" }],
      { cwd: process.cwd() },
      { executionLedger: invalidLedger },
    );
    assert.equal(toolCalls, 5, "an invalid id must remain available for corrected input");
  } finally {
    clearMcpTools();
  }
}

async function main(): Promise<void> {
  await testExplicitDenyPrecedence();
  await testInvalidInputStopsBeforePermissionAndExecution();
  await testDenyAndAskResolutionContract();
  await testQueryScopedExecutionLedger();
  process.stdout.write("tool/permission contract tests passed\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
