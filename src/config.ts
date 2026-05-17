import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { ReviewConfig, Severity } from "./types.js";

const severities: Severity[] = ["info", "low", "medium", "high", "critical"];

const rawConfigSchema = z.object({
  focus_areas: z.array(z.string()).default([]),
  tone: z.enum(["terse", "balanced", "teaching"]).default("balanced"),
  severity_threshold: z.enum(severities as [Severity, ...Severity[]]).default("medium"),
  ignore_paths: z.array(z.string()).default([]),
  budget_usd: z.number().positive().default(3),
  per_file_comment_cap: z.number().int().positive().default(5)
});

export const defaultConfig: ReviewConfig = {
  focusAreas: [],
  tone: "balanced",
  severityThreshold: "medium",
  ignorePaths: [],
  budgetUsd: 3,
  perFileCommentCap: 5
};

export function loadReviewConfig(cwd: string, explicitPath?: string): ReviewConfig {
  const path = explicitPath ? resolve(cwd, explicitPath) : resolve(cwd, ".codex-review.yaml");
  if (!existsSync(path)) {
    return defaultConfig;
  }

  const parsed = rawConfigSchema.parse(YAML.parse(readFileSync(path, "utf8")) ?? {});
  return {
    focusAreas: parsed.focus_areas,
    tone: parsed.tone,
    severityThreshold: parsed.severity_threshold,
    ignorePaths: parsed.ignore_paths,
    budgetUsd: parsed.budget_usd,
    perFileCommentCap: parsed.per_file_comment_cap
  };
}

export function overrideConfig(
  config: ReviewConfig,
  overrides: { budgetUsd?: number }
): ReviewConfig {
  return {
    ...config,
    budgetUsd: overrides.budgetUsd ?? config.budgetUsd
  };
}

export function severityRank(severity: Severity): number {
  return severities.indexOf(severity);
}
