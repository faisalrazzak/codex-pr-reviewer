import { describe, expect, it, vi } from "vitest";
import { publishGithubReview } from "../src/github-publisher.js";
import type { ReviewResult } from "../src/types.js";

const result: ReviewResult = {
  findings: [
    {
      file: "src/auth.ts",
      startLine: 8,
      severity: "high",
      category: "auth",
      ruleId: "auth/hardcoded-secret",
      message: "Do not hard-code credentials.",
      suggestion: { newText: "const password = process.env.ADMIN_PASSWORD;" }
    }
  ],
  summary: "One issue found.",
  approvalRecommendation: "REQUEST_CHANGES",
  confidence: 0.8,
  topRisks: ["Credential exposure"],
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.01
  },
  budgetExceeded: false
};

describe("publishGithubReview", () => {
  it("posts inline review comments and a summary issue comment in review mode", async () => {
    const createReview = vi.fn().mockResolvedValue({ data: { id: 101 } });
    const createComment = vi.fn().mockResolvedValue({ data: { id: 202 } });

    const published = await publishGithubReview({
      ref: { owner: "faisalrazzak", repo: "codex-pr-reviewer", pullNumber: 7 },
      result,
      octokit: {
        pulls: { createReview },
        issues: { createComment }
      } as never
    });

    expect(published).toEqual({ reviewId: 101, summaryCommentId: 202 });
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "faisalrazzak",
        repo: "codex-pr-reviewer",
        pull_number: 7,
        event: "COMMENT",
        comments: [
          expect.objectContaining({
            path: "src/auth.ts",
            line: 8,
            side: "RIGHT"
          })
        ]
      })
    );
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 7,
        body: expect.stringContaining("# Codex PR Review")
      })
    );
  });

  it("requests changes only in gate mode", async () => {
    const createReview = vi.fn().mockResolvedValue({ data: { id: 101 } });
    const createComment = vi.fn().mockResolvedValue({ data: { id: 202 } });

    await publishGithubReview({
      ref: { owner: "faisalrazzak", repo: "codex-pr-reviewer", pullNumber: 7 },
      result,
      mode: "gate",
      octokit: {
        pulls: { createReview },
        issues: { createComment }
      } as never
    });

    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({ event: "REQUEST_CHANGES" }));
  });
});
