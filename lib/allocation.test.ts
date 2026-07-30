import { describe, expect, it } from "vitest";
import { allocateBudget } from "./allocation";

describe("allocateBudget", () => {
  it("allocates the complete budget among quality work", () => {
    const result = allocateBudget(1_000_000n, 70, [
      { id: "a", eligible: true, score: 90 },
      { id: "b", eligible: true, score: 80 },
      { id: "c", eligible: true, score: 60 },
    ]);
    expect(result.status).toBe("finalized");
    expect(result.allocations.reduce((sum, item) => sum + item.amount, 0n)).toBe(1_000_000n);
    expect(result.allocations.find((item) => item.id === "c")?.amount).toBe(0n);
  });

  it("returns an admin shortlist when nobody qualifies", () => {
    const result = allocateBudget(1_000_000n, 70, [
      { id: "a", eligible: true, score: 60 },
      { id: "b", eligible: true, score: 65 },
    ]);
    expect(result.status).toBe("admin_review");
    expect(result.shortlist[0].id).toBe("b");
  });
});
