import type { ReviewFinding, ReviewRequest, ReviewResult } from "./types.js";
import { parseUnifiedDiff } from "./diff.js";
import { estimateUsage } from "./budget.js";

export interface CodexClient {
  review(request: ReviewRequest): Promise<Omit<ReviewResult, "usage" | "budgetExceeded">>;
}

export class StubCodexClient implements CodexClient {
  async review(request: ReviewRequest): Promise<Omit<ReviewResult, "usage" | "budgetExceeded">> {
    const findings: ReviewFinding[] = [];

    for (const file of parseUnifiedDiff(request.diff)) {
      for (const [lineNumber, line] of file.addedLines) {
        const normalized = line.toLowerCase();
        if (/(password|secret|token)\s*=(?!=)/.test(normalized) || /password/.test(normalized) && /["']/.test(line)) {
          findings.push({
            file: file.path,
            startLine: lineNumber,
            severity: "high",
            category: "auth",
            ruleId: "auth/hardcoded-secret",
            message: "Hard-coded credential-like value detected in the diff.",
            suggestion: { newText: "Read this value from a secret manager or environment variable." }
          });
        }

        if (/createhash\(["']md5["']\)/i.test(line)) {
          findings.push({
            file: file.path,
            startLine: lineNumber,
            severity: "medium",
            category: "crypto",
            ruleId: "crypto/weak-hash",
            message: "MD5 is not collision resistant and is risky for security-sensitive digesting.",
            suggestion: { newText: "Use SHA-256 or a purpose-built password hashing function, depending on the data." }
          });
        }

        if (/\beval\s*\(/.test(line)) {
          findings.push({
            file: file.path,
            startLine: lineNumber,
            severity: "critical",
            category: "supply_chain",
            ruleId: "supply-chain/eval",
            message: "Dynamic evaluation can execute attacker-controlled code.",
            suggestion: { newText: "Replace eval with a constrained parser or explicit dispatch table." }
          });
        }
      }
    }

    const filtered = filterByFocusAreas(findings, request.config.focusAreas);
    const approvalRecommendation = filtered.some((finding) => ["high", "critical"].includes(finding.severity))
      ? "REQUEST_CHANGES"
      : filtered.length > 0
        ? "COMMENT"
        : "APPROVE";

    return {
      findings: filtered,
      summary: filtered.length
        ? `Stub reviewer found ${filtered.length} issue(s) matching the configured focus.`
        : "Stub reviewer found no issues matching the configured focus.",
      approvalRecommendation,
      confidence: filtered.length ? 0.76 : 0.64,
      topRisks: filtered.slice(0, 3).map((finding) => finding.message)
    };
  }
}

export function buildPromptInput(request: ReviewRequest): string {
  return JSON.stringify({
    model: request.model,
    config: request.config,
    context: request.context,
    diff: request.diff
  });
}

export function estimatePromptUsage(request: ReviewRequest) {
  return estimateUsage(buildPromptInput(request));
}

function filterByFocusAreas(findings: ReviewFinding[], focusAreas: string[]): ReviewFinding[] {
  if (focusAreas.length === 0) {
    return findings;
  }
  const normalized = new Set(focusAreas.map((area) => area.toLowerCase()));
  return findings.filter((finding) => normalized.has(finding.category.toLowerCase()));
}
