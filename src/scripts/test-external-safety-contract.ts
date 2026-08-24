#!/usr/bin/env tsx
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getEasyAgentHome } from "../utils/paths.js";
import {
  resolveWorkspacePath,
  setAdditionalAllowedRoots,
} from "../tools/pathUtils.js";
import {
  BoundedTextBuffer,
  DEFAULT_PROCESS_TIMEOUT_MS,
  MAX_PROCESS_TIMEOUT_MS,
  MIN_PROCESS_TIMEOUT_MS,
  normalizeToolTimeout,
  runManagedProcess,
} from "../tools/processLifecycle.js";
import {
  MAX_MCP_CONTENT_CHARS,
  MCP_REQUEST_TIMEOUT_MS,
  createMcpRequestOptions,
  serializeBoundedMcpJsonArray,
  stringifyMcpContentBounded,
} from "../services/mcp/safety.js";
import { buildToolAdapter } from "../services/mcp/fetchTools.js";
import type { ConnectedMcpServer } from "../types/mcp.js";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import { runTools } from "../core/agenticLoop.js";
import { clearMcpTools, registerMcpTools } from "../tools/index.js";
import {
  createSafeDiagnosticMessage,
  createSafeUrlSummary,
} from "../observability/redaction.js";
import { logWarn } from "../utils/log.js";

async function testCanonicalPathContainment(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "easy-agent-r1h-path-"));
  const workspace = path.join(root, "workspace");
  const outside = path.join(root, "outside");
  const additional = path.join(root, "additional");
  await Promise.all([
    fs.mkdir(workspace),
    fs.mkdir(outside),
    fs.mkdir(additional),
  ]);
  await fs.writeFile(path.join(outside, "secret.txt"), "synthetic secret");
  await fs.symlink(outside, path.join(workspace, "link-out"), "junction");

  setAdditionalAllowedRoots([additional]);
  try {
    assert.throws(
      () => resolveWorkspacePath(path.join("..", "outside", "secret.txt"), workspace),
      /outside the allowed roots/i,
    );
    assert.throws(
      () => resolveWorkspacePath(path.join("link-out", "secret.txt"), workspace),
      /outside the allowed roots|symlink escape/i,
    );
    assert.equal(
      resolveWorkspacePath(path.join("nested", "new.txt"), workspace),
      path.join(workspace, "nested", "new.txt"),
    );
    assert.equal(
      resolveWorkspacePath(path.join(additional, "artifact.txt"), workspace),
      path.join(additional, "artifact.txt"),
    );
    assert.equal(
      resolveWorkspacePath(path.join(getEasyAgentHome(), "state.json"), workspace),
      path.join(getEasyAgentHome(), "state.json"),
    );
  } finally {
    setAdditionalAllowedRoots([]);
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testBoundedProcessLifecycle(): Promise<void> {
  assert.equal(normalizeToolTimeout(undefined), DEFAULT_PROCESS_TIMEOUT_MS);
  assert.equal(normalizeToolTimeout(-1), MIN_PROCESS_TIMEOUT_MS);
  assert.equal(normalizeToolTimeout(Number.POSITIVE_INFINITY), DEFAULT_PROCESS_TIMEOUT_MS);
  assert.equal(normalizeToolTimeout(MAX_PROCESS_TIMEOUT_MS + 1), MAX_PROCESS_TIMEOUT_MS);

  const buffer = new BoundedTextBuffer(8);
  buffer.append("abcdef");
  buffer.append("ghijkl");
  assert.equal(buffer.toString(), "abcdefgh\n...[truncated 4 chars]");

  const bounded = await runManagedProcess({
    executable: process.execPath,
    args: ["-e", 'process.stdout.write("x".repeat(50000))'],
    cwd: process.cwd(),
    timeoutMs: 5_000,
    outputLimitChars: 1_024,
  });
  assert.equal(bounded.status, "completed");
  assert.equal(bounded.exitCode, 0);
  assert.match(bounded.stdout, /\[truncated 48976 chars\]/);
  assert.ok(bounded.stdout.length < 1_100);

  const startedAt = Date.now();
  const timedOut = await runManagedProcess({
    executable: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
    timeoutMs: MIN_PROCESS_TIMEOUT_MS,
    terminationGraceMs: 500,
  });
  assert.equal(timedOut.status, "timeout");
  assert.ok(["confirmed", "degraded"].includes(timedOut.termination));
  assert.ok(Date.now() - startedAt < 3_000);
}

function testMcpSafetyContract(): void {
  const controller = new AbortController();
  assert.deepEqual(createMcpRequestOptions(controller.signal), {
    signal: controller.signal,
    timeout: MCP_REQUEST_TIMEOUT_MS,
    maxTotalTimeout: MCP_REQUEST_TIMEOUT_MS,
  });

  const content = stringifyMcpContentBounded([
    { type: "text", text: "x".repeat(MAX_MCP_CONTENT_CHARS + 500) },
  ]);
  assert.match(content, /\[truncated 500 chars\]/);
  assert.ok(content.length < MAX_MCP_CONTENT_CHARS + 100);
  assert.deepEqual(
    JSON.parse(serializeBoundedMcpJsonArray([{ uri: "safe://one" }])),
    [{ uri: "safe://one" }],
  );
  assert.deepEqual(
    JSON.parse(serializeBoundedMcpJsonArray([{ text: "safe" }], "contents")),
    { contents: [{ text: "safe" }] },
  );
}

async function testMcpPermissionAndRequestBoundary(): Promise<void> {
  let requestCalls = 0;
  let observedOptions: Record<string, unknown> | undefined;
  const connection = {
    name: "synthetic-server",
    type: "connected",
    capabilities: { tools: {} },
    client: {
      async request(
        _request: unknown,
        _schema: unknown,
        options?: Record<string, unknown>,
      ) {
        requestCalls += 1;
        observedOptions = options;
        if ((options?.signal as AbortSignal | undefined)?.aborted) {
          throw new Error("request aborted");
        }
        return { content: [{ type: "text", text: "authorized" }] };
      },
    },
  } as unknown as ConnectedMcpServer;
  const adapter = buildToolAdapter(connection, {
    name: "dangerous-operation",
    inputSchema: { type: "object", properties: {} },
  } as McpTool);
  const block = [{
    type: "tool_use" as const,
    id: "mcp-safety-1",
    name: adapter.name,
    input: { token: "sk-r1h-trace-fake-secret" },
  }];

  registerMcpTools([adapter]);
  try {
    await runTools(block, { cwd: process.cwd() }, {
      permissionSettings: { mode: "default", allow: [], deny: [adapter.name] },
    });
    assert.equal(requestCalls, 0, "explicit MCP deny must not reach the transport");

    const traceEvents: Array<{
      eventType: string;
      payload: Record<string, unknown>;
    }> = [];
    await runTools(block, { cwd: process.cwd() }, {
      onPermissionRequest: async () => "allow_once",
      traceSink: {
        emit(eventType, payload) {
          traceEvents.push({ eventType, payload });
        },
        async close() {},
        getStatus() {
          return { state: "active" as const, droppedEvents: 0 };
        },
      },
    });
    assert.equal(requestCalls, 1);
    assert.equal(observedOptions?.timeout, MCP_REQUEST_TIMEOUT_MS);
    assert.equal(observedOptions?.maxTotalTimeout, MCP_REQUEST_TIMEOUT_MS);
    const started = traceEvents.find((event) => event.eventType === "tool.started");
    const completed = traceEvents.find((event) => event.eventType === "tool.completed");
    assert.deepEqual(started?.payload.external, {
      kind: "mcp",
      sourceName: "synthetic-server",
      operationName: "dangerous-operation",
    });
    assert.deepEqual(completed?.payload.external, {
      kind: "mcp",
      sourceName: "synthetic-server",
      operationName: "dangerous-operation",
      termination: "completed",
    });
    assert.equal(JSON.stringify(traceEvents).includes("sk-r1h-trace-fake-secret"), false);

    const controller = new AbortController();
    controller.abort();
    const aborted = await adapter.call({}, {
      cwd: process.cwd(),
      abortSignal: controller.signal,
    });
    assert.equal(aborted.isError, true);
  } finally {
    clearMcpTools();
  }
}

function testDiagnosticSecretSafety(): void {
  const fakeSecret = "r1h-fake-secret-123";
  const unsafeUrl = `https://user:${fakeSecret}@example.test/mcp?token=${fakeSecret}`;
  const captured: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => captured.push(args.map(String).join(" "));
  try {
    logWarn(`remote failed: Authorization: Bearer ${fakeSecret}`);
  } finally {
    console.error = originalConsoleError;
  }

  const diagnostic = createSafeDiagnosticMessage(
    `url=${unsafeUrl} password=${fakeSecret} -----BEGIN TEST PRIVATE KEY-----${fakeSecret}-----END TEST PRIVATE KEY-----`,
  );
  const serialized = JSON.stringify({
    captured,
    diagnostic,
    url: createSafeUrlSummary(unsafeUrl),
  });
  assert.equal(serialized.includes(fakeSecret), false);
  assert.equal(createSafeUrlSummary(unsafeUrl), "https://example.test");
}

async function testProcessTraceBoundary(): Promise<void> {
  const toolName = process.platform === "win32" ? "PowerShell" : "Bash";
  const command = process.platform === "win32"
    ? "Write-Output r1h-process-marker"
    : "printf r1h-process-marker";
  const traceEvents: Array<{
    eventType: string;
    payload: Record<string, unknown>;
  }> = [];

  await runTools(
    [{ type: "tool_use", id: "process-safety-1", name: toolName, input: { command } }],
    { cwd: process.cwd() },
    {
      onPermissionRequest: async () => "allow_once",
      traceSink: {
        emit(eventType, payload) {
          traceEvents.push({ eventType, payload });
        },
        async close() {},
        getStatus() {
          return { state: "active" as const, droppedEvents: 0 };
        },
      },
    },
  );

  const completed = traceEvents.find((event) => event.eventType === "tool.completed");
  assert.deepEqual(
    completed?.payload.external && {
      kind: (completed.payload.external as Record<string, unknown>).kind,
      sourceName: (completed.payload.external as Record<string, unknown>).sourceName,
      termination: (completed.payload.external as Record<string, unknown>).termination,
    },
    { kind: "process", sourceName: "local", termination: "completed" },
  );
  assert.equal(JSON.stringify(traceEvents).includes("r1h-process-marker"), false);
}

async function main(): Promise<void> {
  await testCanonicalPathContainment();
  await testBoundedProcessLifecycle();
  testMcpSafetyContract();
  await testMcpPermissionAndRequestBoundary();
  testDiagnosticSecretSafety();
  await testProcessTraceBoundary();
  process.stdout.write("external safety contract tests passed\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
