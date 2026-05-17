import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadReviewConfig } from "../src/config.js";

describe("loadReviewConfig", () => {
  it("loads repo YAML using PRD field names", () => {
    const dir = mkdtempSync(join(tmpdir(), "codex-review-"));
    writeFileSync(
      join(dir, ".codex-review.yaml"),
      [
        "focus_areas: [crypto, auth]",
        "tone: terse",
        "severity_threshold: high",
        "ignore_paths: ['docs/**']",
        "budget_usd: 1.25",
        "per_file_comment_cap: 2"
      ].join("\n")
    );

    expect(loadReviewConfig(dir)).toEqual({
      focusAreas: ["crypto", "auth"],
      tone: "terse",
      severityThreshold: "high",
      ignorePaths: ["docs/**"],
      budgetUsd: 1.25,
      perFileCommentCap: 2
    });
  });
});
