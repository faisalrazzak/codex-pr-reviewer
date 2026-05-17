#!/usr/bin/env node
import { main } from "./cli.js";

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`codex-pr-reviewer: ${message}\n`);
  process.exitCode = 1;
});
