import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StubCodexClient } from "../src/codex-client.js";
import { defaultConfig } from "../src/config.js";
import { runReview } from "../src/review.js";

const fixture = readFileSync(resolve(process.cwd(), "fixtures/sample-pr.diff"), "utf8");

describe("runReview", () => {
  it("produces dry-run findings for the sample fixture", async () => {
    const result = await runReview({
      cwd: process.cwd(),
      diff: fixture,
      config: defaultConfig,
      model: "gpt-5.4",
      client: new StubCodexClient()
    });

    expect(result.budgetExceeded).toBe(false);
    expect(result.approvalRecommendation).toBe("REQUEST_CHANGES");
    expect(result.findings.some((finding) => finding.ruleId === "crypto/weak-hash")).toBe(true);
  });

  it("uses focus areas to suppress unrelated findings", async () => {
    const result = await runReview({
      cwd: process.cwd(),
      diff: fixture,
      config: { ...defaultConfig, focusAreas: ["crypto"] },
      model: "gpt-5.4",
      client: new StubCodexClient()
    });

    expect(result.findings).toEqual([
      expect.objectContaining({ category: "crypto", ruleId: "crypto/weak-hash" })
    ]);
  });

  it("fails soft when the budget is exceeded", async () => {
    const result = await runReview({
      cwd: process.cwd(),
      diff: fixture,
      config: { ...defaultConfig, budgetUsd: 0.000001 },
      model: "gpt-5.4",
      client: new StubCodexClient()
    });

    expect(result.budgetExceeded).toBe(true);
    expect(result.summary).toContain("BUDGET_EXCEEDED");
    expect(result.findings).toEqual([]);
  });
});
