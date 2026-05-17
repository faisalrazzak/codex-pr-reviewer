import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadReviewConfig, overrideConfig } from "./config.js";
import { fetchPullRequestDiff, parseRepo } from "./github.js";
import { publishGithubReview } from "./github-publisher.js";
import { renderJson, renderMarkdown } from "./output.js";
import { runReview } from "./review.js";
import { createReviewClient, type ReviewClientKind } from "./review-clients.js";

type Command = "dry-run" | "review";

interface CliOptions {
  command: Command;
  mode: "review" | "gate";
  configPath?: string;
  fixture?: string;
  repo?: string;
  pull?: number;
  model: string;
  budgetUsd?: number;
  format: "markdown" | "json";
  client: ReviewClientKind;
  noPost: boolean;
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  const options = parseArgs(argv);
  const config = overrideConfig(loadReviewConfig(cwd, options.configPath), { budgetUsd: options.budgetUsd });
  const diff = await loadDiff(options, cwd);
  const result = await runReview({
    cwd,
    diff,
    config,
    model: options.model,
    client: createReviewClient(options.client)
  });

  if (options.command === "review" && !options.noPost) {
    if (!options.repo || !options.pull) {
      throw new Error("Publishing a review requires --repo owner/repo and --pull number.");
    }
    const published = await publishGithubReview({
      ref: { ...parseRepo(options.repo), pullNumber: options.pull },
      result,
      mode: options.mode
    });
    process.stderr.write(
      `Published GitHub review${published.reviewId ? ` #${published.reviewId}` : ""}` +
        `${published.summaryCommentId ? ` and summary comment #${published.summaryCommentId}` : ""}.\n`
    );
  }

  process.stdout.write(options.format === "json" ? `${renderJson(result)}\n` : `${renderMarkdown(result)}\n`);
}

export function parseArgs(argv: string[]): CliOptions {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const command = normalizeCommand(normalizedArgv[0]);
  const values = new Map<string, string | true>();

  for (let index = command ? 1 : 0; index < normalizedArgv.length; index += 1) {
    const arg = normalizedArgv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = normalizedArgv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, true);
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return {
    command: command ?? "dry-run",
    mode: parseMode(stringValue(values, "mode")),
    configPath: stringValue(values, "config"),
    fixture: stringValue(values, "fixture"),
    repo: stringValue(values, "repo"),
    pull: numberValue(values, "pull"),
    model: stringValue(values, "model") ?? "gpt-5.4",
    budgetUsd: numberValue(values, "budget-usd"),
    format: parseFormat(stringValue(values, "format")),
    client: parseClient(stringValue(values, "client"), command ?? "dry-run"),
    noPost: values.has("no-post")
  };
}

async function loadDiff(options: CliOptions, cwd: string): Promise<string> {
  if (options.fixture) {
    return readFileSync(resolve(cwd, options.fixture), "utf8");
  }

  if (options.command === "dry-run") {
    return readFileSync(resolve(cwd, "fixtures/sample-pr.diff"), "utf8");
  }

  if (!options.repo || !options.pull) {
    throw new Error("Live review requires --repo owner/repo and --pull number.");
  }

  return fetchPullRequestDiff({ ...parseRepo(options.repo), pullNumber: options.pull });
}

function normalizeCommand(value: string | undefined): Command | undefined {
  if (value === "dry-run" || value === "review") {
    return value;
  }
  return undefined;
}

function stringValue(values: Map<string, string | true>, key: string): string | undefined {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function numberValue(values: Map<string, string | true>, key: string): number | undefined {
  const value = stringValue(values, key);
  if (value === undefined) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected --${key} to be numeric.`);
  }
  return number;
}

function parseFormat(value: string | undefined): "markdown" | "json" {
  if (value === undefined || value === "markdown") {
    return "markdown";
  }
  if (value === "json") {
    return "json";
  }
  throw new Error("Expected --format to be markdown or json.");
}

function parseClient(value: string | undefined, command: Command): ReviewClientKind {
  if (value === undefined) {
    return command === "dry-run" ? "stub" : "auto";
  }
  if (value === "auto" || value === "codex" || value === "openai" || value === "stub") {
    return value;
  }
  throw new Error("Expected --client to be auto, codex, openai, or stub.");
}

function parseMode(value: string | undefined): "review" | "gate" {
  if (value === undefined || value === "review") {
    return "review";
  }
  if (value === "gate") {
    return "gate";
  }
  throw new Error("Expected --mode to be review or gate.");
}
