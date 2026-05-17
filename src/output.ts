import type { ReviewResult } from "./types.js";

export function renderMarkdown(result: ReviewResult): string {
  const lines = [
    "# Codex PR Review",
    "",
    `Recommendation: ${result.approvalRecommendation}`,
    `Confidence: ${result.confidence.toFixed(2)}`,
    "",
    "## Summary",
    "",
    result.summary,
    "",
    "## Findings",
    ""
  ];

  if (result.findings.length === 0) {
    lines.push("- No inline findings.");
  } else {
    for (const finding of result.findings) {
      lines.push(
        `- ${finding.severity.toUpperCase()} ${finding.file}:${finding.startLine} ${finding.ruleId ?? finding.category}`,
        `  ${finding.message}`
      );
      if (finding.suggestion) {
        lines.push(`  Suggestion: ${finding.suggestion.newText}`);
      }
    }
  }

  lines.push(
    "",
    "## Top Risks",
    "",
    ...riskLines(result.topRisks),
    "",
    "## Cost",
    "",
    `- Estimated tokens: ${result.usage.inputTokens + result.usage.outputTokens}`,
    `- Estimated cost: $${result.usage.estimatedCostUsd.toFixed(4)}`
  );

  return lines.join("\n");
}

export function renderJson(result: ReviewResult): string {
  return JSON.stringify(result, null, 2);
}

function riskLines(risks: string[]): string[] {
  if (risks.length === 0) {
    return ["- No material risks identified."];
  }
  return risks.slice(0, 3).map((risk) => `- ${risk}`);
}
