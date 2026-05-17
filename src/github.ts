import { Octokit } from "@octokit/rest";
import type { PullRequestRef } from "./types.js";

export function parseRepo(value: string): Pick<PullRequestRef, "owner" | "repo"> {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error(`Expected --repo in owner/repo form, got "${value}".`);
  }
  return { owner, repo };
}

export async function fetchPullRequestDiff(ref: PullRequestRef, token = process.env.GITHUB_TOKEN): Promise<string> {
  if (!token) {
    throw new Error("GITHUB_TOKEN is required when fetching a live pull request diff.");
  }

  const octokit = new Octokit({ auth: token });
  const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
    headers: {
      accept: "application/vnd.github.v3.diff"
    }
  });

  return String(response.data);
}
