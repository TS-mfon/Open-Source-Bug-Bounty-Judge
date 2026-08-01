import { describe, expect, it } from "vitest";
import { allocateBudget } from "./allocation";

describe("allocateBudget", () => {
  it("maps validator-agreed scores to fixed 20, 40, and 60 USDC tiers", () => {
    const result = allocateBudget(1_000_000_000n, 70, [
      { id: "a", eligible: true, score: 100 },
      { id: "b", eligible: true, score: 82 },
      { id: "c", eligible: true, score: 70 },
    ]);
    expect(result.status).toBe("finalized");
    expect(result.allocations.map((item) => item.amount)).toEqual([
      60_000_000n,
      40_000_000n,
      20_000_000n,
    ]);
    expect(result.totalAllocated).toBe(120_000_000n);
    expect(result.unallocatedBudget).toBe(880_000_000n);
  });

  it("stops when the remaining budget cannot fund the 20 USDC minimum", () => {
    const result = allocateBudget(70_000_000n, 70, [
      { id: "a", eligible: true, score: 100 },
      { id: "b", eligible: true, score: 90 },
    ]);
    expect(result.allocations[0].amount).toBe(60_000_000n);
    expect(result.allocations[1].amount).toBe(0n);
    expect(result.allocations[1].budgetLimited).toBe(true);
    expect(result.unallocatedBudget).toBe(10_000_000n);
  });

  it("returns an admin shortlist when nobody qualifies", () => {
    const result = allocateBudget(100_000_000n, 70, [
      { id: "a", eligible: true, score: 60 },
      { id: "b", eligible: true, score: 65 },
    ]);
    expect(result.status).toBe("admin_review");
    expect(result.shortlist[0].id).toBe("b");
  });
});
