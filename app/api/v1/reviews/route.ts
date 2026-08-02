import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import {
  ApiError,
  errorResponse,
  parseJson,
  requestId,
  requireIdempotencyKey,
} from "@/lib/errors";
import {
  readCampaign,
  readCampaignReviews,
  readReviewByKey,
  submitBatchReview,
} from "@/lib/genlayer";
import { preflightContribution, resolveReviewCandidate } from "@/lib/github";
import { campaignReviewKey } from "@/lib/hash";
import { batchReviewSchema } from "@/lib/schemas";
import {
  pollReviewUntilSettled,
  reviewWaitTimeout,
} from "@/lib/review-polling";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const key = await requireApiKey(request, "reviews:create");
    const idempotencyKey = requireIdempotencyKey(request);
    const intent = batchReviewSchema.parse(await parseJson(request));
    const input = {
      ...intent,
      candidates: await Promise.all(intent.candidates.map(resolveReviewCandidate)),
    };
    const campaign = await readCampaign(key.campaign_id);
    if (!campaign) throw new ApiError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
    await Promise.all(
      input.candidates.map((candidate) =>
        preflightContribution(candidate, { skipPullRequest: true }),
      ),
    );
    const deterministicKey = campaignReviewKey(
      key.organization_id,
      key.campaign_id,
      input.candidates,
      String(campaign.rubric_version),
    );
    const existing = await readReviewByKey(deterministicKey);
    if (existing) {
      throw new ApiError(
        "REVIEW_ALREADY_EXISTS",
        "This exact candidate revision set has already been reviewed.",
        409,
        false,
        { reviewId: existing },
      );
    }
    const reviewId = `review_${deterministicKey}`;
    const transactionHash = await submitBatchReview({
      reviewId,
      reviewKey: deterministicKey,
      candidates: input.candidates,
      keyHash: key.key_hash,
      idempotencyKey,
      appealContext: input.appealContext,
    });
    const statusUrl = `/api/v1/reviews/${reviewId}?transactionHash=${transactionHash}`;
    const settled = await pollReviewUntilSettled(
      reviewId,
      transactionHash,
      { timeoutMs: reviewWaitTimeout(request) },
    );
    if (settled.status === "finalized") {
      return NextResponse.json({
        reviewId,
        campaignId: key.campaign_id,
        status: settled.review.status,
        transactionHash,
        statusUrl,
        candidates: input.candidates,
        review: settled.review,
      });
    }
    if (settled.status === "failed") {
      return NextResponse.json(
        {
          reviewId,
          campaignId: key.campaign_id,
          status: "failed",
          transactionHash,
          statusUrl,
          candidates: input.candidates,
          transaction: settled.transaction,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        reviewId,
        campaignId: key.campaign_id,
        status: "submitted",
        transactionHash,
        statusUrl,
        candidates: input.candidates,
      },
      {
        status: 202,
        headers: {
          Location: statusUrl,
          "Retry-After": "30",
          "Preference-Applied": "respond-async",
        },
      },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const key = await requireApiKey(request, "reviews:read");
    const reviews = await readCampaignReviews(key.campaign_id);
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit") ?? 20), 1), 100);
    const cursor = Math.max(Number(params.get("cursor") ?? 0), 0);
    return NextResponse.json({
      campaignId: key.campaign_id,
      reviews: reviews.slice(cursor, cursor + limit),
      nextCursor: cursor + limit < reviews.length ? cursor + limit : null,
      total: reviews.length,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
