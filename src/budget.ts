import type { ReviewConfig, UsageEstimate } from "./types.js";

const defaultInputUsdPer1k = 0.002;
const defaultOutputUsdPer1k = 0.006;

export function estimateUsage(input: string, expectedOutputChars = 2400): UsageEstimate {
  const inputTokens = Math.ceil(input.length / 4);
  const outputTokens = Math.ceil(expectedOutputChars / 4);
  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd:
      (inputTokens / 1000) * defaultInputUsdPer1k +
      (outputTokens / 1000) * defaultOutputUsdPer1k
  };
}

export function isBudgetExceeded(usage: UsageEstimate, config: ReviewConfig): boolean {
  return usage.estimatedCostUsd > config.budgetUsd;
}
