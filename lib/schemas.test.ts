import { describe, expect, it } from "vitest";
import {
  campaignDashboardPayloadSchema,
  individualReviewIntentSchema,
} from "./schemas";

describe("dashboard request schemas", () => {
  it("accepts the exact normalized campaign payload produced by the UI", () => {
    const result = campaignDashboardPayloadSchema.safeParse({
      id: "stellar-builders-2026",
      organizationId: "grantfox",
      name: "Stellar Builders Sprint",
      budgetUsdcMicros: "10000000000",
      qualityThreshold: 70,
      rubricVersion: "code-v1",
      rubric: {
        correctness: 25,
        tests: 20,
        maintainability: 15,
        scope_alignment: 15,
        impact: 15,
        complexity: 10,
      },
      keyHash: "a".repeat(64),
    });

    expect(result.success).toBe(true);
  });

  it("accepts an individual review with an empty optional evidence URL", () => {
    const result = individualReviewIntentSchema.safeParse({
      repository: " winsznx/routedock ",
      issueNumber: 135,
      pullRequestNumber: 197,
      contributor: "",
      contributionType: "code",
      stellarEvidenceUrls: [""],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repository).toBe("winsznx/routedock");
      expect(result.data.stellarEvidenceUrls).toEqual([]);
    }
  });

  it("returns a field-specific repository validation message", () => {
    const result = individualReviewIntentSchema.safeParse({
      repository: "https://github.com/winsznx/routedock",
      issueNumber: 135,
      pullRequestNumber: 197,
      contributor: "",
      contributionType: "code",
      stellarEvidenceUrls: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["repository"],
        message: "Use the owner/repository format.",
      });
    }
  });

  it("returns a field-specific campaign budget validation message", () => {
    const result = campaignDashboardPayloadSchema.safeParse({
      id: "stellar-builders-2026",
      organizationId: "grantfox",
      name: "Stellar Builders Sprint",
      budgetUsdcMicros: "0",
      qualityThreshold: 70,
      rubricVersion: "code-v1",
      rubric: { correctness: 100 },
      keyHash: "a".repeat(64),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["budgetUsdcMicros"],
        message: "Must be a positive integer.",
      });
    }
  });

  it("requires a campaign budget of at least 5,000 USDC", () => {
    const result = campaignDashboardPayloadSchema.safeParse({
      id: "stellar-builders-2026",
      organizationId: "grantfox",
      name: "Stellar Builders Sprint",
      budgetUsdcMicros: "4999999999",
      qualityThreshold: 70,
      rubricVersion: "code-v1",
      rubric: { correctness: 100 },
      keyHash: "a".repeat(64),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["budgetUsdcMicros"],
        message: "Campaign budget must be at least 5,000 USDC.",
      });
    }
  });
});
