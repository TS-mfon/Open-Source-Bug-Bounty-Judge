export type AllocationCandidate = {
  id: string;
  eligible: boolean;
  score: number;
  capUsdcMicros?: bigint;
};

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
      allocations: candidates.map((candidate) => ({ id: candidate.id, amount: 0n })),
      shortlist: [...candidates].sort((a, b) => b.score - a.score).slice(0, 3),
    };
  }

  const weights = qualifying.map((candidate) => BigInt(candidate.score * candidate.score));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0n);
  const amounts = qualifying.map((candidate, index) => {
    const proportional = (budgetUsdcMicros * weights[index]) / totalWeight;
    return candidate.capUsdcMicros && proportional > candidate.capUsdcMicros
      ? candidate.capUsdcMicros
      : proportional;
  });
  let remainder = budgetUsdcMicros - amounts.reduce((sum, value) => sum + value, 0n);
  while (remainder > 0n) {
    let distributed = false;
    for (let index = 0; index < qualifying.length && remainder > 0n; index += 1) {
      const cap = qualifying[index].capUsdcMicros;
      if (cap !== undefined && amounts[index] >= cap) continue;
      amounts[index] += 1n;
      remainder -= 1n;
      distributed = true;
    }
    if (!distributed) break;
  }
  const allocationMap = new Map(qualifying.map((candidate, index) => [candidate.id, amounts[index]]));
  return {
    status: "finalized" as const,
    allocations: candidates.map((candidate) => ({
      id: candidate.id,
      amount: allocationMap.get(candidate.id) ?? 0n,
    })),
    shortlist: [],
  };
}
