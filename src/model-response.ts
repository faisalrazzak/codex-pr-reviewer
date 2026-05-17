import { z } from "zod";
import type { ReviewFinding, ReviewResult } from "./types.js";

const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);
const recommendationSchema = z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]);

const modelFindingSchema = z.object({
  file: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive().nullable(),
  severity: severitySchema,
  category: z.string().min(1),
  message: z.string().min(1),
  suggestion: z.string().min(1).nullable(),
  ruleId: z.string().min(1).nullable()
});

const modelReviewResponseSchema = z.object({
  findings: z.array(modelFindingSchema),
  summary: z.string().min(1),
  approvalRecommendation: recommendationSchema,
  confidence: z.number().min(0).max(1),
  topRisks: z.array(z.string().min(1)).max(3)
});

export type ParsedModelReview = Omit<ReviewResult, "usage" | "budgetExceeded">;

export const reviewResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["findings", "summary", "approvalRecommendation", "confidence", "topRisks"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "file",
          "startLine",
          "endLine",
          "severity",
          "category",
          "message",
          "suggestion",
          "ruleId"
        ],
        properties: {
          file: { type: "string" },
          startLine: { type: "integer" },
          endLine: { anyOf: [{ type: "integer" }, { type: "null" }] },
          severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
          category: { type: "string" },
          message: { type: "string" },
          suggestion: { anyOf: [{ type: "string" }, { type: "null" }] },
          ruleId: { anyOf: [{ type: "string" }, { type: "null" }] }
        }
      }
    },
    summary: { type: "string" },
    approvalRecommendation: { type: "string", enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"] },
    confidence: { type: "number" },
    topRisks: {
      type: "array",
      maxItems: 3,
      items: { type: "string" }
    }
  }
} as const;

export function parseReviewModelResponse(value: unknown): ParsedModelReview {
  const parsed =
    typeof value === "string"
      ? modelReviewResponseSchema.parse(JSON.parse(value))
      : modelReviewResponseSchema.parse(value);

  return {
    findings: parsed.findings.map(toReviewFinding),
    summary: parsed.summary,
    approvalRecommendation: parsed.approvalRecommendation,
    confidence: parsed.confidence,
    topRisks: parsed.topRisks
  };
}

function toReviewFinding(finding: z.infer<typeof modelFindingSchema>): ReviewFinding {
  return {
    file: finding.file,
    startLine: finding.startLine,
    endLine: finding.endLine ?? undefined,
    severity: finding.severity,
    category: finding.category,
    message: finding.message,
    suggestion: finding.suggestion ? { newText: finding.suggestion } : undefined,
    ruleId: finding.ruleId ?? undefined
  };
}
