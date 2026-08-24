export const CONTEXT_MANIFEST_SCHEMA_VERSION = 1;

export const CONTEXT_SOURCE_CATEGORIES = [
  "static_instructions",
  "environment",
  "project_instructions",
  "memory_guidance",
  "memory_index",
  "session_instructions",
  "skills",
  "agents",
  "team",
  "output_style",
  "language",
] as const;

export type ContextSourceCategory = (typeof CONTEXT_SOURCE_CATEGORIES)[number];

export interface ContextSourceInput {
  sourceId: string;
  category: ContextSourceCategory;
  eligibility: string;
  content: string;
  loaded: boolean;
  omittedReason?: string;
}

export interface ContextSourceEvidence {
  sourceId: string;
  category: ContextSourceCategory;
  eligibility: string;
  loaded: boolean;
  characterCount: number;
  estimatedTokens: number;
  omittedReason?: string;
}

export interface ContextManifest {
  schemaVersion: typeof CONTEXT_MANIFEST_SCHEMA_VERSION;
  sources: ContextSourceEvidence[];
  loadedSourceCount: number;
  omittedSourceCount: number;
  loadedCharacterCount: number;
  loadedEstimatedTokens: number;
  contextWindow: number;
  effectiveContextWindow: number;
}
