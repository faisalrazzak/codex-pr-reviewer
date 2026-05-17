# codex-pr-reviewer

Codex PR Reviewer is a TypeScript CLI and GitHub Action scaffold for high-signal pull request review. The current M2 slice fetches pull request diffs, builds a small project context pack, redacts secrets, calls Codex/OpenAI with structured JSON output, and publishes inline GitHub review comments plus a summary comment.

The later milestones add deeper cost enforcement, richer calibration, and a full eval bench.

## What works today

- `dry-run` from a fixture diff or a live GitHub PR diff.
- `.codex-review.yaml` configuration for focus areas, tone, ignored paths, severity threshold, budget, and per-file caps.
- Project context pack from README, CODEOWNERS, ADR files, and changed files marked with `codex-review: load-me`.
- Secret redaction before prompt construction.
- Budget estimation with fail-soft `BUDGET_EXCEEDED` output.
- OpenAI Responses API structured outputs with Codex CLI fallback support.
- GitHub Reviews API inline comments plus a top-level summary comment.
- Stub reviewer for deterministic local dry-runs.
- Vitest coverage for config parsing, response validation, GitHub publishing, secret redaction, and review orchestration.

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm dry-run
```

Expected dry-run shape:

```text
# Codex PR Review

Recommendation: APPROVE
Confidence: 0.64

## Findings

- No inline findings.

## Cost

- Estimated tokens: 1744
- Estimated cost: $0.0059
```

## Review a live PR locally

```bash
GITHUB_TOKEN=ghp_... OPENAI_API_KEY=sk_... pnpm dev -- review --repo owner/repo --pull 123
```

This posts inline review comments through the GitHub Reviews API and creates a summary issue comment. For debugging without publishing, add `--no-post`. For deterministic local output, use `--client stub`.

Client selection:

- `--client auto`: use Codex CLI when available, otherwise OpenAI Responses API.
- `--client codex`: force `codex exec --json` with an output schema.
- `--client openai`: force direct OpenAI Responses API.
- `--client stub`: use deterministic local heuristics.

Mode selection:

- `--mode review`: comment-only review, with approval recommendation in the summary.
- `--mode gate`: request changes when the model recommendation is `REQUEST_CHANGES`.

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
          client: auto
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
