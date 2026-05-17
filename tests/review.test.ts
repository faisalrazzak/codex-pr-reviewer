import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StubCodexClient } from "../src/codex-client.js";
import { defaultConfig } from "../src/config.js";
import { runReview } from "../src/review.js";

const fixture = readFileSync(resolve(process.cwd(), "fixtures/sample-pr.diff"), "utf8");
const riskyDiff = `diff --git a/src/auth.ts b/src/auth.ts
index 1b2c3d4..5e6f7a8 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,4 +1,6 @@
 export function login(password: string) {
+  const adminPassword = "super-secret-password";
+  return password === adminPassword;
 }
diff --git a/src/hash.ts b/src/hash.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/hash.ts
@@ -0,0 +1,5 @@
+import crypto from "node:crypto";
+export function weakDigest(value: string) {
+  return crypto.createHash("md5").update(value).digest("hex");
+}
`;

describe("runReview", () => {
  it("approves the sample fixture after applying dry-run recommendations", async () => {
    const result = await runReview({
      cwd: process.cwd(),
      diff: fixture,
      config: defaultConfig,
      model: "gpt-5.4",
      client: new StubCodexClient()
    });

    expect(result.budgetExceeded).toBe(false);
    expect(result.approvalRecommendation).toBe("APPROVE");
    expect(result.findings).toEqual([]);
  });

  it("uses focus areas to suppress unrelated findings", async () => {
    const result = await runReview({
      cwd: process.cwd(),
      diff: riskyDiff,
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
