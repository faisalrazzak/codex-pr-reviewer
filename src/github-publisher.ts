import { Octokit } from "@octokit/rest";
import { renderMarkdown } from "./output.js";
import type { PullRequestRef, ReviewFinding, ReviewResult } from "./types.js";

type PullReviewEvent = "REQUEST_CHANGES" | "COMMENT";
export type PublishMode = "review" | "gate";

export interface PublishReviewOptions {
  ref: PullRequestRef;
  result: ReviewResult;
  mode?: PublishMode;
  token?: string;
  octokit?: Pick<Octokit, "pulls" | "issues">;
}

export interface PublishReviewResult {
  reviewId?: number;
  summaryCommentId?: number;
}

export async function publishGithubReview(options: PublishReviewOptions): Promise<PublishReviewResult> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  if (!token && !options.octokit) {
    throw new Error("GITHUB_TOKEN is required when publishing a GitHub review.");
  }

  const octokit = options.octokit ?? new Octokit({ auth: token });
  const body = renderMarkdown(options.result);
  const comments = options.result.budgetExceeded ? [] : options.result.findings.map(toReviewComment);
  const review = await octokit.pulls.createReview({
    owner: options.ref.owner,
    repo: options.ref.repo,
    pull_number: options.ref.pullNumber,
    event: reviewEvent(options.result, options.mode ?? "review"),
    body: reviewBody(options.result),
    comments
  });

  const summary = await octokit.issues.createComment({
    owner: options.ref.owner,
    repo: options.ref.repo,
    issue_number: options.ref.pullNumber,
    body
  });

  return {
    reviewId: "id" in review.data && typeof review.data.id === "number" ? review.data.id : undefined,
    summaryCommentId: "id" in summary.data && typeof summary.data.id === "number" ? summary.data.id : undefined
  };
}

function toReviewComment(finding: ReviewFinding) {
  const body = [
    `**${finding.severity.toUpperCase()}** ${finding.ruleId ?? finding.category}`,
    "",
    finding.message,
    finding.suggestion ? `\n\`\`\`suggestion\n${finding.suggestion.newText}\n\`\`\`` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    path: finding.file,
    line: finding.endLine ?? finding.startLine,
    side: "RIGHT" as const,
    ...(finding.endLine ? { start_line: finding.startLine, start_side: "RIGHT" as const } : {}),
    body
  };
}

function reviewEvent(result: ReviewResult, mode: PublishMode): PullReviewEvent {
  if (mode === "gate" && result.approvalRecommendation === "REQUEST_CHANGES") {
    return "REQUEST_CHANGES";
  }
  return "COMMENT";
}

function reviewBody(result: ReviewResult): string {
  if (result.budgetExceeded) {
    return result.summary;
  }
  return `${result.summary}\n\nRecommendation: ${result.approvalRecommendation}. Confidence: ${result.confidence.toFixed(2)}.`;
}
