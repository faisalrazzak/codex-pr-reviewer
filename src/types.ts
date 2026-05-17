export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ApprovalRecommendation = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface ReviewFinding {
  file: string;
  startLine: number;
  endLine?: number;
  severity: Severity;
  category: string;
  message: string;
  suggestion?: { newText: string };
  ruleId?: string;
}

export interface ReviewConfig {
  focusAreas: string[];
  tone: "terse" | "balanced" | "teaching";
  severityThreshold: Severity;
  ignorePaths: string[];
  budgetUsd: number;
  perFileCommentCap: number;
}

export interface ProjectContextPack {
  files: Array<{ path: string; content: string }>;
  summary: string;
}

export interface ReviewRequest {
  diff: string;
  changedFiles: string[];
  context: ProjectContextPack;
  config: ReviewConfig;
  model: string;
}

export interface UsageEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  approvalRecommendation: ApprovalRecommendation;
  confidence: number;
  topRisks: string[];
  usage: UsageEstimate;
  budgetExceeded: boolean;
}

export interface PullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}
