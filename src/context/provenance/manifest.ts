import {
  CONTEXT_MANIFEST_SCHEMA_VERSION,
  type ContextManifest,
  type ContextSourceEvidence,
  type ContextSourceInput,
} from "./types.js";

const SAFE_LABEL = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

function safeLabel(value: string, fallback: string): string {
  const normalized = value.trim();
  return SAFE_LABEL.test(normalized) ? normalized : fallback;
}

function estimateTokens(content: string): number {
  return content.length === 0 ? 0 : Math.max(1, Math.ceil(content.length / 4));
}

export function buildContextManifest(
  inputs: readonly ContextSourceInput[],
  budget: { contextWindow: number; effectiveContextWindow: number },
): ContextManifest {
  const sources: ContextSourceEvidence[] = inputs.map((input, index) => {
    const loaded = input.loaded && input.content.length > 0;
    return {
      sourceId: safeLabel(input.sourceId, `source-${index + 1}`),
      category: input.category,
      eligibility: safeLabel(input.eligibility, "unspecified"),
      loaded,
      characterCount: loaded ? input.content.length : 0,
      estimatedTokens: loaded ? estimateTokens(input.content) : 0,
      ...(!loaded && input.omittedReason
        ? { omittedReason: safeLabel(input.omittedReason, "omitted") }
        : {}),
    };
  });

  const loaded = sources.filter((source) => source.loaded);
  return {
    schemaVersion: CONTEXT_MANIFEST_SCHEMA_VERSION,
    sources,
    loadedSourceCount: loaded.length,
    omittedSourceCount: sources.length - loaded.length,
    loadedCharacterCount: loaded.reduce((sum, source) => sum + source.characterCount, 0),
    loadedEstimatedTokens: loaded.reduce((sum, source) => sum + source.estimatedTokens, 0),
    contextWindow: Math.max(0, Math.floor(budget.contextWindow)),
    effectiveContextWindow: Math.max(0, Math.floor(budget.effectiveContextWindow)),
  };
}

export function createContextAssembledPayload(
  manifest: ContextManifest,
): Record<string, unknown> {
  const categories = new Map<string, { loadedSourceCount: number; estimatedTokens: number }>();
  for (const source of manifest.sources) {
    const current = categories.get(source.category) ?? {
      loadedSourceCount: 0,
      estimatedTokens: 0,
    };
    if (source.loaded) {
      current.loadedSourceCount += 1;
      current.estimatedTokens += source.estimatedTokens;
    }
    categories.set(source.category, current);
  }

  return {
    manifestSchemaVersion: manifest.schemaVersion,
    loadedSourceCount: manifest.loadedSourceCount,
    omittedSourceCount: manifest.omittedSourceCount,
    loadedEstimatedTokens: manifest.loadedEstimatedTokens,
    contextWindow: manifest.contextWindow,
    effectiveContextWindow: manifest.effectiveContextWindow,
    categories: [...categories.entries()].map(([category, summary]) => ({
      category,
      ...summary,
    })),
    contentOmitted: true,
  };
}
