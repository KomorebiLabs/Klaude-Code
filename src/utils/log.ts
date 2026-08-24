import { isUiActive, pushUiNotice } from "../state/uiNoticeStore.js";
import {
  createSafeDiagnosticMessage,
  redactForTrace,
} from "../observability/redaction.js";

export function debugLog(scope: string, message: string, details?: Record<string, unknown>): void {
  if (!process.env.EASY_AGENT_DEBUG) return;
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(redactForTrace(details))}` : "";
  console.error(
    `[easy-agent][${timestamp}][${scope}] ${createSafeDiagnosticMessage(message)}${suffix}`,
  );
}

/**
 * Always-on warning for non-fatal issues (a malformed MCP server config, a
 * server that won't connect). We want the user to see it even without
 * EASY_AGENT_DEBUG=1, but it must NOT corrupt Ink's stdout-rendered UI.
 *
 * While the REPL is live, route the message into the in-UI notice bus so it
 * shows as a quiet dim line below the conversation. Otherwise (headless dump,
 * piped output, pre-first-frame) fall back to stderr.
 */
export function logWarn(message: string): void {
  const safeMessage = createSafeDiagnosticMessage(message);
  if (isUiActive()) {
    pushUiNotice("warn", safeMessage);
    return;
  }
  console.error(`[easy-agent][warn] ${safeMessage}`);
}
