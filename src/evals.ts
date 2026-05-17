import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const benchPath = resolve(process.cwd(), "evals/bench.jsonl");
const rows = readFileSync(benchPath, "utf8")
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { id: string; expected_findings: unknown[]; expected_recommendation: string });

process.stdout.write(`# Codex PR Reviewer Eval\n\n`);
process.stdout.write(`Bench cases: ${rows.length}\n\n`);
process.stdout.write(`This M1 harness validates bench shape only. Precision/recall scoring lands in M4.\n`);
