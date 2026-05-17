# codex-pr-reviewer

Codex PR Reviewer is a TypeScript CLI and GitHub Action scaffold for high-signal pull request review. This first milestone implements the M1 slice from the PRD: fetch a pull request diff, build a small project context pack, redact secrets, run a deterministic stub reviewer, and print a dry-run review to stdout.

The later milestones plug the same pipeline into a real Codex client, GitHub inline review comments, budget enforcement status checks, and an eval bench.

## What works today

- `dry-run` from a fixture diff or a live GitHub PR diff.
- `.codex-review.yaml` configuration for focus areas, tone, ignored paths, severity threshold, budget, and per-file caps.
- Project context pack from README, CODEOWNERS, ADR files, and changed files marked with `codex-review: load-me`.
- Secret redaction before prompt construction.
- Budget estimation with fail-soft `BUDGET_EXCEEDED` output.
- Stub Codex client that emits deterministic findings for risky patterns.
- Vitest coverage for config parsing, secret redaction, and review orchestration.

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm dry-run
```

Expected dry-run shape:

```text
# Codex PR Review

Recommendation: REQUEST_CHANGES
Confidence: 0.76

## Findings

- HIGH src/auth.ts:8 auth/hardcoded-secret
  Hard-coded credential-like value detected in the diff.

## Cost

- Estimated tokens: 1576
- Estimated cost: $0.0056
```

## Review a live PR

```bash
GITHUB_TOKEN=ghp_... pnpm dev -- review --repo owner/repo --pull 123
```

For now this prints the review instead of posting comments. GitHub Reviews API posting is the M2 milestone.

## Install on your repo

1. Copy `.codex-review.example.yaml` to `.codex-review.yaml` and tune it.
2. Add this action to your workflow after checkout.

```yaml
name: Codex review

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: faisalrazzak/codex-pr-reviewer@v0.1.0
        with:
          mode: review
          model: gpt-5.4
          budget_usd: "3.00"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Configuration

```yaml
focus_areas: [crypto, identity, supply_chain]
tone: terse
severity_threshold: medium
ignore_paths: ["docs/**", "**/*.md"]
budget_usd: 3.00
per_file_comment_cap: 5
```

`focus_areas` gates findings by category. For example, `focus_areas: [crypto]` suppresses non-crypto findings.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

The implementation intentionally keeps the LLM boundary behind `CodexClient`, so the M2 Codex CLI/API work can replace the stub without changing ingestion, redaction, rendering, or tests.
