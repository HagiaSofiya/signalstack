export type ModelPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

// Prices are deliberately explicit and exact-match by model. Unknown aliases return null
// instead of producing a misleading estimate. Update this table when provider pricing changes.
export const modelPricing: Record<string, Record<string, ModelPricing>> = {
  openai: {
    "gpt-4o": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 },
    "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  },
};

export function calculateEstimatedCost(input: {
  provider: string;
  model: string | null | undefined;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
}): number | null {
  if (!input.model || input.inputTokens === null || input.inputTokens === undefined || input.outputTokens === null || input.outputTokens === undefined) return null;
  const pricing = modelPricing[input.provider]?.[input.model];
  if (!pricing || !Number.isFinite(input.inputTokens) || !Number.isFinite(input.outputTokens) || input.inputTokens < 0 || input.outputTokens < 0) return null;
  const cost = (input.inputTokens * pricing.inputPerMillionUsd + input.outputTokens * pricing.outputPerMillionUsd) / 1_000_000;
  return Number(cost.toFixed(6));
}
