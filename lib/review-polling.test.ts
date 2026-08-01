import { describe, expect, it, vi } from "vitest";
import type { StoredReview } from "./types";
import { pollReviewUntilSettled } from "./review-polling";

const review = {
  review_id: "review-1",
  review_key: "key",
  campaign_id: "campaign",
  organization_id: "organization",
  status: "finalized",
  budget_usdc_micros: "5000000000",
  result: {
    candidates: [],
    qualifying_count: 0,
    total_allocated_usdc_micros: "0",
    explanation: "done",
  },
} satisfies StoredReview;

describe("pollReviewUntilSettled", () => {
  it("returns the finalized review after transient read failures", async () => {
    const readReview = vi
      .fn()
      .mockRejectedValueOnce(new Error("not indexed"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(review);
    let now = 0;

    const result = await pollReviewUntilSettled(
      "review-1",
      `0x${"a".repeat(64)}`,
      {
        timeoutMs: 100,
        intervalMs: 10,
        dependencies: {
          readReview,
          readTransaction: vi.fn().mockResolvedValue({
            status: "PENDING",
            executionResult: "NOT_VOTED",
            consensusResult: null,
            resultCode: null,
            error: null,
          }),
          sleep: async (milliseconds) => {
            now += milliseconds;
          },
          now: () => now,
        },
      },
    );

    expect(result.status).toBe("finalized");
    expect(readReview).toHaveBeenCalledTimes(3);
  });

  it("returns a GenVM execution failure immediately", async () => {
    const result = await pollReviewUntilSettled(
      "review-1",
      `0x${"b".repeat(64)}`,
      {
        dependencies: {
          readReview: vi.fn().mockResolvedValue(undefined),
          readTransaction: vi.fn().mockResolvedValue({
            status: "FINALIZED",
            executionResult: "FINISHED_WITH_ERROR",
            consensusResult: "MAJORITY_AGREE",
            resultCode: 1,
            error: { code: "VM_ERROR", message: "Execution failed" },
          }),
        },
      },
    );

    expect(result.status).toBe("failed");
  });

  it("returns a durable pending response when the wait window expires", async () => {
    let now = 0;
    const result = await pollReviewUntilSettled(
      "review-1",
      `0x${"c".repeat(64)}`,
      {
        timeoutMs: 20,
        intervalMs: 10,
        dependencies: {
          readReview: vi.fn().mockResolvedValue(undefined),
          readTransaction: vi.fn().mockResolvedValue({
            status: "PENDING",
            executionResult: "NOT_VOTED",
            consensusResult: null,
            resultCode: null,
            error: null,
          }),
          sleep: async (milliseconds) => {
            now += milliseconds;
          },
          now: () => now,
        },
      },
    );

    expect(result.status).toBe("pending");
  });
});
