import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CodexClient } from "./codex-client.js";
import { StubCodexClient } from "./codex-client.js";
import { parseReviewModelResponse, reviewResponseJsonSchema } from "./model-response.js";
import { buildCombinedPrompt, buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import type { ReviewRequest, ReviewResult } from "./types.js";

export type ReviewClientKind = "auto" | "codex" | "openai" | "stub";

export class OpenAiResponsesClient implements CodexClient {
  constructor(private readonly apiKey = process.env.OPENAI_API_KEY) {}

  async review(request: ReviewRequest): Promise<Omit<ReviewResult, "usage" | "budgetExceeded">> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for the OpenAI Responses client.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        input: [
          { role: "system", content: buildSystemPrompt(request) },
          { role: "user", content: buildUserPrompt(request) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "codex_pr_review",
            strict: true,
            schema: reviewResponseJsonSchema
          }
        }
      })
    });

    const body = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed (${response.status}): ${formatApiError(body)}`);
    }

    return parseReviewModelResponse(extractOutputText(body));
  }
}

export class CodexCliClient implements CodexClient {
  async review(request: ReviewRequest): Promise<Omit<ReviewResult, "usage" | "budgetExceeded">> {
    const dir = mkdtempSync(join(tmpdir(), "codex-pr-reviewer-"));
    const schemaPath = join(dir, "review-schema.json");
    const outputPath = join(dir, "review.json");

    try {
      writeFileSync(schemaPath, JSON.stringify(reviewResponseJsonSchema), "utf8");
      execFileSync(
        "codex",
        [
          "exec",
          "--json",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--model",
          request.model,
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
          "-"
        ],
        {
          input: buildCombinedPrompt(request),
          encoding: "utf8",
          timeout: 180_000
        }
      );

      return parseReviewModelResponse(readFileSync(outputPath, "utf8"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

export class FallbackCodexClient implements CodexClient {
  constructor(private readonly clients: CodexClient[]) {}

  async review(request: ReviewRequest): Promise<Omit<ReviewResult, "usage" | "budgetExceeded">> {
    const failures: string[] = [];
    for (const client of this.clients) {
      try {
        return await client.review(request);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(`All review clients failed: ${failures.join(" | ")}`);
  }
}

export function createReviewClient(kind: ReviewClientKind): CodexClient {
  if (kind === "stub") {
    return new StubCodexClient();
  }
  if (kind === "openai") {
    return new OpenAiResponsesClient();
  }
  if (kind === "codex") {
    return new CodexCliClient();
  }

  const clients = commandExists("codex")
    ? [new CodexCliClient(), new OpenAiResponsesClient()]
    : [new OpenAiResponsesClient()];
  return new FallbackCodexClient(clients);
}

function commandExists(command: string): boolean {
  const checker = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  try {
    execFileSync(checker, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function extractOutputText(body: unknown): string {
  if (isRecord(body) && typeof body.output_text === "string") {
    return body.output_text;
  }
  if (!isRecord(body) || !Array.isArray(body.output)) {
    throw new Error("OpenAI response did not include output text.");
  }

  const text = body.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .join("");

  if (!text) {
    throw new Error("OpenAI response output text was empty.");
  }
  return text;
}

function formatApiError(body: unknown): string {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message;
  }
  return JSON.stringify(body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
