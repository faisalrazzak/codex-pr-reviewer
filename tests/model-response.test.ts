import { describe, expect, it } from "vitest";
import { parseReviewModelResponse } from "../src/model-response.js";

describe("parseReviewModelResponse", () => {
  it("normalizes model JSON into review findings", () => {
    const parsed = parseReviewModelResponse({
      findings: [
        {
          file: "src/auth.ts",
          startLine: 12,
          endLine: null,
          severity: "high",
          category: "auth",
          message: "Do not hard-code credentials.",
          suggestion: "const password = process.env.ADMIN_PASSWORD;",
          ruleId: "auth/hardcoded-secret"
        }
      ],
      summary: "One issue found.",
      approvalRecommendation: "REQUEST_CHANGES",
      confidence: 0.82,
      topRisks: ["Credential exposure"]
    });

    expect(parsed.findings).toEqual([
      expect.objectContaining({
        file: "src/auth.ts",
        startLine: 12,
        severity: "high",
        suggestion: { newText: "const password = process.env.ADMIN_PASSWORD;" }
      })
    ]);
  });

  it("rejects malformed model output", () => {
    expect(() => parseReviewModelResponse({ findings: "nope" })).toThrow();
  });
});
