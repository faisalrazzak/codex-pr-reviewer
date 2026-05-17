import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("keeps dry-run deterministic by default", () => {
    expect(parseArgs(["dry-run"]).client).toBe("stub");
  });

  it("uses auto client selection for live reviews", () => {
    expect(parseArgs(["review", "--repo", "owner/repo", "--pull", "1"]).client).toBe("auto");
  });

  it("accepts the package-manager -- delimiter", () => {
    const args = parseArgs(["--", "review", "--repo", "owner/repo", "--pull", "1"]);

    expect(args.command).toBe("review");
    expect(args.client).toBe("auto");
  });

  it("parses gate mode", () => {
    expect(parseArgs(["review", "--repo", "owner/repo", "--pull", "1", "--mode", "gate"]).mode).toBe("gate");
  });

  it("supports disabling GitHub posting for live review debugging", () => {
    expect(parseArgs(["review", "--repo", "owner/repo", "--pull", "1", "--no-post"]).noPost).toBe(true);
  });
});
