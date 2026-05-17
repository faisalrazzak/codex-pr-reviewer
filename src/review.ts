import { minimatch } from "minimatch";
import type { CodexClient } from "./codex-client.js";
import { estimatePromptUsage } from "./codex-client.js";
import { findingKey, listChangedFiles } from "./diff.js";
import { isBudgetExceeded } from "./budget.js";
import { buildProjectContext } from "./context.js";
import { redactSecrets } from "./secret-redactor.js";
import type { ReviewConfig, ReviewFinding, ReviewResult } from "./types.js";
import { severityRank } from "./config.js";

export interface RunReviewOptions {
  cwd: string;
  diff: string;
  config: ReviewConfig;
  model: string;
  client: CodexClient;
}

export async function runReview(options: RunReviewOptions): Promise<ReviewResult> {
  const changedFiles = listChangedFiles(options.diff).filter(
    (path) => !options.config.ignorePaths.some((pattern) => minimatch(path, pattern))
  );
  const redacted = redactSecrets(options.diff);
  const context = buildProjectContext(options.cwd, changedFiles);
  const request = {
    diff: redacted.text,
    changedFiles,
    context,
    config: options.config,
    model: options.model
  };
  const usage = estimatePromptUsage(request);

  if (isBudgetExceeded(usage, options.config)) {
    return {
      findings: [],
      summary: "BUDGET_EXCEEDED: Estimated review cost is above the configured budget.",
      approvalRecommendation: "COMMENT",
      confidence: 0,
      topRisks: ["Review skipped before model invocation."],
      usage,
      budgetExceeded: true
    };
  }

  const reviewed = await options.client.review(request);
  const findings = capPerFile(
    thresholdFilter(dedupe(reviewed.findings), options.config.severityThreshold),
    options.config.perFileCommentCap
  );

  return {
    ...reviewed,
    findings,
    usage,
    budgetExceeded: false
  };
}

function thresholdFilter(findings: ReviewFinding[], threshold: ReviewConfig["severityThreshold"]): ReviewFinding[] {
  return findings.filter((finding) => severityRank(finding.severity) >= severityRank(threshold));
}

function capPerFile(findings: ReviewFinding[], cap: number): ReviewFinding[] {
  const counts = new Map<string, number>();
  return findings.filter((finding) => {
    const count = counts.get(finding.file) ?? 0;
    if (count >= cap) {
      return false;
    }
    counts.set(finding.file, count + 1);
    return true;
  });
}

function dedupe(findings: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = findingKey(finding);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
