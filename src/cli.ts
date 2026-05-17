import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StubCodexClient } from "./codex-client.js";
import { loadReviewConfig, overrideConfig } from "./config.js";
import { fetchPullRequestDiff, parseRepo } from "./github.js";
import { renderJson, renderMarkdown } from "./output.js";
import { runReview } from "./review.js";

type Command = "dry-run" | "review";

interface CliOptions {
  command: Command;
  configPath?: string;
  fixture?: string;
  repo?: string;
  pull?: number;
  model: string;
  budgetUsd?: number;
  format: "markdown" | "json";
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
    client: new StubCodexClient()
  });

  process.stdout.write(options.format === "json" ? `${renderJson(result)}\n` : `${renderMarkdown(result)}\n`);
}

export function parseArgs(argv: string[]): CliOptions {
  const command = normalizeCommand(argv[0]);
  const values = new Map<string, string | true>();

  for (let index = command ? 1 : 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, true);
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return {
    command: command ?? "dry-run",
    configPath: stringValue(values, "config"),
    fixture: stringValue(values, "fixture"),
    repo: stringValue(values, "repo"),
    pull: numberValue(values, "pull"),
    model: stringValue(values, "model") ?? "gpt-5.4",
    budgetUsd: numberValue(values, "budget-usd"),
    format: parseFormat(stringValue(values, "format"))
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
