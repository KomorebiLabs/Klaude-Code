import { createHash } from "node:crypto";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

export type CompactionInvariantKind = "current_task" | "hard_constraint";

export interface CompactionInvariantItem {
  id: string;
  kind: CompactionInvariantKind;
  text: string;
}

export interface CompactionInvariantSnapshot {
  digest: string;
  items: CompactionInvariantItem[];
}

const CONSTRAINT_PATTERN = /\b(?:must|must not|do not|don't|never|required?|constraint)\b|必须|不得|不要|不能|约束|要求/i;
const MAX_ITEMS = 20;
const MAX_ITEM_CHARS = 240;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_CHARS);
}

function messageText(message: MessageParam): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((block): block is Extract<(typeof message.content)[number], { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function invariantId(kind: CompactionInvariantKind, text: string): string {
  return createHash("sha256").update(`${kind}:${text}`).digest("hex").slice(0, 12);
}

export function buildCompactionInvariantSnapshot(
  messages: readonly MessageParam[],
): CompactionInvariantSnapshot {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map(messageText)
    .map(normalizeText)
    .filter(Boolean);
  const candidates: Array<{ kind: CompactionInvariantKind; text: string }> = [];
  const currentTask = userTexts.at(-1);
  if (currentTask) candidates.push({ kind: "current_task", text: currentTask });

  for (const raw of userTexts) {
    for (const sentence of raw.split(/(?<=[.!?。！？])\s*|\n+/)) {
      const text = normalizeText(sentence);
      if (text && CONSTRAINT_PATTERN.test(text)) {
        candidates.push({ kind: "hard_constraint", text });
      }
    }
  }

  const unique = new Map<string, CompactionInvariantItem>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.text}`;
    if (!unique.has(key)) {
      unique.set(key, {
        id: invariantId(candidate.kind, candidate.text),
        kind: candidate.kind,
        text: candidate.text,
      });
    }
    if (unique.size >= MAX_ITEMS) break;
  }
  const items = [...unique.values()];
  const digest = createHash("sha256")
    .update(items.map((item) => item.id).join(":"))
    .digest("hex")
    .slice(0, 16);
  return { digest, items };
}

export function formatCompactionInvariantInstructions(
  snapshot: CompactionInvariantSnapshot,
): string {
  if (snapshot.items.length === 0) return "";
  return [
    "## Required invariant retention",
    "Preserve each item below in the summary and copy its marker exactly.",
    ...snapshot.items.map(
      (item) => `- [invariant:${item.id}] (${item.kind}) ${item.text}`,
    ),
  ].join("\n");
}

export function validateCompactionInvariantRetention(
  summary: string,
  snapshot: CompactionInvariantSnapshot,
): boolean {
  return snapshot.items.every((item) => summary.includes(`[invariant:${item.id}]`));
}
