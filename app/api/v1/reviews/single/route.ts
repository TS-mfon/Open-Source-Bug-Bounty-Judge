import { NextResponse } from "next/server";
import { verifyWalletReview } from "@/lib/auth";
import { ApiError, errorResponse, parseJson, requestId } from "@/lib/errors";
import { singleReviewSchema } from "@/lib/schemas";
import { preflightContribution } from "@/lib/github";
import { readReviewByKey, submitSingleReview } from "@/lib/genlayer";
import { reviewKey } from "@/lib/hash";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const requestIdentifier = requestId(request);
  try {
    const input = singleReviewSchema.parse(await parseJson(request));
    const validSignature = await verifyWalletReview({
      wallet: input.wallet as `0x${string}`,
      signature: input.signature as `0x${string}`,
      expiresAt: input.expiresAt,
      repository: input.contribution.repository,
      pullRequestNumber: input.contribution.pullRequestNumber,
      headSha: input.contribution.headSha,
    });
    if (!validSignature) {
      throw new ApiError("INVALID_WALLET_SIGNATURE", "Wallet signature is invalid.", 401);
    }
    await preflightContribution(input.contribution);
    const deterministicKey = reviewKey(
      input.wallet.toLowerCase(),
      "individual",
      input.contribution,
      "code-v1",
      "single",
    );
    const existing = await readReviewByKey(deterministicKey);
    if (existing) {
      throw new ApiError(
        "REVIEW_ALREADY_EXISTS",
        "This pull request revision has already been reviewed for this wallet.",
        409,
        false,
        { reviewId: existing },
      );
    }
    const reviewId = `review_${deterministicKey}`;
    const transactionHash = await submitSingleReview({
      reviewId,
      reviewKey: deterministicKey,
      wallet: input.wallet,
      contribution: input.contribution,
    });
    return NextResponse.json(
      { reviewId, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
