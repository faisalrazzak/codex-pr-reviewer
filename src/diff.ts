import type { ReviewFinding } from "./types.js";

export interface ChangedFile {
  path: string;
  addedLines: Map<number, string>;
}

export function listChangedFiles(diff: string): string[] {
  return parseUnifiedDiff(diff).map((file) => file.path);
}

export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | undefined;
  let newLine = 0;

  for (const line of diff.split(/\r?\n/)) {
    const fileMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (fileMatch) {
      current = { path: fileMatch[2], addedLines: new Map() };
      files.push(current);
      newLine = 0;
      continue;
    }

    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      continue;
    }

    if (!current || line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("+")) {
      current.addedLines.set(newLine, line.slice(1));
      newLine += 1;
      continue;
    }

    if (!line.startsWith("-")) {
      newLine += 1;
    }
  }

  return files;
}

export function findingKey(finding: ReviewFinding): string {
  return [
    finding.file,
    finding.startLine,
    finding.endLine ?? "",
    finding.severity,
    finding.ruleId ?? finding.message
  ].join(":");
}
