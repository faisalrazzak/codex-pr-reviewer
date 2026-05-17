import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProjectContextPack } from "./types.js";

const maxContextFileChars = 6000;
const marker = "codex-review: load-me";

export function buildProjectContext(cwd: string, changedFiles: string[]): ProjectContextPack {
  const candidates = [
    "README.md",
    "CODEOWNERS",
    ".github/CODEOWNERS",
    ...findAdrFiles(cwd),
    ...findMarkedChangedFiles(cwd, changedFiles)
  ];

  const seen = new Set<string>();
  const files = candidates.flatMap((path) => {
    if (seen.has(path)) {
      return [];
    }
    seen.add(path);
    const fullPath = resolve(cwd, path);
    if (!existsSync(fullPath)) {
      return [];
    }
    return [{ path, content: readFileSync(fullPath, "utf8").slice(0, maxContextFileChars) }];
  });

  return {
    files,
    summary: files.length
      ? `Loaded ${files.length} context file(s): ${files.map((file) => file.path).join(", ")}`
      : "No project context files found."
  };
}

function findAdrFiles(cwd: string): string[] {
  const dirs = ["adr", "ADRs", "docs/adr", "docs/adrs"];
  return dirs.flatMap((dir) => {
    const fullDir = resolve(cwd, dir);
    if (!existsSync(fullDir)) {
      return [];
    }
    return readdirSync(fullDir)
      .filter((name) => /\.md$/i.test(name))
      .slice(0, 10)
      .map((name) => join(dir, name).replaceAll("\\", "/"));
  });
}

function findMarkedChangedFiles(cwd: string, changedFiles: string[]): string[] {
  return changedFiles.filter((path) => {
    if (/\.(env|pem|key)$/i.test(path)) {
      return false;
    }
    const fullPath = resolve(cwd, path);
    return existsSync(fullPath) && readFileSync(fullPath, "utf8").includes(marker);
  });
}
