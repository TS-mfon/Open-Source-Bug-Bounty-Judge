export type AllocationCandidate = {
  id: string;
  eligible: boolean;
  score: number;
};

export const MIN_REWARD_USDC_MICROS = 20_000_000n;
export const MID_REWARD_USDC_MICROS = 40_000_000n;
export const MAX_REWARD_USDC_MICROS = 60_000_000n;

function rewardTier(score: number, threshold: number) {
  const band = Math.floor(((score - threshold) * 3) / (101 - threshold));
  if (band >= 2) return MAX_REWARD_USDC_MICROS;
  if (band === 1) return MID_REWARD_USDC_MICROS;
  return MIN_REWARD_USDC_MICROS;
}

export function allocateBudget(
  budgetUsdcMicros: bigint,
  threshold: number,
  candidates: AllocationCandidate[],
) {
  const qualifying = candidates
    .filter((candidate) => candidate.eligible && candidate.score >= threshold)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (qualifying.length === 0) {
    return {
      status: "admin_review" as const,
      allocations: candidates.map((candidate) => ({
        id: candidate.id,
        amount: 0n,
        rewardTier: 0n,
        budgetLimited: false,
      })),
      shortlist: [...candidates].sort((a, b) => b.score - a.score).slice(0, 3),
      totalAllocated: 0n,
      unallocatedBudget: budgetUsdcMicros,
    };
  }

  const allocationMap = new Map<
    string,
    { amount: bigint; rewardTier: bigint; budgetLimited: boolean }
  >();
  let allocated = 0n;
  for (const candidate of qualifying) {
    const tier = rewardTier(candidate.score, threshold);
    const remaining = budgetUsdcMicros - allocated;
    if (remaining < MIN_REWARD_USDC_MICROS) {
      allocationMap.set(candidate.id, {
        amount: 0n,
        rewardTier: tier,
        budgetLimited: true,
      });
      continue;
    }
    const amount = remaining < tier ? remaining : tier;
    allocationMap.set(candidate.id, {
      amount,
      rewardTier: tier,
      budgetLimited: amount < tier,
    });
    allocated += amount;
  }
  return {
    status: "finalized" as const,
    allocations: candidates.map((candidate) => ({
      id: candidate.id,
      amount: allocationMap.get(candidate.id)?.amount ?? 0n,
      rewardTier: allocationMap.get(candidate.id)?.rewardTier ?? 0n,
      budgetLimited: allocationMap.get(candidate.id)?.budgetLimited ?? false,
    })),
    shortlist: [],
    totalAllocated: allocated,
    unallocatedBudget: budgetUsdcMicros - allocated,
  };
}
