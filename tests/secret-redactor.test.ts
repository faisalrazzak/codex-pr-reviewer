import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/secret-redactor.js";

describe("redactSecrets", () => {
  it("redacts common token and password patterns", () => {
    const result = redactSecrets('const password = "correct-horse-battery"; const token = "ghp_abcdefghijklmnopqrstuvwxyz";');

    expect(result.text).toContain("[REDACTED:credential-assignment]");
    expect(result.text).not.toContain("correct-horse-battery");
    expect(result.redactions.length).toBeGreaterThan(0);
  });
});
