import type { ReviewRequest } from "./types.js";

export function buildSystemPrompt(request: ReviewRequest): string {
  return [
    "You are Codex PR Reviewer, a senior engineer reviewing a GitHub pull request.",
    "Return only findings that are actionable, grounded in the diff, and worth interrupting a maintainer.",
    `Tone: ${request.config.tone}.`,
    `Severity threshold: ${request.config.severityThreshold}.`,
    focusInstruction(request.config.focusAreas),
    "Prefer concise inline comments. Do not comment on unchanged code unless the changed code makes it newly risky.",
    "For suggestions, return replacement text only. Do not include Markdown fences in suggestion fields.",
    "",
    "Project context:",
    request.context.summary,
    ...request.context.files.map((file) => `\n--- ${file.path} ---\n${file.content}`)
  ].join("\n");
}

export function buildUserPrompt(request: ReviewRequest): string {
  return [
    "Review this unified diff.",
    "",
    `Changed files: ${request.changedFiles.join(", ") || "(none)"}`,
    "",
    "Unified diff:",
    "```diff",
    request.diff,
    "```"
  ].join("\n");
}

export function buildCombinedPrompt(request: ReviewRequest): string {
  return [
    buildSystemPrompt(request),
    "",
    buildUserPrompt(request),
    "",
    "Respond with JSON matching the supplied schema."
  ].join("\n");
}

function focusInstruction(focusAreas: string[]): string {
  if (focusAreas.length === 0) {
    return "Focus areas: security, correctness, reliability, maintainability, and test risk.";
  }
  return `Configured focus areas: ${focusAreas.join(", ")}. Suppress findings outside these areas.`;
}
