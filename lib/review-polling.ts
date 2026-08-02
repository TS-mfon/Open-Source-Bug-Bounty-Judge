import { readReview, readTransaction } from "./genlayer";
import type { StoredReview } from "./types";

type TransactionState = Awaited<ReturnType<typeof readTransaction>>;

type PollDependencies = {
  readReview: typeof readReview;
  readTransaction: typeof readTransaction;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
};

export type ReviewPollingResult =
  | {
      status: "finalized";
      review: StoredReview;
      transaction: TransactionState | null;
    }
  | {
      status: "failed";
      review: null;
      transaction: TransactionState;
    }
  | {
      status: "pending";
      review: null;
      transaction: TransactionState | null;
    };

const defaultDependencies: PollDependencies = {
  readReview,
  readTransaction,
  sleep: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now: () => Date.now(),
};

export function reviewWaitTimeout(request: Request) {
  const preference = request.headers.get("prefer")?.toLowerCase() ?? "";
  if (preference.includes("respond-async")) return 0;
  const wait = preference.match(/(?:^|,|\s)wait=(\d+)/)?.[1];
  if (!wait) return 240_000;
  return Math.min(Number(wait), 240) * 1_000;
}

export async function pollReviewUntilSettled(
  reviewId: string,
  transactionHash: `0x${string}`,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    dependencies?: Partial<PollDependencies>;
  } = {},
): Promise<ReviewPollingResult> {
  const timeoutMs = options.timeoutMs ?? 240_000;
  const intervalMs = options.intervalMs ?? 30_000;
  const dependencies = { ...defaultDependencies, ...options.dependencies };
  const deadline = dependencies.now() + timeoutMs;
  let transaction: TransactionState | null = null;

  do {
    try {
      const review = await dependencies.readReview(reviewId);
      if (review) return { status: "finalized", review, transaction };
    } catch {
      // StudioNet reads can briefly fail while a transaction is being indexed.
    }

    try {
      transaction = await dependencies.readTransaction(transactionHash);
      if (
        transaction.status === "FINALIZED" &&
        (transaction.executionResult === "FINISHED_WITH_ERROR" ||
          transaction.consensusResult === "MAJORITY_DISAGREE" ||
          transaction.consensusResult === "NO_MAJORITY" ||
          transaction.consensusResult === "TIMEOUT" ||
          transaction.consensusResult === "DETERMINISTIC_VIOLATION")
      ) {
        return { status: "failed", review: null, transaction };
      }
    } catch {
      // A freshly submitted transaction may not be readable on every poll.
    }

    if (dependencies.now() >= deadline) break;
    await dependencies.sleep(intervalMs);
  } while (dependencies.now() < deadline);

  return { status: "pending", review: null, transaction };
}
